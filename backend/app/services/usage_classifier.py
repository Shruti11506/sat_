"""Deterministic usage labels for the profile page.

Maps a stored query to the task it asks for ("Water Body Analysis",
"Change Detection", ...) and an uploaded scene to its remote-sensing data
type ("SAR", "Multispectral", ...). This is plain keyword matching over what
the user typed and what the upload carried (filename, sensor, source, MIME
type) -- NOT a model call and NOT an analysis result; the repo has no AI
layer yet (see CLAUDE.md). When real raster metadata exists (e.g. band count
from rasterio), `classify_data_type` is the single function to swap.
"""
import re

# ---- Tasks ------------------------------------------------------------------

TASK_LABELS: dict[str, str] = {
    "change_detection": "Change Detection",
    "water_body": "Water Body Analysis",
    "flood_assessment": "Flood Assessment",
    "building_detection": "Building Detection",
    "land_cover": "Land Cover Analysis",
    "vegetation": "Vegetation Analysis",
    "urban": "Urban Analysis",
    "object_detection": "Object Detection",
    "sensor_metadata": "Sensor Metadata",
    "region_grounding": "Region Grounding",
    "scene_description": "Scene Description",
    "vqa": "VQA",
    "image_analysis": "Image Analysis",
}

# Explicit analysis types the API accepts; general_analysis (what the UI
# sends) falls through to the query text.
_TASK_BY_ANALYSIS_TYPE = {
    "change_detection": "change_detection",
    "change_vqa": "change_detection",
    "captioning": "scene_description",
    "scene_description": "scene_description",
    "vqa": "vqa",
    "region_grounding": "region_grounding",
}

# First match wins, so the more specific topics come first.
_TASK_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("change_detection", re.compile(
        r"\bchang(e|es|ed)\b|\bbi-?temporal\b|\bmulti-?temporal\b|\btime[- ]series\b"
        r"|\bbefore and after\b|\bcompare\b|\bcomparison\b")),
    ("flood_assessment", re.compile(r"\bflood")),
    ("water_body", re.compile(
        r"\bwater\b|\blakes?\b|\brivers?\b|\breservoirs?\b|\bndwi\b|\bwetlands?\b|\bponds?\b")),
    ("building_detection", re.compile(r"\bbuildings?\b|\brooftops?\b|\bstructures?\b|\bhouses?\b")),
    ("land_cover", re.compile(r"\bland[- ]?(cover|use)\b|\blulc\b|\bclassif")),
    ("vegetation", re.compile(
        r"\bvegetation\b|\bndvi\b|\bcanopy\b|\bforests?\b|\bgreen cover\b|\bcrops?\b|\bagricultur")),
    ("urban", re.compile(
        r"\burban\b|\bbuilt[- ]?up\b|\bsprawl\b|\bsettlements?\b|\bcity\b|\bcities\b")),
    ("object_detection", re.compile(
        r"\bships?\b|\bvessels?\b|\bboats?\b|\bvehicles?\b|\bcars?\b|\baircraft\b|\broads?\b"
        r"|\bbridges?\b|\bairports?\b")),
    ("sensor_metadata", re.compile(
        r"\bsensor\b|\bcrs\b|\bgsd\b|\bmetadata\b|\bresolution\b|\bcoordinate reference\b")),
    ("scene_description", re.compile(
        r"\bdescri(be|ption)\b|\bcaption\b|\bsummar|\bwhat is (in|shown)\b|\bexplain\b|\breport\b")),
]

_QUESTION_RE = re.compile(
    r"^(how|what|which|where|when|why|is|are|does|do|can|count)\b|\?\s*$")

# ---- Features (the "Most Used Features" card) --------------------------------
# A query counts toward its task's feature plus any modality it mentions, so
# counts can add up to more than the number of queries.

FEATURE_BY_TASK = {
    "change_detection": "Change Detection",
    "water_body": "Water Body Analysis",
    "flood_assessment": "Water Body Analysis",
    "land_cover": "Land Cover Analysis",
    "scene_description": "Scene Description",
    "vqa": "VQA",
}
DEFAULT_FEATURE = "Image Analysis"

_SAR_QUERY_RE = re.compile(r"\bsar\b|\bradar\b|\bbackscatter\b|\binsar\b")
_MULTISPECTRAL_QUERY_RE = re.compile(
    r"\bmulti-?spectral\b|\bndvi\b|\bndwi\b|\bnir\b|\bswir\b|\bspectral\b|\bbands?\b")

# ---- Data types -------------------------------------------------------------

DATA_TYPE_LABELS: dict[str, str] = {
    "optical_rgb": "Optical / RGB",
    "multispectral": "Multispectral",
    "sar": "SAR",
    "optical_sar": "Optical + SAR",
    "unclassified": "Unclassified",
}
# Display order of the "Remote Sensing Usage" section.
DATA_TYPE_ORDER = ["optical_rgb", "multispectral", "sar", "optical_sar", "unclassified"]

_SAR_SCENE_RE = re.compile(
    r"\b(sar|radar|sentinel ?1|s1[ab]?|risat\w*|eos ?04|grdh?|slc|sigma0|insar|polsar"
    r"|terrasar\w*|iceye|capella|palsar\w*)\b")
_MULTISPECTRAL_SCENE_RE = re.compile(
    r"\b(multi ?spectral|hyperspectral|msi|sentinel ?2|s2[ab]?|landsat ?\d*|l[co]0[89]"
    r"|liss ?\d*|awifs|resourcesat\w*|modis|ndvi|ndwi)\b")
_OPTICAL_SCENE_RE = re.compile(
    r"\b(rgb|optical|true ?colou?r|truecolou?r|cartosat\w*|worldview\w*|pleiades|planetscope)\b")
# 8-bit display formats hold at most three colour bands, so an upload in one
# of these with no other hint is an optical RGB image. GeoTIFFs can hold
# anything and stay "unclassified" without a hint.
_RGB_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def classify_task(query: str | None, analysis_type: str | None = None) -> str:
    """The primary task key (see TASK_LABELS) a query asks for."""
    explicit = _TASK_BY_ANALYSIS_TYPE.get(analysis_type or "")
    if explicit:
        return explicit
    text = (query or "").strip().lower()
    for key, pattern in _TASK_PATTERNS:
        if pattern.search(text):
            return key
    if _QUESTION_RE.search(text):
        return "vqa"
    return "image_analysis"


def features_for_query(query: str | None, analysis_type: str | None = None) -> set[str]:
    text = (query or "").strip().lower()
    features = {FEATURE_BY_TASK.get(classify_task(query, analysis_type), DEFAULT_FEATURE)}
    if analysis_type == "optical_sar_analysis" or _SAR_QUERY_RE.search(text):
        features.add("SAR Analysis")
    if _MULTISPECTRAL_QUERY_RE.search(text):
        features.add("Multispectral Analysis")
    return features


def classify_data_type(
    *,
    name: str | None = None,
    original_filename: str | None = None,
    sensor: str | None = None,
    source: str | None = None,
    mime_type: str | None = None,
) -> str:
    """The data-type key (see DATA_TYPE_LABELS) of an uploaded scene."""
    # Filenames use _ - . as separators ("S1A_IW_GRDH..."), which \b treats as
    # word characters -- normalise everything non-alphanumeric to spaces.
    text = " ".join(filter(None, [name, original_filename, sensor, source])).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    sar = bool(_SAR_SCENE_RE.search(text))
    multispectral = bool(_MULTISPECTRAL_SCENE_RE.search(text))
    optical = bool(_OPTICAL_SCENE_RE.search(text))
    if sar and (multispectral or optical):
        return "optical_sar"
    if sar:
        return "sar"
    if multispectral:
        return "multispectral"
    if optical or (mime_type or "").lower() in _RGB_MIME_TYPES:
        return "optical_rgb"
    return "unclassified"
