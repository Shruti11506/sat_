# ADD to class Settings in backend/app/core/config.py (merge into the CURRENT file):
    # Specialist model inference services (see app/ml/). Empty = that model is
    # not configured, and its tasks report MODEL_NOT_AVAILABLE.
    EARTHMIND_SERVICE_URL: str = ""
    MCD_MAMBA_SERVICE_URL: str = ""
    MODEL_SERVICE_TIMEOUT_S: float = 600.0
