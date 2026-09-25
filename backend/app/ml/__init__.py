"""Specialist model layer (the "doctors").

This package defines HOW the orchestrator talks to a model -- never which
model exists. LangGraph code imports only `contracts` and `registry`; it never
imports torch, transformers, or a checkpoint path.

Adding a real model later:
  1. Implement `ModelService` (see contracts.py) in `app/ml/services/<name>.py`
     -- either loading weights locally, or as a thin HTTP client to a separate
     GPU inference service.
  2. Register it in `registry.build_default_registry()`.
Nothing in `app/orchestrator/` changes.
"""
