"""Shared plumbing for SatQuery model inference servers.

Each model runs its own small FastAPI server in its own Python environment
(EarthMind and MCD-Mamba have conflicting dependencies). The SatQuery backend
reaches them over HTTP via `app/ml/services/remote.py`; the wire protocol is
documented there and implemented here:

    GET  /v1/health   -> {"ready", "model_name", "model_version", "tasks", "detail"}
    POST /v1/predict  multipart: request=<JSON>, image_0=<bytes>, image_1=<bytes>
                      -> ModelResponse JSON, or {"code", "message"} with 4xx/5xx

A server only ever returns what its model produced. If the model isn't loaded
it answers 503 MODEL_NOT_AVAILABLE rather than anything that looks like output.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Callable

import numpy as np

logger = logging.getLogger("satquery.serving")


# ---------------------------------------------------------------------------
# Errors -> HTTP (codes match app/ml/contracts.py in the backend)
# ---------------------------------------------------------------------------
class ServingError(Exception):
    status = 500
    code = "MODEL_EXECUTION_FAILED"

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class NotAvailable(ServingError):
    status, code = 503, "MODEL_NOT_AVAILABLE"


class BadInput(ServingError):
    status, code = 422, "MODEL_INPUT_INVALID"


# ---------------------------------------------------------------------------
# Request model (plain dataclasses: servers must not depend on the backend)
# ---------------------------------------------------------------------------
@dataclass
class InputImage:
    imagery_id: str
    role: str  # single | t1 | t2 | optical | sar
    modality: str  # optical | sar | unknown
    filename: str
    content: bytes
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PredictRequest:
    task: str
    query: str
    images: list[InputImage]
    context: dict[str, Any]
    params: dict[str, Any]

    def by_role(self, role: str) -> InputImage:
        for img in self.images:
            if img.role == role:
                return img
        raise BadInput(f"Task '{self.task}' needs an image with role '{role}'.")


# ---------------------------------------------------------------------------
# Raster helpers
# ---------------------------------------------------------------------------
@dataclass
class Raster:
    data: np.ndarray  # H x W x C, float32
    pixel_size_m: float | None = None  # only when the CRS is projected in metres
    crs: str | None = None


def read_raster(content: bytes, filename: str) -> Raster:
    """Decode an image or (Geo)TIFF into H x W x C float32.

    Multi-band GeoTIFFs need rasterio; plain PNG/JPEG work with Pillow.
    """
    is_tiff = filename.lower().endswith((".tif", ".tiff"))
    if is_tiff:
        try:
            import rasterio
            from rasterio.io import MemoryFile
        except ImportError:
            rasterio = None
        if rasterio is not None:
            with MemoryFile(content) as mem, mem.open() as ds:
                arr = np.transpose(ds.read().astype(np.float32), (1, 2, 0))
                pixel = None
                crs = ds.crs.to_string() if ds.crs else None
                if ds.crs is not None and ds.crs.is_projected and (ds.crs.linear_units or "").lower() in ("metre", "meter", "m"):
                    pixel = float(abs(ds.transform.a))
                return Raster(arr, pixel, crs)
    from PIL import Image

    try:
        img = Image.open(io.BytesIO(content))
        img.load()
    except Exception as exc:  # noqa: BLE001
        hint = " Install rasterio to read multi-band GeoTIFFs." if is_tiff else ""
        raise BadInput(f"Could not decode image '{filename}'.{hint}") from exc
    arr = np.asarray(img, dtype=np.float32)
    if arr.ndim == 2:
        arr = arr[:, :, None]
    return Raster(arr)


def percentile_stretch(arr: np.ndarray, low: float = 2, high: float = 98) -> np.ndarray:
    """Per-channel 2-98% stretch to 0..1 (same idea as MCD-Mamba's normalize_img_custom)."""
    out = np.zeros_like(arr, dtype=np.float32)
    for c in range(arr.shape[2]):
        ch = arr[:, :, c]
        lo, hi = np.percentile(ch, low), np.percentile(ch, high)
        out[:, :, c] = 0.0 if hi <= lo else (np.clip(ch, lo, hi) - lo) / (hi - lo)
    return out


def mask_summary(mask: np.ndarray, pixel_size_m: float | None = None) -> dict[str, Any]:
    """Deterministic measurements computed from a binary mask (not model text)."""
    mask = mask.astype(bool)
    total = int(mask.size)
    positive = int(mask.sum())
    summary: dict[str, Any] = {
        "positive_pixels": positive,
        "total_pixels": total,
        "positive_fraction": (positive / total) if total else 0.0,
        "height": int(mask.shape[0]),
        "width": int(mask.shape[1]),
        "bbox_pixels": None,
        "pixel_size_m": pixel_size_m,
        "area_m2": (positive * pixel_size_m ** 2) if pixel_size_m else None,
    }
    if positive:
        ys, xs = np.nonzero(mask)
        summary["bbox_pixels"] = {"x": int(xs.min()), "y": int(ys.min()),
                                  "w": int(xs.max() - xs.min() + 1), "h": int(ys.max() - ys.min() + 1)}
    return summary


def mask_png_base64(mask: np.ndarray) -> str:
    from PIL import Image

    buf = io.BytesIO()
    Image.fromarray((mask.astype(bool) * 255).astype(np.uint8)).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
@dataclass
class ModelHandle:
    """What a server plugs in: identity, readiness and one predict function."""

    model_name: str
    model_version: str | None
    tasks: list[str]
    predict: Callable[[PredictRequest], dict[str, Any]]
    ready: Callable[[], bool] = lambda: True
    detail: Callable[[], str] = lambda: ""


def create_app(handle: ModelHandle):
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    app = FastAPI(title=f"SatQuery inference: {handle.model_name}")
    gpu_lock = threading.Lock()  # one inference at a time on a single GPU

    def fail(err: ServingError) -> JSONResponse:
        return JSONResponse(status_code=err.status, content={"code": err.code, "message": err.message})

    @app.get("/v1/health")
    def health():
        return {"ready": handle.ready(), "model_name": handle.model_name,
                "model_version": handle.model_version, "tasks": handle.tasks, "detail": handle.detail()}

    @app.post("/v1/predict")
    async def predict(request: Request):
        form = await request.form()
        try:
            raw = json.loads(form.get("request") or "")
        except (TypeError, ValueError):
            return fail(BadInput("Missing or invalid 'request' JSON field."))

        if raw.get("task") not in handle.tasks:
            return fail(NotAvailable(f"{handle.model_name} does not serve task '{raw.get('task')}'."))
        if not handle.ready():
            return fail(NotAvailable(f"{handle.model_name} is not loaded: {handle.detail()}"))

        images = []
        for item in raw.get("images", []):
            upload = form.get(item.get("field", ""))
            if upload is None:
                return fail(BadInput(f"Missing file part '{item.get('field')}'."))
            images.append(InputImage(
                imagery_id=item.get("imagery_id", ""), role=item.get("role", "single"),
                modality=item.get("modality", "unknown"), filename=upload.filename or "image",
                content=await upload.read(), metadata=item.get("metadata") or {},
            ))
        req = PredictRequest(task=raw["task"], query=raw.get("query", ""), images=images,
                             context=raw.get("context") or {}, params=raw.get("params") or {})

        try:
            with gpu_lock:
                body = handle.predict(req)
        except ServingError as err:
            return fail(err)
        except Exception:  # noqa: BLE001
            logger.exception("Inference failed")
            return fail(ServingError(f"{handle.model_name} inference failed."))

        body.setdefault("model_name", handle.model_name)
        body.setdefault("model_version", handle.model_version)
        return body

    return app
