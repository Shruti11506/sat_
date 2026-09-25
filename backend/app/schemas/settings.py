"""Pydantic schemas for the Settings page.

The allowed values mirror the CHECK constraints in
migrations/0005_user_settings.sql. PATCH bodies reject unknown fields, so
nothing outside this list can be written.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

Theme = Literal["dark", "light", "system"]
Language = Literal["en"]
SidebarDensity = Literal["comfortable", "compact"]
DataType = Literal["optical_rgb", "multispectral", "sar", "optical_sar"]
AnalysisTask = Literal[
    "scene_description", "vqa", "change_analysis", "water_body_analysis", "land_cover_analysis"
]


class SettingsProfile(BaseModel):
    """Read-only view of the profile; edited through PATCH /profile."""

    display_name: str
    username: str
    avatar_url: str | None = None
    bio: str | None = None


class SettingsPreferences(BaseModel):
    theme: Theme
    language: Language
    sidebar_density: SidebarDensity
    default_data_type: DataType
    default_analysis_task: AnalysisTask


class SettingsNotifications(BaseModel):
    analysis_completion: bool
    product_updates: bool
    usage_alerts: bool


class SettingsPrivacy(BaseModel):
    save_analysis_results: bool
    share_usage_analytics: bool


class SettingsOut(BaseModel):
    profile: SettingsProfile
    preferences: SettingsPreferences
    notifications: SettingsNotifications
    privacy: SettingsPrivacy
    updated_at: datetime | None = None


class SettingsUpdate(BaseModel):
    """PATCH body: send only what changed. Unknown fields are a 422."""

    model_config = ConfigDict(extra="forbid")

    theme: Theme | None = None
    language: Language | None = None
    sidebar_density: SidebarDensity | None = None
    default_data_type: DataType | None = None
    default_analysis_task: AnalysisTask | None = None
    notify_analysis_completion: bool | None = None
    notify_product_updates: bool | None = None
    notify_usage_alerts: bool | None = None
    save_analysis_results: bool | None = None
    share_usage_analytics: bool | None = None
