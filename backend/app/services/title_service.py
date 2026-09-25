"""Deterministic conversation-title generation.

Turns a user's first meaningful query into a short, human-readable sidebar
title ("Highlight water bodies" -> "Water Body Detection"). This is plain
keyword matching, NOT a model call -- the repo has no AI layer yet (see
CLAUDE.md). When one exists, `generate_conversation_title` is the single
function to swap for a model-backed version; callers only depend on
"query in, short title (or None) out".

The input is always the user's query text, never a filename: uploaded asset
names must not become conversation titles.
"""
import re

MAX_TITLE_WORDS = 6
MAX_TITLE_CHARS = 48

# Each topic: (key, trigger regex, [(modifier regex, label)], default label,
# short label used in "X & Y Change Detection", default suffix or None).
# Order is only a tie-breaker; multi-topic titles follow the order the topics
# appear in the query.
_TOPICS: list[tuple[str, str, list[tuple[str, str]], str, str, str | None]] = [
    ("water", r"\bwater\b|\blakes?\b|\brivers?\b|\breservoirs?\b|\bndwi\b|\bwetlands?\b",
     [], "Water Body", "Water", "Detection"),
    ("flood", r"\bflood",
     [(r"\brisk\b", "Flood Risk")], "Flood Impact", "Flood", "Analysis"),
    ("fire", r"\bfires?\b|\bwildfires?\b|\bburn(ed|t)?\b",
     [], "Fire", "Fire", "Detection"),
    ("vegetation", r"\bvegetation\b|\bndvi\b|\bcanopy\b|\bforests?\b|\bgreen cover\b",
     [(r"\bhealth\b|\bstress\b|\bndvi\b|\bmoisture\b", "Vegetation Health")],
     "Vegetation", "Vegetation", "Analysis"),
    ("urban", r"\burban\b|\bbuilt[- ]?up\b|\bsprawl\b|\bsettlements?\b|\bcity\b|\bcities\b",
     [(r"\bgrowth\b|\bgrow", "Urban Growth"), (r"\bexpan|\bsprawl\b", "Urban Expansion")],
     "Urban Area", "Urban", "Analysis"),
    ("agriculture", r"\bagricultur|\bcrops?\b|\bfarm|\bcropland",
     [], "Agricultural", "Agricultural", "Analysis"),
    ("road", r"\broads?\b|\bhighways?\b|\bstreets?\b",
     [], "Road Network", "Road", "Detection"),
    ("building", r"\bbuildings?\b|\bstructures?\b|\brooftops?\b",
     [], "Building", "Building", "Detection"),
    ("industrial", r"\bindustr",
     [], "Industrial Area", "Industrial", "Detection"),
    ("landcover", r"\bland[- ]?(cover|use)\b|\blulc\b",
     [], "Land Cover", "Land Cover", "Analysis"),
    ("cloud", r"\bclouds?\b",
     [], "Cloud Cover", "Cloud", "Analysis"),
    ("ship", r"\bships?\b|\bvessels?\b|\bboats?\b",
     [], "Ship", "Ship", "Detection"),
    ("sensor", r"\bsensors?\b|\bcrs\b|\bgsd\b|\bmetadata\b|\bcoordinate reference\b",
     [], "Sensor Metadata", "Sensor", None),
    ("report", r"\breports?\b",
     [], "Scene Report", "Report", None),
    ("describe", r"\bdescri(be|ption)\b|\bcaption\b|\bsummar",
     [], "Scene Description", "Scene", None),
]

# Verb -> suffix override. Anything not listed keeps the topic's default.
_DETECT_RE = re.compile(r"\bdetect(s|ion|ing)?\b")
_ANALYZE_RE = re.compile(
    r"\banaly[sz]\w*|\bassess\w*|\bcalculat\w*|\bmeasur\w*|\bestimat\w*|\bquantif\w*|\bmonitor\w*"
)
_OPTICAL_RE = re.compile(r"\boptical\b|\brgb\b|\bmultispectral\b|\bmulti-spectral\b")
_SAR_RE = re.compile(r"\bsar\b|\bradar\b")
_CHANGE_RE = re.compile(
    r"\bchang(e|es|ed)\b|\bbi-?temporal\b|\bmulti-?temporal\b|\btime[- ]series\b|\bbefore and after\b"
)

# Noise stripped before the generic fallback: filenames, UUIDs, dates, bare numbers.
_FILENAME_RE = re.compile(r"\S+\.(tiff?|geotiff|png|jpe?g|jp2|img|hdf|nc)\b", re.IGNORECASE)
_UUID_RE = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE)
_TOKEN_WITH_DIGIT_OR_UNDERSCORE_RE = re.compile(r"\b\S*[\d_]\S*\b")

_STOPWORDS = {
    "a", "an", "the", "this", "that", "these", "those", "it", "its", "their", "them", "they",
    "in", "on", "of", "for", "to", "from", "with", "within", "into", "by", "at", "as", "and",
    "or", "all", "any", "some", "each", "every", "me", "my", "us", "our", "we", "i", "you",
    "your", "please", "can", "could", "would", "will", "should", "now", "then", "also", "just",
    "is", "are", "was", "were", "be", "been", "do", "does", "did", "there", "here", "what",
    "which", "who", "how", "where", "when", "why", "show", "give", "tell", "find", "identify",
    "highlight", "detect", "analyze", "analyse", "compare", "get", "let", "lets", "using", "use",
    "image", "images", "imagery", "scene", "scenes", "satellite", "picture", "photo", "file",
    "uploaded", "attached", "upload", "area", "areas", "region", "regions", "detail", "details",
    "about", "over", "between", "both", "one", "more", "most", "very", "much", "many",
}

_TRIVIAL_RE = re.compile(
    r"^(hi|hello|hey|yo|ok|okay|thanks|thank you|test|testing|yes|no|sure|hmm+)[\s!.?]*$"
)


def is_meaningful_query(query: str | None) -> bool:
    if not query:
        return False
    text = query.strip().lower()
    if len(re.findall(r"[a-z]", text)) < 3:
        return False
    return not _TRIVIAL_RE.match(text)


def _topic_label(text: str, modifiers: list[tuple[str, str]], default: str) -> str:
    for pattern, label in modifiers:
        if re.search(pattern, text):
            return label
    return default


def _plural(label: str) -> str:
    """Multi-topic titles read better plural: "Water Bodies & Road Networks"."""
    if label.endswith("Body"):
        return label[:-4] + "Bodies"
    if label.endswith(("Network", "Area")):
        return label + "s"
    return label


def _fallback_title(text: str) -> str | None:
    cleaned = _FILENAME_RE.sub(" ", text)
    cleaned = _UUID_RE.sub(" ", cleaned)
    cleaned = _TOKEN_WITH_DIGIT_OR_UNDERSCORE_RE.sub(" ", cleaned)
    words = [w for w in re.findall(r"[a-z][a-z'-]*", cleaned) if w not in _STOPWORDS and len(w) > 2]
    if not words:
        return None
    return " ".join(w.capitalize() for w in words[:4])


def _finalize(title: str) -> str:
    title = re.sub(r"[^\w\s&-]", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    words = title.split(" ")[:MAX_TITLE_WORDS]
    while len(" ".join(words)) > MAX_TITLE_CHARS and len(words) > 2:
        words.pop()
    return " ".join(words)


def generate_conversation_title(query: str | None) -> str | None:
    """Short (2-6 word) title describing the query's intent, or None if the
    query isn't meaningful enough to title a conversation from."""
    if not is_meaningful_query(query):
        return None
    text = query.strip().lower()

    optical = bool(_OPTICAL_RE.search(text))
    sar = bool(_SAR_RE.search(text))
    change = bool(_CHANGE_RE.search(text))

    matched: list[tuple[int, str, str, str | None]] = []  # (position, label, short, suffix)
    for _key, trigger, modifiers, default_label, short, suffix in _TOPICS:
        m = re.search(trigger, text)
        if m:
            matched.append((m.start(), _topic_label(text, modifiers, default_label), short, suffix))
    matched.sort(key=lambda t: t[0])

    if optical and sar:
        title = "Optical vs SAR Change Analysis" if change else "Optical vs SAR Analysis"
    elif change:
        shorts = [short for _, _, short, _ in matched[:2]]
        prefix = " & ".join(shorts)
        if sar and not prefix:
            prefix = "SAR"
        title = f"{prefix} Change Detection".strip()
    elif len(matched) >= 2:
        title = f"{_plural(matched[0][1])} & {_plural(matched[1][1])}"
    elif len(matched) == 1:
        _, label, _, suffix = matched[0]
        if suffix is not None:
            if _DETECT_RE.search(text):
                suffix = "Detection"
            elif _ANALYZE_RE.search(text):
                suffix = "Analysis"
            label = f"{label} {suffix}"
        title = f"SAR {label}" if sar else label
    elif sar:
        title = "SAR Analysis"
    else:
        fallback = _fallback_title(text)
        if fallback is None:
            return None
        title = fallback

    return _finalize(title) or None
