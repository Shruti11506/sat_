"""The shared notebook every graph node reads from and writes to.

Kept JSON-serialisable (plain dicts/strings, no Pydantic objects, no bytes) so
it can be stored as-is in `analysis_results.raw_output` and, later,
checkpointed by LangGraph.

Fields annotated with `operator.add` are append-only: a node returns
`{"errors": [new_error]}` and LangGraph appends it instead of overwriting.
"""
from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict


class OrchestratorState(TypedDict, total=False):
    # --- inputs (set by the caller) ---
    job_id: str
    user_query: str
    requested_analysis_type: str  # API AnalysisType value; "general_analysis" = let the graph decide
    images: list[dict[str, Any]]  # ImageRef.model_dump() -- pointers, never pixels

    # --- derived by validate_inputs ---
    image_ids: list[str]
    input_config: str  # "single" | "bitemporal" | "cross_modal"
    modality: str  # "optical" | "sar" | "optical+sar" | "unknown"

    # --- derived by route ---
    task_type: str  # the task the user's request resolved to
    plan: list[str]  # ordered TaskType values to execute
    step_index: int

    # --- written by execute_step (latest step) ---
    model_to_use: str
    model_input: dict[str, Any]
    model_output: dict[str, Any]

    # --- accumulated ---
    intermediate_results: Annotated[list[dict[str, Any]], operator.add]
    errors: Annotated[list[dict[str, Any]], operator.add]
    trace: Annotated[list[dict[str, Any]], operator.add]

    # --- written by compose_response ---
    status: str  # "completed" | "failed"
    final_response: dict[str, Any] | None
