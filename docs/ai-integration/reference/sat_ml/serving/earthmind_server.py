"""EarthMind inference server -> VQA, captioning, region grounding, optical+SAR.

Run inside EarthMind's own environment (EarthMind/.venv), on the GPU machine:

    cd E:\\Satquery\\sat_ml
    EarthMind\\.venv\\Scripts\\activate
    pip install fastapi uvicorn python-multipart      # small, server-only
    set EARTHMIND_MODEL_PATH=sy1998/EarthMind-4B      # or a local folder (offline)
    set EARTHMIND_MULTI_MODEL_PATH=sy1998/EarthMind4B_multi   # optional, for optical+SAR
    uvicorn serving.earthmind_server:app --host 127.0.0.1 --port 8101

Then in sat_/backend/.env:  EARTHMIND_SERVICE_URL=http://127.0.0.1:8101

Model calls are exactly the ones in EarthMind/run_inference.py:
  model.predict_forward(image=..., text=..., tokenizer=...)                 single sensor
  model.predict_forward_multi(image=<SAR>, rgb_image=<optical>, text=..., tokenizer=...)
The answer text is EarthMind's `prediction`, unchanged except for removing
special end-of-turn tokens. EarthMind does not expose a calibrated
confidence, so `confidence` is always null.
"""
from __future__ import annotations

import logging
import os
import re
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
    percentile_stretch,
    read_raster,
)

logger = logging.getLogger("satquery.earthmind")

SINGLE_PATH = os.environ.get("EARTHMIND_MODEL_PATH", "sy1998/EarthMind-4B")
MULTI_PATH = os.environ.get("EARTHMIND_MULTI_MODEL_PATH", "")
DEVICE = os.environ.get("EARTHMIND_DEVICE", "auto")

TASKS = ["vqa", "captioning", "region_grounding", "optical_sar_analysis"]

# Prompt templates. EarthMind expects "<image>" before the instruction.
# Grounding uses EarthMind's segmentation phrasing so it emits [SEG] + a mask.
# These are starting points: tune them against EarthMind-Bench prompts.
PROMPTS = {
    "vqa": "<image>{query}",
    "captioning": "<image>{query}",
    "region_grounding": "<image>Please segment {query}",
    "optical_sar_analysis": "<image>{query}",
}

# Sentinel-2 band positions for a true-colour composite (B04, B03, B02), by band count.
S2_RGB_INDEX = {13: (3, 2, 1), 12: (3, 2, 1), 10: (2, 1, 0), 4: (2, 1, 0)}

_state: dict[str, Any] = {"single": None, "multi": None, "error": ""}


def _load(path: str):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    device_map = ("cuda:0" if torch.cuda.is_available() else "cpu") if DEVICE == "auto" else DEVICE
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    logger.info("Loading %s on %s (%s)", path, device_map, dtype)
    model = AutoModelForCausalLM.from_pretrained(path, torch_dtype=dtype, device_map=device_map, trust_remote_code=True)
    tokenizer = AutoTokenizer.from_pretrained(path, trust_remote_code=True)
    return model, tokenizer


def load_models() -> None:
    try:
        _state["single"] = _load(SINGLE_PATH)
        if MULTI_PATH:
            _state["multi"] = _load(MULTI_PATH)
    except Exception as exc:  # noqa: BLE001 - server stays up and reports not-ready
        logger.exception("EarthMind failed to load")
        _state["error"] = f"{type(exc).__name__}: {exc}"


def to_pil_rgb(content: bytes, filename: str, modality: str):
    """Adapt an upload to the 3-channel RGB EarthMind's interface expects.

    - 3-band 8-bit images pass through.
    - Multispectral Sentinel-2 -> true-colour B04/B03/B02, 2-98% stretch.
    - SAR (VV, VH) -> [VV, VH, VV-VH] pseudo-RGB, 2-98% stretch.
    This is an interface adaptation, not a native multispectral/SAR encoding.
    """
    from PIL import Image

    raster = read_raster(content, filename)
    arr = raster.data
    bands = arr.shape[2]

    if modality == "sar":
        if bands == 1:
            rgb = np.repeat(arr, 3, axis=2)
        else:
            vv, vh = arr[:, :, 0], arr[:, :, 1]
            rgb = np.stack([vv, vh, vv - vh], axis=2)
        rgb = percentile_stretch(rgb)
    elif bands == 3 and arr.max() <= 255:
        rgb = arr / 255.0
    elif bands in S2_RGB_INDEX:
        rgb = percentile_stretch(arr[:, :, list(S2_RGB_INDEX[bands])])
    elif bands == 1:
        rgb = percentile_stretch(np.repeat(arr, 3, axis=2))
    elif bands == 4 and arr.max() <= 255:  # RGBA
        rgb = arr[:, :, :3] / 255.0
    else:
        raise BadInput(f"Cannot build an RGB view from a {bands}-band image '{filename}'.")
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)), raster.pixel_size_m


def _clean(prediction: str) -> str:
    return re.sub(r"<\|[^|]*\|>|</s>", "", prediction or "").strip()


def predict(req: PredictRequest) -> dict[str, Any]:
    prompt = req.params.get("prompt") or PROMPTS[req.task].format(query=req.query.strip())

    if req.task == "optical_sar_analysis":
        if _state["multi"] is None:
            raise NotAvailable("Multi-sensor weights (EARTHMIND_MULTI_MODEL_PATH) are not loaded.")
        model, tokenizer = _state["multi"]
        optical, pixel = to_pil_rgb(req.by_role("optical").content, req.by_role("optical").filename, "optical")
        sar_img = req.by_role("sar")
        sar, _ = to_pil_rgb(sar_img.content, sar_img.filename, "sar")
        result = model.predict_forward_multi(image=sar, rgb_image=optical, text=prompt, tokenizer=tokenizer)
    else:
        if len(req.images) != 1:
            raise BadInput(f"Task '{req.task}' takes exactly one image.")
        model, tokenizer = _state["single"]
        img = req.images[0]
        pil, pixel = to_pil_rgb(img.content, img.filename, img.modality)
        result = model.predict_forward(image=pil, text=prompt, tokenizer=tokenizer)

    raw_prediction = result.get("prediction", "")
    answer = _clean(raw_prediction)

    evidence: list[dict[str, Any]] = []
    masks_out: list[dict[str, Any]] = []
    for seg_idx, seg_masks in enumerate(result.get("prediction_masks") or []):
        mask = np.asarray(seg_masks[0]) > 0  # first (only) frame
        summary = mask_summary(mask, pixel)
        masks_out.append({"index": seg_idx, **summary, "mask_png_base64": mask_png_base64(mask)})
        evidence.append({
            "evidence_type": "segmentation_mask",
            "description": f"EarthMind segmentation mask #{seg_idx}",
            "bbox": summary["bbox_pixels"],
            "metadata": {k: v for k, v in summary.items() if k != "bbox_pixels"},
        })

    return {
        "answer": answer or None,
        "confidence": None,
        "outputs": {"prompt": prompt, "raw_prediction": raw_prediction, "masks": masks_out},
        "evidence": evidence,
    }


def _ready() -> bool:
    return _state["single"] is not None


handle = ModelHandle(
    model_name="EarthMind",
    model_version=SINGLE_PATH + (f" + {MULTI_PATH}" if MULTI_PATH else ""),
    tasks=TASKS,
    predict=predict,
    ready=_ready,
    detail=lambda: _state["error"] or ("loaded" if _ready() else "loading"),
)
app = create_app(handle)


@app.on_event("startup")
def _startup() -> None:
    load_models()
