"""Application configuration, loaded from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "SatQuery Backend"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"

    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""

    # Plain comma-separated string (not list[str]) so pydantic-settings doesn't
    # attempt to JSON-decode it -- see `cors_origins` property below.
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    SUPABASE_STORAGE_BUCKET: str = "Satquery"
    # Supabase's platform-wide default max upload size is 50MB unless a
    # project raises it (Dashboard -> Storage -> Settings) or the bucket sets
    # its own file_size_limit -- the `Satquery` bucket has none configured
    # (confirmed via get_bucket()), so 50 is the real effective limit, not
    # 500. Raise this only after confirming the project's actual configured
    # limit is higher.
    MAX_UPLOAD_SIZE_MB: int = 50

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
