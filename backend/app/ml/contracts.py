"""The contract between the orchestrator and any specialist model.

Everything here is plain data (Pydantic) plus one abstract base class. It is
deliberately free of torch / Hugging Face imports so the FastAPI process and
the LangGraph graph can import it without pulling in GPU dependencies.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class TaskType(str, Enum):
    """A capability a specialist model provides.

    Distinct from the API's `AnalysisType` on purpose: `AnalysisType` is what a
    client may *ask for* (including `general_analysis`, which means "you
    decide"); `TaskType` is what a model can actually *do*.
    """

    VQA = "vqa"
    CAPTIONING = "captioning"
    REGION_GROUNDING = "region_grounding"
    CHANGE_DETECTION = "change_detection"
    CHANGE_VQA = "change_vqa"
    OPTICAL_SAR_ANALYSIS = "optical_sar_analysis"


class Modality(str, Enum):
    OPTICAL = "optical"  # RGB / multispectral (e.g. Sentinel-2)
    SAR = "sar"  # radar backscatter (e.g. Sentinel-1 VV/VH)
    UNKNOWN = "unknown"  # not recorded on the imagery row


class ImageRole(str, Enum):
    """What an image means *within this request*."""

    SINGLE = "single"
    T1 = "t1"  # earlier acquisition of a bi-temporal pair
    T2 = "t2"  # later acquisition
    OPTICAL = "optical"  # optical half of a co-registered cross-modal pair
    SAR = "sar"  # SAR half of the pair


class ImageRef(BaseModel):
    """A pointer to an image, never the pixels.

    The graph passes storage coordinates (bucket + path), not bytes and not
    signed URLs: bytes would bloat the state, and signed URLs expire. The model
    service resolves the pointer itself, close to where the pixels are used.
    """

    imagery_id: str
    role: ImageRole = ImageRole.SINGLE
    modality: Modality = Modality.UNKNOWN
    bucket: str | None = None
    storage_path: str | None = None
    mime_type: str | None = None
    acquisition_date: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class EvidenceItem(BaseModel):
    """Mirrors the `evidence` table, so outputs persist without translation."""

    evidence_type: str  # e.g. "bbox", "change_mask", "segmentation_mask"
    description: str | None = None
    source_reference: str | None = None  # e.g. storage path of a derived mask
    bbox: dict[str, Any] | None = None
    confidence: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ModelRequest(BaseModel):
    task: TaskType
    query: str
    images: list[ImageRef]
    # Outputs of earlier steps in the same plan, keyed by task value, so a
    # later model (e.g. change VQA) can consume an earlier one's result.
    context: dict[str, Any] = Field(default_factory=dict)
    params: dict[str, Any] = Field(default_factory=dict)


class ModelResponse(BaseModel):
    """What a model returns. Every field must come from the model itself --
    the orchestrator never fills in an answer or a confidence on its behalf."""

    model_name: str
    model_version: str | None = None
    answer: str | None = None
    confidence: float | None = None
    outputs: dict[str, Any] = Field(default_factory=dict)  # structured, task-specific
    evidence: list[EvidenceItem] = Field(default_factory=list)


class ModelServiceError(Exception):
    """Base for errors a model service reports. `code` goes to the job row."""

    code = "MODEL_ERROR"

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class ModelNotAvailableError(ModelServiceError):
    code = "MODEL_NOT_AVAILABLE"


class ModelInputError(ModelServiceError):
    """The request is valid for the graph but this model can't use it
    (wrong band count, unsupported modality, corrupt file...)."""

    code = "MODEL_INPUT_INVALID"


class ModelExecutionError(ModelServiceError):
    """Inference itself failed (CUDA OOM, remote service down, ...)."""

    code = "MODEL_EXECUTION_FAILED"


class ModelService(ABC):
    """One specialist. Implementations live in `app/ml/services/`.

    A service may run the model in-process or forward the request to a
    separate GPU inference service over HTTP -- the orchestrator can't tell
    the difference, which is the point.
    """

    task: TaskType
    name: str
    version: str | None = None
    supported_modalities: frozenset[Modality] = frozenset({Modality.OPTICAL})

    @abstractmethod
    def predict(self, request: ModelRequest) -> ModelResponse:
        """Run inference. Raise a `ModelServiceError` subclass on failure."""
