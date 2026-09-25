"""Wires the nodes into a LangGraph StateGraph.

    START -> validate_inputs -> route -> execute_step --(more steps)--> execute_step
                   |              |            |
                   +--(error)-----+--(error)---+--> compose_response -> END

One generic `execute_step` node dispatches through the model registry, so
adding a specialist never changes this wiring: which model runs is data (the
plan), not graph structure.
"""
from __future__ import annotations

from functools import partial
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.ml.contracts import ImageRef
from app.ml.registry import ModelRegistry, get_registry
from app.orchestrator import nodes
from app.orchestrator.routing import IntentClassifier
from app.orchestrator.state import OrchestratorState


def build_graph(registry: ModelRegistry, classifier: IntentClassifier | None = None):
    graph = StateGraph(OrchestratorState)

    graph.add_node("validate_inputs", nodes.validate_inputs)
    graph.add_node("route", partial(nodes.route, registry=registry, classifier=classifier))
    graph.add_node("execute_step", partial(nodes.execute_step, registry=registry))
    graph.add_node("compose_response", nodes.compose_response)

    graph.add_edge(START, "validate_inputs")
    graph.add_conditional_edges(
        "validate_inputs", nodes.after_validate,
        {"route": "route", "compose_response": "compose_response"},
    )
    graph.add_conditional_edges(
        "route", nodes.after_route,
        {"execute_step": "execute_step", "compose_response": "compose_response"},
    )
    graph.add_conditional_edges(
        "execute_step", nodes.after_execute,
        {"execute_step": "execute_step", "compose_response": "compose_response"},
    )
    graph.add_edge("compose_response", END)

    return graph.compile()


def run_orchestration(
    *,
    job_id: str,
    query: str,
    images: list[ImageRef],
    requested_analysis_type: str = "general_analysis",
    registry: ModelRegistry | None = None,
    classifier: IntentClassifier | None = None,
) -> dict[str, Any]:
    """Run one request through the graph and return the final state.

    The returned dict always has `status` ("completed" | "failed"),
    `final_response` (None on failure), `errors`, and `trace`.
    """
    app = build_graph(registry or get_registry(), classifier)
    initial: OrchestratorState = {
        "job_id": job_id,
        "user_query": query,
        "requested_analysis_type": requested_analysis_type,
        "images": [img.model_dump(mode="json") for img in images],
        "intermediate_results": [],
        "errors": [],
        "trace": [],
    }
    return app.invoke(initial)
