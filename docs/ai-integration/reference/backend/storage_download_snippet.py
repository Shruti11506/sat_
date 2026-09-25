# ADD to backend/app/services/storage_service.py (merge into the CURRENT file):
def download_file(client, storage_path: str, bucket: str | None = None) -> bytes:
    """Download an object's bytes. Used by the ML layer to feed model services.

    Raises StorageError on failure. Read-only: never modifies the object.
    """
    bucket = bucket or get_settings().SUPABASE_STORAGE_BUCKET
    try:
        data = client.storage.from_(bucket).download(storage_path)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase Storage download raised for %s/%s", bucket, storage_path)
        raise StorageError("Failed to download the image from Supabase Storage.", code="STORAGE_DOWNLOAD_FAILED") from exc
    if not isinstance(data, (bytes, bytearray)) or not data:
        raise StorageError("Supabase Storage returned no data for the image.", code="STORAGE_DOWNLOAD_FAILED")
    return bytes(data)
