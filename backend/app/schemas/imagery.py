"""Pydantic schemas for the imagery resource."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ImageryCreate(BaseModel):
    """Metadata-only registration -- does NOT upload a file. See ImageryUploadResponse
    for the multipart upload flow (POST /api/v1/imagery/upload), which is the
    path the frontend actually uses."""

    name: str = Field(..., min_length=1, max_length=255)
    source: str | None = Field(default=None, description="e.g. Sentinel-2, Cartosat-3")
    sensor: str | None = Field(default=None, description="e.g. MSI, PAN")
    acquisition_date: datetime | None = None
    storage_path: str | None = Field(default=None, description="Path inside the Supabase Storage bucket")
    bucket: str | None = None
    storage_url: str | None = None
    cloud_cover: float | None = Field(default=None, ge=0, le=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    bbox: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class ImageryCreateResponse(BaseModel):
    id: UUID
    name: str
    status: str = "registered"


class ImageryUploadResponse(BaseModel):
    id: UUID
    name: str
    original_filename: str
    bucket: str
    storage_path: str
    mime_type: str
    file_size: int
    conversation_id: UUID | None = None
    status: str = "registered"


class ImageryOut(BaseModel):
    id: UUID
    name: str
    conversation_id: UUID | None = None
    source: str | None = None
    sensor: str | None = None
    acquisition_date: datetime | None = None
    original_filename: str | None = None
    bucket: str | None = None
    storage_path: str | None = None
    mime_type: str | None = None
    file_size: int | None = None
    storage_url: str | None = None
    url: str | None = Field(
        default=None,
        description="Freshly-resolved signed (private bucket) or public URL, re-computed on every GET.",
    )
    cloud_cover: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    bbox: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None


class ImageryDeleteResponse(BaseModel):
    id: UUID
    status: str = "deleted"
