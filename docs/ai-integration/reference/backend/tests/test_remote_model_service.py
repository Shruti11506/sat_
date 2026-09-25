"""Tests for RemoteModelService (backend -> inference server HTTP client).

The inference server is replaced by httpx.MockTransport, so these tests check
the wire protocol and error mapping only. No model runs here.
"""
import httpx
import pytest

from app.ml.contracts import (
    ImageRef,
    ImageRole,
    Modality,
    ModelExecutionError,
    ModelInputError,
    ModelNotAvailableError,
    ModelRequest,
    TaskType,
)
from app.ml.registry import build_default_registry
from app.ml.services.remote import RemoteModelService
from app.orchestrator import run_orchestration


def _loader(image: ImageRef) -> bytes:
    return f"bytes-of-{image.imagery_id}".encode()


def _service(handler, task=TaskType.VQA):
    return RemoteModelService(task=task, name="EarthMind", base_url="http://model:8101/",
                              image_loader=_loader, transport=httpx.MockTransport(handler))


def _request(n=1):
    images = [ImageRef(imagery_id=f"img{i}", role=ImageRole.SINGLE if n == 1 else [ImageRole.T1, ImageRole.T2][i],
                       modality=Modality.OPTICAL, storage_path=f"imagery/img{i}/a.tif", mime_type="image/tiff")
              for i in range(n)]
    return ModelRequest(task=TaskType.VQA, query="What is visible?", images=images)


def test_sends_manifest_and_bytes_and_parses_response():
    seen = {}

    def handler(req: httpx.Request):
        seen["url"] = str(req.url)
        body = req.content.decode("latin-1")
        seen["body"] = body
        return httpx.Response(200, json={"model_name": "EarthMind-4B", "answer": "model text",
                                         "confidence": None, "outputs": {}, "evidence": []})

    resp = _service(handler).predict(_request(2))
    assert seen["url"] == "http://model:8101/v1/predict"
    assert "bytes-of-img0" in seen["body"] and "bytes-of-img1" in seen["body"]
    assert '"role": "t1"' in seen["body"] and '"field": "image_1"' in seen["body"]
    assert resp.answer == "model text" and resp.model_name == "EarthMind-4B"


@pytest.mark.parametrize("status, body, exc", [
    (503, {"code": "MODEL_NOT_AVAILABLE", "message": "multi-sensor weights not loaded"}, ModelNotAvailableError),
    (422, {"code": "MODEL_INPUT_INVALID", "message": "expected 13 bands"}, ModelInputError),
    (500, {"code": "MODEL_EXECUTION_FAILED", "message": "CUDA OOM"}, ModelExecutionError),
    (500, None, ModelExecutionError),
    (400, None, ModelInputError),
])
def test_http_errors_map_to_model_errors(status, body, exc):
    def handler(req):
        return httpx.Response(status, json=body) if body else httpx.Response(status, text="oops")

    with pytest.raises(exc) as info:
        _service(handler).predict(_request())
    if body:
        assert info.value.message == body["message"]


def test_unreachable_server_is_model_not_available():
    def handler(req):
        raise httpx.ConnectError("refused")

    with pytest.raises(ModelNotAvailableError):
        _service(handler).predict(_request())


def test_malformed_response_is_execution_error():
    def handler(req):
        return httpx.Response(200, json={"no_model_name": True})

    with pytest.raises(ModelExecutionError):
        _service(handler).predict(_request())


def test_registry_registers_tasks_only_for_configured_urls():
    reg = build_default_registry(earthmind_url="http://em:8101", image_loader=_loader)
    assert set(reg.available_tasks()) == {TaskType.VQA, TaskType.CAPTIONING,
                                          TaskType.REGION_GROUNDING, TaskType.OPTICAL_SAR_ANALYSIS}
    reg = build_default_registry(mcd_mamba_url="http://cd:8102", image_loader=_loader)
    assert reg.available_tasks() == [TaskType.CHANGE_DETECTION]
    assert build_default_registry().available_tasks() == []


def test_graph_end_to_end_through_http_client():
    """LangGraph -> registry -> RemoteModelService -> (mock) server -> back into state."""
    def handler(req):
        return httpx.Response(200, json={
            "model_name": "MCD-Mamba", "answer": None,
            "outputs": {"changed_pixels": 120, "total_pixels": 10000},
            "evidence": [{"evidence_type": "change_mask", "description": "binary change mask"}],
        })

    reg = build_default_registry(mcd_mamba_url="http://cd:8102", image_loader=_loader)
    reg.get(TaskType.CHANGE_DETECTION)._transport = httpx.MockTransport(handler)

    images = [ImageRef(imagery_id="a", modality=Modality.OPTICAL, storage_path="p/a.tif", acquisition_date="2020-01-01"),
              ImageRef(imagery_id="b", modality=Modality.OPTICAL, storage_path="p/b.tif", acquisition_date="2023-01-01")]
    state = run_orchestration(job_id="j", query="What changed?", images=images, registry=reg)
    assert state["status"] == "completed"
    assert state["final_response"]["model_name"] == "MCD-Mamba"
    assert state["final_response"]["outputs"]["change_detection"]["changed_pixels"] == 120
    assert state["final_response"]["answer"] is None  # MCD-Mamba produces a mask, not text
