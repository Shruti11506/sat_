"""Which model serves which task.

The registry is the ONLY place that knows concrete models. A model is
registered only when its inference service URL is configured; otherwise its
tasks report MODEL_NOT_AVAILABLE instead of producing an answer. An empty
registry is honest; a placeholder model that returns text is not.

Current SatQuery models (sat_ml repo):
- EarthMind (4B, and 4B_multi for optical+SAR) -> VQA, captioning,
  region grounding, optical-SAR analysis. One model, several tasks.
- MCD-Mamba -> bi-temporal change detection (binary change mask).
"""
from __future__ import annotations

from functools import lru_cache

from app.ml.contracts import Modality, ModelNotAvailableError, ModelService, TaskType


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


EARTHMIND_TASKS = (TaskType.VQA, TaskType.CAPTIONING, TaskType.REGION_GROUNDING, TaskType.OPTICAL_SAR_ANALYSIS)
MCD_MAMBA_TASKS = (TaskType.CHANGE_DETECTION,)

ALL_MODALITIES = frozenset({Modality.OPTICAL, Modality.SAR, Modality.UNKNOWN})


@lru_cache
def get_registry() -> ModelRegistry:
    from app.core.config import get_settings

    settings = get_settings()
    return build_default_registry(
        earthmind_url=settings.EARTHMIND_SERVICE_URL,
        mcd_mamba_url=settings.MCD_MAMBA_SERVICE_URL,
        timeout_s=settings.MODEL_SERVICE_TIMEOUT_S,
    )


def build_default_registry(
    *,
    earthmind_url: str = "",
    mcd_mamba_url: str = "",
    timeout_s: float = 600.0,
    image_loader=None,
) -> ModelRegistry:
    registry = ModelRegistry()
    if not (earthmind_url or mcd_mamba_url):
        return registry

    from app.ml.services.remote import RemoteModelService, supabase_image_loader

    loader = image_loader or supabase_image_loader

    if earthmind_url:
        for task in EARTHMIND_TASKS:
            registry.register(RemoteModelService(
                task=task, name="EarthMind", base_url=earthmind_url,
                image_loader=loader, supported_modalities=ALL_MODALITIES, timeout_s=timeout_s,
            ))

    if mcd_mamba_url:
        for task in MCD_MAMBA_TASKS:
            registry.register(RemoteModelService(
                task=task, name="MCD-Mamba", base_url=mcd_mamba_url,
                image_loader=loader, supported_modalities=ALL_MODALITIES, timeout_s=timeout_s,
            ))

    return registry
