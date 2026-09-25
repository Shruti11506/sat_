"""Profile / analytics endpoints.

The acting profile always comes from the `CurrentProfile` dependency, which
the server resolves itself -- no route accepts a user or profile id. The
dashboard endpoint returns everything the page needs in one request; the
narrower endpoints return slices of the same aggregation.
"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, UploadFile

from app.schemas.common import ApiResponse
from app.schemas.profile import (
    ActivityOut,
    FeatureUsage,
    ProfileDashboard,
    ProfileInsights,
    ProfileOut,
    ProfileUpdate,
    ProfileUser,
    RecentActivity,
)
from app.services import profile_service

router = APIRouter(prefix="/profile", tags=["Profile"])

CurrentProfile = Annotated[dict, Depends(profile_service.get_current_profile)]


@router.get(
    "/dashboard",
    response_model=ApiResponse[ProfileDashboard],
    summary="Everything the profile page shows, in one request",
)
def get_dashboard(profile: CurrentProfile) -> ApiResponse[ProfileDashboard]:
    return ApiResponse.ok(ProfileDashboard(**profile_service.build_dashboard(profile)))


@router.get("", response_model=ApiResponse[ProfileOut], summary="The current profile and its headline stats")
def get_profile(profile: CurrentProfile) -> ApiResponse[ProfileOut]:
    dashboard = profile_service.build_dashboard(profile)
    return ApiResponse.ok(ProfileOut(user=dashboard["user"], stats=dashboard["stats"]))


@router.patch(
    "",
    response_model=ApiResponse[ProfileUser],
    summary="Update display name, username, headline and/or bio (only the fields sent)",
)
def update_profile(payload: ProfileUpdate, profile: CurrentProfile) -> ApiResponse[ProfileUser]:
    updated = profile_service.update_profile(profile, payload)
    return ApiResponse.ok(ProfileUser(**profile_service.to_public_user(updated)))


@router.post(
    "/avatar",
    response_model=ApiResponse[ProfileUser],
    summary="Upload a new profile photo (JPG/PNG/WEBP, max 5 MB)",
)
async def upload_avatar(profile: CurrentProfile, file: UploadFile = File(...)) -> ApiResponse[ProfileUser]:
    content = await file.read()
    updated = profile_service.set_avatar(
        profile, filename=file.filename or "", content_type=file.content_type, content=content
    )
    return ApiResponse.ok(ProfileUser(**profile_service.to_public_user(updated)))


@router.delete("/avatar", response_model=ApiResponse[ProfileUser], summary="Remove the profile photo")
def delete_avatar(profile: CurrentProfile) -> ApiResponse[ProfileUser]:
    updated = profile_service.remove_avatar(profile)
    return ApiResponse.ok(ProfileUser(**profile_service.to_public_user(updated)))


@router.get("/activity", response_model=ApiResponse[ActivityOut], summary="Queries per day for the heatmap")
def get_activity(profile: CurrentProfile, period: Literal["year"] = "year") -> ApiResponse[ActivityOut]:
    dashboard = profile_service.build_dashboard(profile)
    return ApiResponse.ok(
        ActivityOut(
            period=period,
            start=dashboard["activity_start"],
            end=dashboard["activity_end"],
            activity=dashboard["activity"],
        )
    )


@router.get("/insights", response_model=ApiResponse[ProfileInsights], summary="Query insights")
def get_insights(profile: CurrentProfile) -> ApiResponse[ProfileInsights]:
    return ApiResponse.ok(ProfileInsights(**profile_service.build_dashboard(profile)["insights"]))


@router.get("/features", response_model=ApiResponse[list[FeatureUsage]], summary="Feature usage counts")
def get_features(profile: CurrentProfile) -> ApiResponse[list[FeatureUsage]]:
    return ApiResponse.ok([FeatureUsage(**f) for f in profile_service.build_dashboard(profile)["features"]])


@router.get(
    "/recent-activity",
    response_model=ApiResponse[list[RecentActivity]],
    summary="Latest uploads and queries",
)
def get_recent_activity(profile: CurrentProfile) -> ApiResponse[list[RecentActivity]]:
    items = profile_service.build_dashboard(profile)["recent_activity"]
    return ApiResponse.ok([RecentActivity(**item) for item in items])
