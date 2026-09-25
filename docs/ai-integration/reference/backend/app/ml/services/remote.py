"""A ModelService that forwards requests to a separate inference server.

Wire protocol (implemented by sat_ml/serving/):

    POST {base_url}/v1/predict      multipart/form-data
        request   = JSON {"task", "query", "context", "params",
                          "images": [{"field", "imagery_id", "role", "modality",
                                      "mime_type", "acquisition_date", "metadata"}]}
        <field>   = raw image bytes, one part per image
    200 -> JSON ModelResponse (app/ml/contracts.py)
    4xx/5xx -> JSON {"code": "...", "message": "..."}

    GET  {base_url}/v1/health       -> {"ready": bool, "model_name", "tasks": [...]}

The backend resolves image pointers to bytes (it owns storage credentials) so
inference servers stay storage-agnostic: swapping Supabase Storage for MinIO
on ISRO/SAC infrastructure changes nothing on the model side.
"""
from __future__ import annotations

import json
import logging
from typing import Callable

import httpx
from pydantic import ValidationError

from app.ml.contracts import (
    ImageRef,
    ModelExecutionError,
    ModelInputError,
    ModelNotAvailableError,
    ModelRequest,
    ModelResponse,
    ModelService,
    ModelServiceError,
    Modality,
    TaskType,
)

logger = logging.getLogger(__name__)

ImageLoader = Callable[[ImageRef], bytes]

_ERROR_BY_CODE: dict[str, type[ModelServiceError]] = {
    ModelNotAvailableError.code: ModelNotAvailableError,
    ModelInputError.code: ModelInputError,
    ModelExecutionError.code: ModelExecutionError,
}


class RemoteModelService(ModelService):
    def __init__(
        self,
        *,
        task: TaskType,
        name: str,
        base_url: str,
        image_loader: ImageLoader,
        supported_modalities: frozenset[Modality] = frozenset({Modality.OPTICAL, Modality.UNKNOWN}),
        timeout_s: float = 600.0,
        transport: httpx.BaseTransport | None = None,  # tests inject a MockTransport
    ) -> None:
        self.task = task
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.image_loader = image_loader
        self.supported_modalities = supported_modalities
        self.timeout_s = timeout_s
        self._transport = transport

    def predict(self, request: ModelRequest) -> ModelResponse:
        unsupported = [i.imagery_id for i in request.images if i.modality not in self.supported_modalities]
        if unsupported:
            raise ModelInputError(
                f"{self.name} does not accept modality of image(s) {', '.join(unsupported)}."
            )

        files = []
        manifest = []
        for idx, image in enumerate(request.images):
            field = f"image_{idx}"
            content = self.image_loader(image)  # StorageError propagates as unexpected -> MODEL_EXECUTION_FAILED
            filename = (image.storage_path or field).rsplit("/", 1)[-1]
            files.append((field, (filename, content, image.mime_type or "application/octet-stream")))
            manifest.append({
                "field": field,
                "imagery_id": image.imagery_id,
                "role": image.role.value,
                "modality": image.modality.value,
                "mime_type": image.mime_type,
                "acquisition_date": image.acquisition_date,
                "metadata": image.metadata,
            })

        payload = {
            "task": request.task.value,
            "query": request.query,
            "context": request.context,
            "params": request.params,
            "images": manifest,
        }

        try:
            with httpx.Client(timeout=self.timeout_s, transport=self._transport) as client:
                response = client.post(
                    f"{self.base_url}/v1/predict",
                    data={"request": json.dumps(payload)},
                    files=files,
                )
        except httpx.TimeoutException as exc:
            raise ModelExecutionError(f"{self.name} did not respond within {self.timeout_s:.0f}s.") from exc
        except httpx.TransportError as exc:
            # Server not running / unreachable: the model exists in config but
            # is not up. Report as unavailable, not as a crash.
            raise ModelNotAvailableError(f"{self.name} inference service is unreachable at {self.base_url}.") from exc

        if response.status_code != 200:
            raise self._error_from(response)

        try:
            return ModelResponse.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            logger.error("Malformed response from %s: %s", self.name, response.text[:500])
            raise ModelExecutionError(f"{self.name} returned a malformed response.") from exc

    def _error_from(self, response: httpx.Response) -> ModelServiceError:
        try:
            body = response.json()
            code, message = body.get("code"), body.get("message")
        except ValueError:
            code, message = None, None
        cls = _ERROR_BY_CODE.get(code or "")
        if cls is None:
            cls = ModelInputError if 400 <= response.status_code < 500 else ModelExecutionError
        return cls(message or f"{self.name} returned HTTP {response.status_code}.")


def supabase_image_loader(image: ImageRef) -> bytes:
    """Default loader: fetch the object from Supabase Storage (lazy imports keep
    this module importable without Supabase configured, e.g. in tests)."""
    from app.db.supabase import get_supabase
    from app.services import storage_service

    if not image.storage_path:
        raise ModelInputError(f"Image {image.imagery_id} has no stored file.")
    return storage_service.download_file(get_supabase(), image.storage_path, bucket=image.bucket)
