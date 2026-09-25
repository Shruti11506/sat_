"""MCD-Mamba inference server -> bi-temporal change detection.

Needs a TRAINED checkpoint. The MCD-Mamba repo ships none; without one the
network has random weights and its masks would be noise, so this server
refuses to predict (503 MODEL_NOT_AVAILABLE) until MCD_CHECKPOINT is set.

Run in MCD-Mamba's environment on a Linux/WSL2 CUDA machine (the Mamba
selective-scan kernel must be compiled: `cd MCD-Mamba/kernels/selective_scan
&& pip install .`):

    cd /path/to/sat_ml
    pip install fastapi uvicorn python-multipart rasterio
    export MCD_CHECKPOINT=/models/mcd_mamba_opt13.pth          # from train_ONERA.py
    export MCD_CONFIG=MCD-Mamba/changedetection/configs/vssm1/vssm_compact_224.yaml
    export MCD_MODE=opt_only          # must match how the checkpoint was trained
    export MCD_OPT_BANDS=13
    uvicorn serving.mcd_mamba_server:app --host 127.0.0.1 --port 8102

Then in sat_/backend/.env:  MCD_MAMBA_SERVICE_URL=http://127.0.0.1:8102

Preprocessing mirrors changedetection/datasets/make_data_loader.py
(ONERAChangeDetectionDataset): process_MS / process_SAR, then
imutils.normalize_img_custom, HWC -> CHW, 224x224 patches, argmax, stitch.
Output is a binary change mask plus pixel/area counts computed from it.
MCD-Mamba does not produce text, so `answer` is null.
"""
from __future__ import annotations

import logging
import os
import sys
import types
from argparse import Namespace
from pathlib import Path
from typing import Any

import numpy as np

from serving.common import (
    BadInput,
    ModelHandle,
    NotAvailable,
    PredictRequest,
    create_app,
    mask_png_base64,
    mask_summary,
    read_raster,
)

logger = logging.getLogger("satquery.mcd_mamba")

MCD_ROOT = Path(os.environ.get("MCD_ROOT", Path(__file__).resolve().parents[1] / "MCD-Mamba"))
CONFIG = os.environ.get("MCD_CONFIG", str(MCD_ROOT / "changedetection/configs/vssm1/vssm_compact_224.yaml"))
CHECKPOINT = os.environ.get("MCD_CHECKPOINT", "")
MODE = os.environ.get("MCD_MODE", "opt_only")  # opt_only | sar_only
OPT_BANDS = int(os.environ.get("MCD_OPT_BANDS", "13"))
PATCH = int(os.environ.get("MCD_PATCH", "224"))
BATCH = int(os.environ.get("MCD_BATCH", "8"))

_state: dict[str, Any] = {"model": None, "error": ""}


def _alias_package() -> None:
    """The repo's code imports itself as `MambaCD.*` (its original folder name,
    via sys.path hacks for Colab). Register MCD-Mamba/ under that name."""
    if "MambaCD" not in sys.modules:
        pkg = types.ModuleType("MambaCD")
        pkg.__path__ = [str(MCD_ROOT)]
        sys.modules["MambaCD"] = pkg


def load_model() -> None:
    if not CHECKPOINT:
        _state["error"] = "No trained checkpoint configured (MCD_CHECKPOINT)."
        return
    if not Path(CHECKPOINT).is_file():
        _state["error"] = f"Checkpoint not found: {CHECKPOINT}"
        return
    if MODE not in ("opt_only", "sar_only"):
        _state["error"] = f"MCD_MODE={MODE} not supported yet (use opt_only or sar_only)."
        return
    try:
        import torch

        _alias_package()
        from MambaCD.changedetection.configs.config import get_config
        from MambaCD.changedetection.models.MambaBCD_multimodal_diff import STMambaBCD_multimodal

        config = get_config(Namespace(cfg=CONFIG, opts=None))
        v = config.MODEL.VSSM
        # Same constructor arguments as changedetection/script/infer_ONERA.py.
        model = STMambaBCD_multimodal(
            pretrained=None,
            patch_size=v.PATCH_SIZE, num_classes=config.MODEL.NUM_CLASSES,
            depths=v.DEPTHS, dims=v.EMBED_DIM,
            ssm_d_state=v.SSM_D_STATE, ssm_ratio=v.SSM_RATIO, ssm_rank_ratio=v.SSM_RANK_RATIO,
            ssm_dt_rank=("auto" if v.SSM_DT_RANK == "auto" else int(v.SSM_DT_RANK)),
            ssm_act_layer=v.SSM_ACT_LAYER, ssm_conv=v.SSM_CONV, ssm_conv_bias=v.SSM_CONV_BIAS,
            ssm_drop_rate=v.SSM_DROP_RATE, ssm_init=v.SSM_INIT, forward_type=v.SSM_FORWARDTYPE,
            mlp_ratio=v.MLP_RATIO, mlp_act_layer=v.MLP_ACT_LAYER, mlp_drop_rate=v.MLP_DROP_RATE,
            drop_path_rate=config.MODEL.DROP_PATH_RATE, patch_norm=v.PATCH_NORM, norm_layer=v.NORM_LAYER,
            downsample_version=v.DOWNSAMPLE, patchembed_version=v.PATCHEMBED, gmlp=v.GMLP,
            use_checkpoint=False,
            opt_only=(MODE == "opt_only"), sar_only=(MODE == "sar_only"), opt_bands=OPT_BANDS,
        )
        state = torch.load(CHECKPOINT, map_location="cpu")
        missing, unexpected = model.load_state_dict(state, strict=False)
        if missing:
            # A partially-loaded network would silently produce garbage.
            raise RuntimeError(f"Checkpoint does not match the model config ({len(missing)} missing keys).")
        if unexpected:
            logger.warning("Ignoring %d unexpected checkpoint keys", len(unexpected))
        _state["model"] = model.cuda().eval()
        logger.info("MCD-Mamba loaded: mode=%s bands=%d ckpt=%s", MODE, OPT_BANDS, CHECKPOINT)
    except Exception as exc:  # noqa: BLE001
        logger.exception("MCD-Mamba failed to load")
        _state["error"] = f"{type(exc).__name__}: {exc}"


# --- preprocessing, mirroring ONERAChangeDetectionDataset -------------------
def _rescale(img, lo, hi):
    return np.float32((np.clip(img, lo, hi) - lo) / (hi - lo))


def _normalize_img_custom(img: np.ndarray) -> np.ndarray:
    out = np.zeros_like(img, dtype=np.float32)
    for i in range(img.shape[2]):
        ch = img[:, :, i]
        lo, hi = np.percentile(ch, 2), np.percentile(ch, 98)
        out[:, :, i] = 0.0 if hi <= lo else (np.clip(ch, lo, hi) - lo) / (hi - lo)
    return out


def _prepare(content: bytes, filename: str):
    raster = read_raster(content, filename)
    arr = raster.data
    if MODE == "opt_only":
        if arr.shape[2] != OPT_BANDS:
            raise BadInput(f"Expected a {OPT_BANDS}-band Sentinel-2 image, got {arr.shape[2]} band(s).")
        arr = _rescale(arr, 0, 10000)  # process_MS
    else:
        if arr.shape[2] != 2:
            raise BadInput(f"Expected a 2-band SAR image (dB), got {arr.shape[2]} band(s).")
        arr = _rescale(arr, -25, 0)  # process_SAR (expects dB values)
    return _normalize_img_custom(arr), raster.pixel_size_m


def _infer(pre: np.ndarray, post: np.ndarray) -> np.ndarray:
    import torch

    h, w = pre.shape[:2]
    ph, pw = (-h) % PATCH, (-w) % PATCH
    pad = ((0, ph), (0, pw), (0, 0))
    pre_p, post_p = np.pad(pre, pad, mode="reflect"), np.pad(post, pad, mode="reflect")
    H, W = pre_p.shape[:2]
    coords = [(y, x) for y in range(0, H, PATCH) for x in range(0, W, PATCH)]
    out = np.zeros((H, W), dtype=np.uint8)
    model = _state["model"]
    with torch.no_grad():
        for i in range(0, len(coords), BATCH):
            chunk = coords[i:i + BATCH]
            a = np.stack([pre_p[y:y + PATCH, x:x + PATCH].transpose(2, 0, 1) for y, x in chunk])
            b = np.stack([post_p[y:y + PATCH, x:x + PATCH].transpose(2, 0, 1) for y, x in chunk])
            logits = model(torch.from_numpy(a).cuda().float(), torch.from_numpy(b).cuda().float())
            pred = torch.argmax(logits, dim=1).cpu().numpy().astype(np.uint8)
            for (y, x), p in zip(chunk, pred):
                out[y:y + PATCH, x:x + PATCH] = p
    return out[:h, :w]


def predict(req: PredictRequest) -> dict[str, Any]:
    if _state["model"] is None:
        raise NotAvailable(_state["error"] or "MCD-Mamba is not loaded.")
    t1, t2 = req.by_role("t1"), req.by_role("t2")
    pre, pixel = _prepare(t1.content, t1.filename)
    post, _ = _prepare(t2.content, t2.filename)
    if pre.shape != post.shape:
        raise BadInput(f"T1 and T2 must be co-registered with the same size; got {pre.shape[:2]} vs {post.shape[:2]}.")

    mask = _infer(pre, post) == 1  # class 1 = change (labels are cm-1 in training)
    summary = mask_summary(mask, pixel)
    return {
        "answer": None,
        "confidence": None,
        "outputs": {
            "mode": MODE,
            "changed_pixels": summary["positive_pixels"],
            "total_pixels": summary["total_pixels"],
            "changed_fraction": summary["positive_fraction"],
            "pixel_size_m": pixel,
            "changed_area_m2": summary["area_m2"],
            "mask_png_base64": mask_png_base64(mask),
        },
        "evidence": [{
            "evidence_type": "change_mask",
            "description": "MCD-Mamba binary change mask (T1 -> T2)",
            "bbox": summary["bbox_pixels"],
            "metadata": {"changed_pixels": summary["positive_pixels"], "total_pixels": summary["total_pixels"],
                         "changed_area_m2": summary["area_m2"]},
        }],
    }


handle = ModelHandle(
    model_name="MCD-Mamba",
    model_version=f"{Path(CHECKPOINT).name or 'no-checkpoint'} ({MODE}, {OPT_BANDS} bands)",
    tasks=["change_detection"],
    predict=predict,
    ready=lambda: _state["model"] is not None,
    detail=lambda: _state["error"] or "loaded",
)
app = create_app(handle)


@app.on_event("startup")
def _startup() -> None:
    load_model()
