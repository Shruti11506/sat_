"""Domain-level exceptions mapped to HTTP responses in main.py.

Services raise these instead of HTTPException so they stay decoupled from
FastAPI/HTTP concerns; the route layer (or the global handler) translates
them into the standard ApiResponse error envelope.
"""


class ApiError(Exception):
    def __init__(self, *, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


class NotFoundError(ApiError):
    def __init__(self, code: str, message: str):
        super().__init__(status_code=404, code=code, message=message)


class ValidationAppError(ApiError):
    def __init__(self, code: str, message: str):
        super().__init__(status_code=422, code=code, message=message)


class SupabaseError(ApiError):
    def __init__(self, message: str):
        super().__init__(status_code=500, code="SUPABASE_ERROR", message=message)


class StorageError(ApiError):
    def __init__(self, message: str):
        super().__init__(status_code=500, code="STORAGE_ERROR", message=message)
