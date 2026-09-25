"""LangGraph orchestration layer (the "brain").

Reads a query + image pointers, decides which specialist task(s) to run,
calls them through `app.ml.registry`, and assembles a response. It contains
no model code and no database code: the caller (a worker) loads the job,
calls `run_orchestration`, and persists what comes back.
"""
from app.orchestrator.graph import build_graph, run_orchestration

__all__ = ["build_graph", "run_orchestration"]
