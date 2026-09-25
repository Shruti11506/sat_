"""Which model serves which task.

The registry is the ONLY place that knows concrete model classes. Today it is
empty because no SatQuery model is integrated yet -- every task reports
MODEL_NOT_AVAILABLE instead of producing an answer. That is intentional: an
empty registry is honest; a placeholder model that returns text is not.
"""
from __future__ import annotations

from functools import lru_cache

from app.ml.contracts import ModelNotAvailableError, ModelService, TaskType


class ModelRegistry:
    def __init__(self) -> None:
        self._services: dict[TaskType, ModelService] = {}

    def register(self, service: ModelService) -> None:
        self._services[service.task] = service

    def has(self, task: TaskType) -> bool:
        return task in self._services

    def get(self, task: TaskType) -> ModelService:
        try:
            return self._services[task]
        except KeyError:
            raise ModelNotAvailableError(
                f"No model is configured for task '{task.value}' yet."
            ) from None

    def available_tasks(self) -> list[TaskType]:
        return list(self._services)


@lru_cache
def get_registry() -> ModelRegistry:
    return build_default_registry()


def build_default_registry() -> ModelRegistry:
    registry = ModelRegistry()
    # Register real services here as they are integrated, e.g.:
    #   from app.ml.services.earthmind_vqa import EarthMindVQAService
    #   registry.register(EarthMindVQAService(...))
    return registry
