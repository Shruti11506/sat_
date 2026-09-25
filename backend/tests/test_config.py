from pathlib import Path

from app.core.config import BACKEND_ENV_FILE, Settings


def test_env_file_is_backend_dot_env_regardless_of_working_directory(tmp_path, monkeypatch):
    """A relative ".env" made the backend start with no Supabase credentials
    whenever uvicorn was launched from a folder other than backend/ (history
    then failed with SUPABASE_ERROR). The path must be absolute and anchored
    to backend/, so it resolves the same from any working directory."""
    backend_dir = Path(__file__).resolve().parents[1]
    assert BACKEND_ENV_FILE == backend_dir / ".env"
    assert BACKEND_ENV_FILE.is_absolute()

    monkeypatch.chdir(tmp_path)
    assert Path(Settings.model_config["env_file"]) == backend_dir / ".env"
