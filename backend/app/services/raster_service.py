"""Server-side GeoTIFF reading: a browser-viewable thumbnail + real georeference.

Browsers can't decode TIFF, so for .tif/.tiff uploads this renders a
downscaled PNG and reads the footprint from the file's own CRS/transform.
Everything returned comes from the raster itself -- anything it doesn't carry
(no CRS, no cloud-cover tag) is left None, never estimated. Any failure to
read the file returns None so the upload still succeeds without extras.

No Storage/DB access here; the upload route persists the results.
"""
import logging
import re
import warnings
from dataclasses import dataclass
from typing import Any

import numpy as np
import rasterio
from rasterio.enums import ColorInterp, Resampling
from rasterio.errors import NotGeoreferencedWarning
from rasterio.io import MemoryFile
from rasterio.warp import transform, transform_bounds

logger = logging.getLogger(__name__)

THUMBNAIL_MAX_EDGE = 1024
THUMBNAIL_FILENAME = "thumbnail.png"

# Percentile stretch for non-8-bit data (reflectance, SAR backscatter, DEMs).
STRETCH_LOW, STRETCH_HIGH = 2, 98

# Metadata tags that genuinely carry a scene cloud-cover percentage
# (Sentinel-2 / Landsat product metadata copied into GeoTIFF tags).
CLOUD_COVER_TAGS = ("CLOUD_COVERAGE_ASSESSMENT", "CLOUDY_PIXEL_PERCENTAGE", "CLOUD_COVER", "CLOUDCOVER")


@dataclass
class RasterInfo:
    thumbnail_png: bytes | None
    latitude: float | None
    longitude: float | None
    bbox: dict[str, Any] | None
    cloud_cover: float | None


def thumbnail_path_for(storage_path: str) -> str:
    """Deterministic thumbnail location next to the original: imagery/{uuid}/thumbnail.png.

    Never collides with an original: thumbnails are only made for .tif/.tiff
    uploads, whose own filename can't be thumbnail.png.
    """
    return f"{storage_path.rsplit('/', 1)[0]}/{THUMBNAIL_FILENAME}"


def _pick_bands(src) -> list[int]:
    """1-based band indexes to render: true-colour RGB if identifiable, else grayscale."""
    interp = list(src.colorinterp)
    if all(ci in interp for ci in (ColorInterp.red, ColorInterp.green, ColorInterp.blue)):
        return [interp.index(ci) + 1 for ci in (ColorInterp.red, ColorInterp.green, ColorInterp.blue)]

    # Multi-band Sentinel-2 stacks name their bands (B4/B04 = red, B3 green, B2 blue).
    names = [(d or "").strip().upper() for d in src.descriptions]
    by_band = {}
    for idx, name in enumerate(names, start=1):
        match = re.fullmatch(r"B0?([234])", name)
        if match:
            by_band[match.group(1)] = idx
    if len(by_band) == 3:
        return [by_band["4"], by_band["3"], by_band["2"]]

    if src.count >= 3:
        return [1, 2, 3]
    return [1]  # single band (panchromatic, SAR, one S2 band, DEM)


def _to_uint8(band: np.ma.MaskedArray, stretch: bool) -> np.ndarray:
    if not stretch:
        return np.clip(band.filled(0), 0, 255).astype(np.uint8)
    valid = band.compressed()
    valid = valid[np.isfinite(valid)]
    if valid.size == 0:
        return np.zeros(band.shape, dtype=np.uint8)
    low, high = np.percentile(valid, (STRETCH_LOW, STRETCH_HIGH))
    if high <= low:
        high = low + 1
    scaled = (band.filled(low).astype(np.float64) - low) / (high - low)
    return (np.clip(np.nan_to_num(scaled), 0, 1) * 255).astype(np.uint8)


def _render_thumbnail(src) -> bytes:
    scale = min(1.0, THUMBNAIL_MAX_EDGE / max(src.width, src.height))
    out_h, out_w = max(1, round(src.height * scale)), max(1, round(src.width * scale))
    bands = _pick_bands(src)

    # Nearest, not average: ~15x faster on large strip-organised TIFFs (0.14s
    # vs 2s for 105 Mpx), which keeps this cheap enough to run in the request.
    data = src.read(bands, out_shape=(len(bands), out_h, out_w), masked=True, resampling=Resampling.nearest)
    stretch = src.dtypes[bands[0] - 1] != "uint8"
    channels = [_to_uint8(data[i], stretch) for i in range(len(bands))]

    # Nodata / masked pixels become transparent instead of black.
    valid = ~np.ma.getmaskarray(data).any(axis=0)
    if not valid.all():
        channels.append(np.where(valid, 255, 0).astype(np.uint8))

    stacked = np.stack(channels)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", NotGeoreferencedWarning)
        with MemoryFile() as mem:
            with mem.open(driver="PNG", width=out_w, height=out_h, count=stacked.shape[0], dtype="uint8") as dst:
                dst.write(stacked)
            return mem.read()


def _georeference(src) -> tuple[float | None, float | None, dict[str, Any] | None]:
    if src.crs is None:
        return None, None, None
    west, south, east, north = transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
    center_x = (src.bounds.left + src.bounds.right) / 2
    center_y = (src.bounds.bottom + src.bounds.top) / 2
    lons, lats = transform(src.crs, "EPSG:4326", [center_x], [center_y])
    if not np.isfinite([west, south, east, north, lons[0], lats[0]]).all():
        return None, None, None  # footprint outside the CRS's valid area
    bbox = {
        "west": west,
        "south": south,
        "east": east,
        "north": north,
        "crs": "EPSG:4326",
        "source_crs": src.crs.to_string(),
    }
    return lats[0], lons[0], bbox


def _cloud_cover(src) -> float | None:
    tags = {key.upper(): value for key, value in src.tags().items()}
    for key in CLOUD_COVER_TAGS:
        if key in tags:
            try:
                value = float(tags[key])
            except (TypeError, ValueError):
                continue
            if 0 <= value <= 100:
                return value
    return None


def extract(content: bytes) -> RasterInfo | None:
    """Thumbnail + georeference for a TIFF's bytes, or None if it can't be read.

    CPU-bound -- call it from a worker thread in async routes.
    """
    try:
        with MemoryFile(content) as mem, mem.open() as src:
            try:
                thumbnail = _render_thumbnail(src)
            except Exception:  # noqa: BLE001 - a readable header with unrenderable pixels still has coords
                logger.warning("Could not render a thumbnail for an uploaded TIFF", exc_info=True)
                thumbnail = None
            try:
                latitude, longitude, bbox = _georeference(src)
            except Exception:  # noqa: BLE001
                logger.warning("Could not reproject an uploaded TIFF's bounds to WGS84", exc_info=True)
                latitude, longitude, bbox = None, None, None
            return RasterInfo(
                thumbnail_png=thumbnail,
                latitude=latitude,
                longitude=longitude,
                bbox=bbox,
                cloud_cover=_cloud_cover(src),
            )
    except rasterio.errors.RasterioError:
        logger.warning("Uploaded TIFF could not be parsed; storing it without a thumbnail or coordinates")
        return None
    except Exception:  # noqa: BLE001 - never let raster parsing break an upload
        logger.exception("Unexpected error while reading an uploaded TIFF")
        return None
