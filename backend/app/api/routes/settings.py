"""Settings endpoints.

The acting profile is resolved server-side (CurrentProfile); no route accepts
a user or profile id. Profile fields are edited through /profile.
"""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas.common import ApiResponse
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services import profile_service, settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])

CurrentProfile = Annotated[dict, Depends(profile_service.get_current_profile)]


@router.get("", response_model=ApiResponse[SettingsOut], summary="The current profile's settings")
def get_settings(profile: CurrentProfile) -> ApiResponse[SettingsOut]:
    row = settings_service.get_settings_row(profile)
    return ApiResponse.ok(SettingsOut(**settings_service.to_out(profile, row)))


@router.patch(
    "",
    response_model=ApiResponse[SettingsOut],
    summary="Update settings (only the fields sent; unknown fields are rejected)",
)
def update_settings(payload: SettingsUpdate, profile: CurrentProfile) -> ApiResponse[SettingsOut]:
    row = settings_service.update_settings(profile, payload)
    return ApiResponse.ok(SettingsOut(**settings_service.to_out(profile, row)))
