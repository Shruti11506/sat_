"""Graph nodes. Each is a plain function: state in, partial state update out.

Rules every node follows:
- Never raise for an expected problem. Append to `errors` and let the graph
  route to `compose_response`, so the job ends as a clear, recorded failure.
- Never invent content. Answers, confidences and evidence come only from a
  `ModelResponse`.
- Record what was decided in `trace` (the execution log shown for
  debugging/evaluation -- not hidden reasoning).
"""
from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError

from app.ml.contracts import (
    ImageRef,
    ImageRole,
    Modality,
    ModelRequest,
    ModelServiceError,
    TaskType,
)
from app.ml.registry import ModelRegistry
from app.orchestrator import routing
from app.orchestrator.routing import BITEMPORAL, CROSS_MODAL, SINGLE, IntentClassifier
from app.orchestrator.state import OrchestratorState

logger = logging.getLogger(__name__)


def _error(node: str, code: str, message: str) -> dict[str, Any]:
    return {"node": node, "code": code, "message": message}


def _trace(node: str, **detail: Any) -> dict[str, Any]:
    return {"node": node, **detail}


def _requested_task(state: OrchestratorState) -> TaskType | None:
    return routing.ANALYSIS_TYPE_TO_TASK.get(state.get("requested_analysis_type") or "")


# ---------------------------------------------------------------------------
# 1. validate_inputs: what did the user give us, and is it usable?
# ---------------------------------------------------------------------------
def validate_inputs(state: OrchestratorState) -> dict[str, Any]:
    node = "validate_inputs"
    if not (state.get("user_query") or "").strip():
        return {"errors": [_error(node, "INVALID_QUERY", "Query cannot be empty.")]}

    try:
        images = [ImageRef.model_validate(raw) for raw in state.get("images") or []]
    except ValidationError:
        return {"errors": [_error(node, "INVALID_INPUT", "Image references are malformed.")]}

    if not images:
        return {"errors": [_error(node, "NO_IMAGES", "No image was provided for analysis.")]}
    if len(images) > 2:
        return {"errors": [_error(node, "UNSUPPORTED_INPUT", "At most two images can be analysed together.")]}
    missing = [img.imagery_id for img in images if not img.storage_path]
    if missing:
        return {"errors": [_error(node, "IMAGE_NOT_STORED", f"Image(s) have no stored file: {', '.join(missing)}.")]}

    warnings: list[str] = []
    requested = _requested_task(state)
    expected_config = routing.input_config_for_task(requested) if requested else None

    if len(images) == 1:
        config = SINGLE
        images[0].role = ImageRole.SINGLE
    else:
        config, error = _pair_config(images, expected_config)
        if error:
            return {"errors": [_error(node, *error)]}
        if config == BITEMPORAL:
            warnings.extend(_assign_temporal_roles(images))
        else:
            _assign_cross_modal_roles(images)

    modalities = sorted({img.modality.value for img in images})
    modality = "+".join(m for m in modalities if m != Modality.UNKNOWN.value) or Modality.UNKNOWN.value

    return {
        "images": [img.model_dump(mode="json") for img in images],
        "image_ids": [img.imagery_id for img in images],
        "input_config": config,
        "modality": modality,
        "trace": [_trace(node, input_config=config, modality=modality, warnings=warnings)],
    }


def _pair_config(images: list[ImageRef], expected: str | None) -> tuple[str | None, tuple[str, str] | None]:
    roles = {img.role for img in images}
    if roles == {ImageRole.T1, ImageRole.T2}:
        return BITEMPORAL, None
    if roles == {ImageRole.OPTICAL, ImageRole.SAR}:
        return CROSS_MODAL, None

    modalities = {img.modality for img in images}
    if modalities == {Modality.OPTICAL, Modality.SAR}:
        inferred = CROSS_MODAL
    elif Modality.UNKNOWN not in modalities and len(modalities) == 1:
        inferred = BITEMPORAL
    else:
        inferred = None  # sensor not recorded: can't tell before/after from optical/SAR

    if expected and inferred and expected != inferred:
        return None, (
            "INCOMPATIBLE_REQUEST",
            f"The requested analysis needs {routing.INPUT_REQUIREMENT_TEXT[expected]}, "
            f"but the images look like {routing.INPUT_REQUIREMENT_TEXT[inferred]}.",
        )
    config = inferred or expected
    if expected == CROSS_MODAL and Modality.UNKNOWN in modalities:
        # Can't tell which image is SAR without recorded modality.
        config = None
    if not config:
        return None, (
            "INPUT_AMBIGUOUS",
            "Two images were provided but their sensor/modality is not recorded, so it is "
            "unclear whether they are a before/after pair or an optical+SAR pair.",
        )
    return config, None


def _assign_temporal_roles(images: list[ImageRef]) -> list[str]:
    if all(img.acquisition_date for img in images):
        images.sort(key=lambda img: img.acquisition_date or "")
        warnings = []
    else:
        warnings = ["Acquisition dates missing; T1/T2 order taken from upload order."]
    images[0].role, images[1].role = ImageRole.T1, ImageRole.T2
    return warnings


def _assign_cross_modal_roles(images: list[ImageRef]) -> None:
    if {img.role for img in images} == {ImageRole.OPTICAL, ImageRole.SAR}:
        return
    for img in images:
        img.role = ImageRole.SAR if img.modality == Modality.SAR else ImageRole.OPTICAL


# ---------------------------------------------------------------------------
# 2. route: which task does this request resolve to, and can we run it?
# ---------------------------------------------------------------------------
def route(
    state: OrchestratorState,
    *,
    registry: ModelRegistry,
    classifier: IntentClassifier | None,
) -> dict[str, Any]:
    node = "route"
    config = state["input_config"]
    candidates = routing.TASKS_FOR_INPUT[config]
    requested = _requested_task(state)
    trace: dict[str, Any] = {"candidates": [t.value for t in candidates]}

    task: TaskType | None = None
    if requested:
        if requested not in candidates:
            needs = routing.INPUT_REQUIREMENT_TEXT[routing.input_config_for_task(requested)]
            return {"errors": [_error(node, "INCOMPATIBLE_REQUEST",
                                      f"'{requested.value}' needs {needs}; "
                                      f"received {routing.INPUT_REQUIREMENT_TEXT[config]}.")]}
        task, trace["decided_by"] = requested, "explicit_request"

    if task is None and classifier is not None and len(candidates) > 1:
        try:
            choice = classifier.classify(state["user_query"], candidates)
        except Exception as exc:  # noqa: BLE001 - a broken classifier must not kill the job
            logger.exception("Intent classifier %s failed", classifier.name)
            trace["classifier_error"] = str(exc)
            choice = None
        if choice in candidates:
            task, trace["decided_by"] = choice, f"classifier:{classifier.name}"
        elif choice is not None:
            trace["classifier_rejected"] = str(choice)

    if task is None:
        task, trace["decided_by"] = routing.DEFAULT_TASK_FOR_INPUT[config], "input_default"

    plan = routing.TASK_PLANS[task]
    unavailable = [step.value for step in plan if not registry.has(step)]
    if unavailable:
        return {
            "task_type": task.value,
            "plan": [s.value for s in plan],
            "errors": [_error(node, "MODEL_NOT_AVAILABLE",
                              f"No model is configured yet for: {', '.join(unavailable)}. "
                              "The request was understood but cannot be executed.")],
            "trace": [_trace(node, task=task.value, **trace)],
        }

    return {
        "task_type": task.value,
        "plan": [s.value for s in plan],
        "step_index": 0,
        "trace": [_trace(node, task=task.value, plan=[s.value for s in plan], **trace)],
    }


# ---------------------------------------------------------------------------
# 3. execute_step: call ONE specialist through the registry.
# ---------------------------------------------------------------------------
def execute_step(state: OrchestratorState, *, registry: ModelRegistry) -> dict[str, Any]:
    node = "execute_step"
    index = state.get("step_index", 0)
    task = TaskType(state["plan"][index])
    context = {r["task"]: r["output"] for r in state.get("intermediate_results") or []}

    request = ModelRequest(
        task=task,
        query=state["user_query"],
        images=[ImageRef.model_validate(raw) for raw in state["images"]],
        context=context,
    )
    base = {"step_index": index + 1, "model_input": request.model_dump(mode="json")}

    try:
        service = registry.get(task)
        base["model_to_use"] = service.name
        response = service.predict(request)
    except ModelServiceError as exc:
        return {**base, "errors": [_error(node, exc.code, f"{task.value}: {exc.message}")],
                "trace": [_trace(node, task=task.value, outcome="error", code=exc.code)]}
    except Exception:  # noqa: BLE001 - never let a model crash the graph
        logger.exception("Model for task %s raised unexpectedly", task.value)
        return {**base, "errors": [_error(node, "MODEL_EXECUTION_FAILED",
                                          f"{task.value}: the model failed unexpectedly.")],
                "trace": [_trace(node, task=task.value, outcome="error", code="MODEL_EXECUTION_FAILED")]}

    output = response.model_dump(mode="json")
    return {
        **base,
        "model_output": output,
        "intermediate_results": [{"task": task.value, "output": output}],
        "trace": [_trace(node, task=task.value, model=response.model_name,
                         model_version=response.model_version, outcome="ok")],
    }


# ---------------------------------------------------------------------------
# 4. compose_response: assemble the final answer from model outputs only.
# ---------------------------------------------------------------------------
def compose_response(state: OrchestratorState) -> dict[str, Any]:
    node = "compose_response"
    errors = state.get("errors") or []
    if errors:
        return {"status": "failed", "final_response": None,
                "trace": [_trace(node, outcome="failed", error_codes=[e["code"] for e in errors])]}

    results = state.get("intermediate_results") or []
    if not results:
        err = _error(node, "NO_RESULT", "The graph finished without running any model.")
        return {"status": "failed", "final_response": None, "errors": [err],
                "trace": [_trace(node, outcome="failed")]}

    last = results[-1]["output"]
    final = {
        "task_type": state.get("task_type"),
        "answer": last.get("answer"),  # may be None, e.g. a pure change mask
        "confidence": last.get("confidence"),  # only what the model reported
        "model_name": last.get("model_name"),
        "models_used": [r["output"]["model_name"] for r in results],
        "outputs": {r["task"]: r["output"].get("outputs", {}) for r in results},
        "evidence": [ev for r in results for ev in r["output"].get("evidence", [])],
    }
    return {"status": "completed", "final_response": final,
            "trace": [_trace(node, outcome="completed")]}


# ---------------------------------------------------------------------------
# Edge conditions
# ---------------------------------------------------------------------------
def has_errors(state: OrchestratorState) -> bool:
    return bool(state.get("errors"))


def after_validate(state: OrchestratorState) -> str:
    return "compose_response" if has_errors(state) else "route"


def after_route(state: OrchestratorState) -> str:
    return "compose_response" if has_errors(state) else "execute_step"


def after_execute(state: OrchestratorState) -> str:
    if has_errors(state):
        return "compose_response"
    if state.get("step_index", 0) < len(state.get("plan") or []):
        return "execute_step"
    return "compose_response"
