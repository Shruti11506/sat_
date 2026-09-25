"""How a request becomes a task.

Routing happens in three layers, strongest first:

1. **Explicit request.** If the API caller asked for a specific analysis type
   (anything other than `general_analysis`), use it, provided the inputs can
   support it.
2. **Intent classifier.** A pluggable component that reads the query and picks
   ONE task from the candidates the inputs allow. Nothing is plugged in yet:
   the choice of routing model (a local LLM, a small fine-tuned classifier...)
   is still open. Because it can only choose from `candidates`, it can never
   route to a tool that doesn't fit the inputs.
3. **Input default.** If neither of the above decides, use the general-purpose
   task for the input configuration (see DEFAULT_TASK_FOR_INPUT). The trace
   records which layer made the decision.

Which tasks are *possible* is decided by the inputs, not by keywords: change
detection needs two acquisitions, optical-SAR analysis needs one of each.
"""
from __future__ import annotations

from typing import Protocol

from app.ml.contracts import TaskType

SINGLE = "single"
BITEMPORAL = "bitemporal"
CROSS_MODAL = "cross_modal"

# Which tasks each input configuration can support at all.
TASKS_FOR_INPUT: dict[str, list[TaskType]] = {
    SINGLE: [TaskType.VQA, TaskType.CAPTIONING, TaskType.REGION_GROUNDING],
    BITEMPORAL: [TaskType.CHANGE_DETECTION, TaskType.CHANGE_VQA],
    CROSS_MODAL: [TaskType.OPTICAL_SAR_ANALYSIS],
}

# The general-purpose task used when nothing more specific decides.
DEFAULT_TASK_FOR_INPUT: dict[str, TaskType] = {
    SINGLE: TaskType.VQA,  # a VLM answering the question covers "what's in this image?"
    BITEMPORAL: TaskType.CHANGE_DETECTION,
    CROSS_MODAL: TaskType.OPTICAL_SAR_ANALYSIS,
}

# API AnalysisType value -> TaskType. `general_analysis` is absent on purpose.
ANALYSIS_TYPE_TO_TASK: dict[str, TaskType] = {
    "vqa": TaskType.VQA,
    "captioning": TaskType.CAPTIONING,
    "scene_description": TaskType.CAPTIONING,
    "region_grounding": TaskType.REGION_GROUNDING,
    "change_detection": TaskType.CHANGE_DETECTION,
    "change_vqa": TaskType.CHANGE_VQA,
    "optical_sar_analysis": TaskType.OPTICAL_SAR_ANALYSIS,
}

# Ordered steps per task. One step each today; a multi-step task is added here
# (e.g. CHANGE_VQA -> [CHANGE_DETECTION, CHANGE_VQA] once the change-VQA model
# is known to consume a change mask) without touching the graph.
TASK_PLANS: dict[TaskType, list[TaskType]] = {task: [task] for task in TaskType}

INPUT_REQUIREMENT_TEXT: dict[str, str] = {
    SINGLE: "one image",
    BITEMPORAL: "two images of the same area from different dates",
    CROSS_MODAL: "one optical and one SAR image of the same area",
}


class IntentClassifier(Protocol):
    """Picks the task a query asks for, from an allowed list.

    Return None when unsure; the router then falls back to the input default.
    Must return a member of `candidates` or None.
    """

    name: str

    def classify(self, query: str, candidates: list[TaskType]) -> TaskType | None: ...


def input_config_for_task(task: TaskType) -> str:
    for config, tasks in TASKS_FOR_INPUT.items():
        if task in tasks:
            return config
    raise ValueError(f"Task {task} is not mapped to an input configuration")
