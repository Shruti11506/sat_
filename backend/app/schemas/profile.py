"""Pydantic schemas for the profile / analytics page.

Every number here is aggregated from stored rows (profile_dashboard() in
migrations/0004); nothing is estimated or defaulted to a sample value.
"""
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileUser(BaseModel):
    """Public profile fields only -- no storage paths or account internals."""

    id: UUID
    username: str
    display_name: str
    headline: str | None = None
    bio: str | None = None
    plan: str
    avatar_url: str | None = Field(
        default=None, description="Fresh signed URL (private bucket), or null for the initials fallback."
    )
    timezone: str = Field(description="IANA timezone the activity days are bucketed in.")


class ProfileUpdate(BaseModel):
    """PATCH body: only the fields sent are changed. Limits are enforced in the
    service so they map to specific error codes instead of a generic 422."""

    display_name: str | None = Field(default=None, max_length=200)
    username: str | None = Field(default=None, max_length=200)
    headline: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=1000)


class ProfileStats(BaseModel):
    total_queries: int
    scenes_analyzed: int = Field(description="Distinct uploaded scenes that at least one query was submitted against.")
    current_streak: int
    longest_streak: int


class ProfileOut(BaseModel):
    user: ProfileUser
    stats: ProfileStats


class ActivityDay(BaseModel):
    date: date
    query_count: int


class ActivityOut(BaseModel):
    period: str
    start: date
    end: date
    activity: list[ActivityDay]


class ProfileInsights(BaseModel):
    most_used_data_type: str | None = None
    most_common_task: str | None = None
    total_queries: int
    scenes_uploaded: int
    scenes_analyzed: int
    successful_analyses: int
    failed_analyses: int
    pending_analyses: int = Field(description="Queued or processing -- no model runs yet, so this is every query today.")
    active_days: int
    avg_queries_per_active_day: float | None = None


class FeatureUsage(BaseModel):
    feature: str
    query_count: int


class DataTypeUsage(BaseModel):
    data_type: str
    label: str
    scenes: int
    percentage: float = Field(description="Share of uploaded scenes, 0-100.")
    query_count: int


class RecentActivity(BaseModel):
    id: UUID
    kind: str = Field(description='"upload" or "query"')
    activity_type: str
    label: str
    status: str
    created_at: datetime


class ProfileDashboard(BaseModel):
    user: ProfileUser
    stats: ProfileStats
    activity: list[ActivityDay]
    activity_start: date
    activity_end: date
    insights: ProfileInsights
    features: list[FeatureUsage]
    remote_sensing_usage: list[DataTypeUsage]
    recent_activity: list[RecentActivity]
