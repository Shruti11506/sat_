"""Tests for the LangGraph orchestrator (app/orchestrator) and model registry.

The model services here are TEST DOUBLES: they return canned values so we can
check the graph's routing and plumbing. They exist only in this file and are
never registered in the application.
"""
import pytest

from app.ml.contracts import (
    EvidenceItem,
    ImageRef,
    Modality,
    ModelExecutionError,
    ModelRequest,
    ModelResponse,
    ModelService,
    TaskType,
)
from app.ml.registry import ModelRegistry, build_default_registry
from app.orchestrator import run_orchestration


class StubService(ModelService):
    def __init__(self, task, answer="stub answer", raises=None):
        self.task = task
        self.name = f"test-double-{task.value}"
        self.answer = answer
        self.raises = raises
        self.calls: list[ModelRequest] = []

    def predict(self, request):
        self.calls.append(request)
        if self.raises:
            raise self.raises
        return ModelResponse(
            model_name=self.name,
            answer=self.answer,
            confidence=0.5,
            outputs={"echo_task": request.task.value},
            evidence=[EvidenceItem(evidence_type="bbox", bbox={"x": 0, "y": 0, "w": 1, "h": 1})],
        )


def _img(i="img-1", modality=Modality.OPTICAL, date=None):
    return ImageRef(imagery_id=i, modality=modality, storage_path=f"imagery/{i}/a.tif",
                    bucket="Satquery", acquisition_date=date)


def _registry(*services):
    reg = ModelRegistry()
    for s in services:
        reg.register(s)
    return reg


def _run(images, query="What is visible?", requested="general_analysis", registry=None, classifier=None):
    return run_orchestration(job_id="job-1", query=query, images=images,
                             requested_analysis_type=requested,
                             registry=registry or ModelRegistry(), classifier=classifier)


def _codes(state):
    return [e["code"] for e in state["errors"]]


# --- registry -----------------------------------------------------------------

def test_default_registry_has_no_models():
    # No SatQuery model is integrated yet; the app must not pretend otherwise.
    assert build_default_registry().available_tasks() == []


# --- no models configured: honest failure, never an answer ---------------------

def test_single_image_without_models_fails_honestly():
    state = _run([_img()])
    assert state["status"] == "failed"
    assert state["final_response"] is None
    assert _codes(state) == ["MODEL_NOT_AVAILABLE"]
    assert state["task_type"] == "vqa"  # understood, just not executable


# --- routing by input structure --------------------------------------------------

def test_single_image_routes_to_vqa_and_returns_model_output():
    vqa = StubService(TaskType.VQA, answer="from model")
    state = _run([_img()], registry=_registry(vqa))
    assert state["status"] == "completed"
    assert state["final_response"]["answer"] == "from model"
    assert state["final_response"]["model_name"] == "test-double-vqa"
    assert state["final_response"]["evidence"][0]["evidence_type"] == "bbox"
    assert len(vqa.calls) == 1 and vqa.calls[0].images[0].role.value == "single"


def test_two_optical_images_route_to_change_detection_ordered_by_date():
    cd = StubService(TaskType.CHANGE_DETECTION)
    later, earlier = _img("b", date="2024-06-01"), _img("a", date="2021-06-01")
    state = _run([later, earlier], query="What changed?", registry=_registry(cd))
    assert state["status"] == "completed"
    assert state["task_type"] == "change_detection"
    roles = {i.imagery_id: i.role.value for i in cd.calls[0].images}
    assert roles == {"a": "t1", "b": "t2"}


def test_optical_plus_sar_routes_to_cross_modal():
    osar = StubService(TaskType.OPTICAL_SAR_ANALYSIS)
    state = _run([_img("o"), _img("s", Modality.SAR)], registry=_registry(osar))
    assert state["status"] == "completed"
    roles = {i.imagery_id: i.role.value for i in osar.calls[0].images}
    assert roles == {"o": "optical", "s": "sar"}


def test_two_images_with_unknown_modality_are_ambiguous():
    state = _run([_img("a", Modality.UNKNOWN), _img("b", Modality.UNKNOWN)])
    assert _codes(state) == ["INPUT_AMBIGUOUS"]


def test_explicit_change_request_resolves_unknown_modality_pair():
    cd = StubService(TaskType.CHANGE_DETECTION)
    state = _run([_img("a", Modality.UNKNOWN), _img("b", Modality.UNKNOWN)],
                 requested="change_detection", registry=_registry(cd))
    assert state["status"] == "completed"
    assert any("upload order" in w for t in state["trace"] for w in t.get("warnings", []))


# --- explicit requests vs inputs ---------------------------------------------------

def test_change_detection_with_one_image_is_rejected():
    state = _run([_img()], requested="change_detection",
                 registry=_registry(StubService(TaskType.CHANGE_DETECTION)))
    assert _codes(state) == ["INCOMPATIBLE_REQUEST"]
    assert "two images" in state["errors"][0]["message"]


def test_explicit_captioning_request_is_honoured():
    cap = StubService(TaskType.CAPTIONING)
    state = _run([_img()], requested="scene_description", registry=_registry(cap))
    assert state["task_type"] == "captioning" and len(cap.calls) == 1


# --- classifier slot -----------------------------------------------------------------

class FixedClassifier:
    name = "fixed"

    def __init__(self, choice):
        self.choice = choice

    def classify(self, query, candidates):
        return self.choice


def test_classifier_choice_is_used_when_allowed():
    grd = StubService(TaskType.REGION_GROUNDING)
    state = _run([_img()], query="Where are the ships?", registry=_registry(grd),
                 classifier=FixedClassifier(TaskType.REGION_GROUNDING))
    assert state["task_type"] == "region_grounding"
    route_trace = next(t for t in state["trace"] if t["node"] == "route")
    assert route_trace["decided_by"] == "classifier:fixed"


def test_classifier_cannot_pick_a_task_the_inputs_dont_support():
    vqa = StubService(TaskType.VQA)
    state = _run([_img()], registry=_registry(vqa),
                 classifier=FixedClassifier(TaskType.CHANGE_DETECTION))
    assert state["task_type"] == "vqa"  # fell back to the input default


# --- model failures ---------------------------------------------------------------------

@pytest.mark.parametrize("exc, code", [
    (ModelExecutionError("CUDA out of memory"), "MODEL_EXECUTION_FAILED"),
    (RuntimeError("boom"), "MODEL_EXECUTION_FAILED"),
])
def test_model_errors_become_failed_state(exc, code):
    state = _run([_img()], registry=_registry(StubService(TaskType.VQA, raises=exc)))
    assert state["status"] == "failed"
    assert state["final_response"] is None
    assert _codes(state) == [code]


# --- input validation -------------------------------------------------------------------

def test_no_images():
    assert _codes(_run([])) == ["NO_IMAGES"]


def test_image_without_storage_path():
    assert _codes(_run([ImageRef(imagery_id="x")])) == ["IMAGE_NOT_STORED"]


def test_state_is_json_serialisable():
    import json
    state = _run([_img()], registry=_registry(StubService(TaskType.VQA)))
    json.dumps(state)  # must be storable as analysis_results.raw_output
