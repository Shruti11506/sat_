/**
 * Shared preview-URL logic for locally selected files, used by both
 * LandingHero (initial upload) and Workspace (mid-chat attach) so the same
 * fix lives in one place instead of two copies drifting apart.
 *
 * Browsers cannot render TIFF/GeoTIFF pixels in an <img> tag. Previously
 * both call sites silently substituted a stock sample photo
 * (/assets/optical_satellite.jpg) for these files, which looked like a real
 * preview of the user's own scene. Per CLAUDE.md's own rule ("No fabricated
 * application data in the primary flow"), this shows an honest
 * "preview unavailable" placeholder instead. The uploaded bytes are
 * unaffected either way -- this only changes what the browser displays.
 */

const UNAVAILABLE_PREVIEW_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#0f172a"/>
  <rect x="40" y="40" width="720" height="520" rx="12" fill="none" stroke="#334155" stroke-width="2"/>
  <text x="400" y="280" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="20">Preview unavailable for TIFF / GeoTIFF</text>
  <text x="400" y="312" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="14">Browsers cannot render this format directly.</text>
  <text x="400" y="336" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="14">The file is stored correctly and used for analysis.</text>
</svg>
`)}`;

const TIFF_NAME = /\.tiff?$/i;

/** True when the browser's <img> tag can actually decode this file. */
export function isBrowserRenderableImage(file) {
  return Boolean(file.type?.startsWith('image/')) && !TIFF_NAME.test(file.name);
}

/**
 * Returns a URL safe to hand to <img src=...>: a real object URL for
 * formats the browser can decode, or an honest placeholder otherwise.
 * Never a stand-in that looks like real image content.
 */
export function getFilePreviewUrl(file) {
  return isBrowserRenderableImage(file)
    ? URL.createObjectURL(file)
    : UNAVAILABLE_PREVIEW_SVG;
}

/**
 * Preview for a stored imagery record (upload response, GET /imagery/{id},
 * conversation detail): the PNG thumbnail the backend generated from a TIFF,
 * else the original when the browser can decode it, else the placeholder --
 * never the raw .tif URL, which renders as a broken image.
 */
export function getImageryPreviewUrl(imagery) {
  if (!imagery) return null;
  if (imagery.thumbnail_url) return imagery.thumbnail_url;
  const name = imagery.storage_path || imagery.original_filename || imagery.name || '';
  return TIFF_NAME.test(name) ? UNAVAILABLE_PREVIEW_SVG : imagery.url || null;
}

/**
 * Real georeference read from the file by the backend (scene centre + WGS84
 * bounds), or null when it has none. Nothing is ever estimated client-side.
 */
export function getImageryGeo(imagery) {
  if (!Number.isFinite(imagery?.latitude) || !Number.isFinite(imagery?.longitude)) return null;
  return { latitude: imagery.latitude, longitude: imagery.longitude, bbox: imagery.bbox || null };
}

/**
 * How a TIFF's preview was made, from what the backend read from the file
 * (metadata.raster) -- so a band composite is never taken for true colour --
 * or why there is none. null for formats the browser shows directly.
 */
export function getPreviewNote(imagery) {
  const raster = imagery?.raster || imagery?.metadata?.raster;
  if (!raster) return null;
  if (imagery.preview_status === 'failed' || !raster.preview) {
    return raster.preview_error ? `Preview unavailable: ${raster.preview_error}` : 'Preview unavailable';
  }
  const { mode, bands = [] } = raster.preview;
  const total = raster.properties?.band_count;
  if (mode === 'true_color') return 'Preview: true colour';
  if (mode === 'palette') return 'Preview: colour palette';
  if (mode === 'band_composite') return `Preview: bands ${bands.join('-')} composite, not true colour`;
  return total > 1 ? `Preview: band ${bands[0]} of ${total}, grayscale` : 'Preview: grayscale';
}

/** False for the "preview unavailable" placeholder -- i.e. whether the user sees their real image. */
export function hasRealPreview(previewUrl) {
  return Boolean(previewUrl) && previewUrl !== UNAVAILABLE_PREVIEW_SVG;
}

// Mirrors the backend: storage_service.ALLOWED_EXTENSIONS (minus .webp, which
// the upload screen has never offered) and MAX_UPLOAD_SIZE_MB. The backend
// re-validates everything; this only saves a pointless upload.
const SUPPORTED_NAME = /\.(tiff?|png|jpe?g)$/i;
export const MAX_UPLOAD_MB = 50;

/** Error message for a file the upload would reject, or null when it's fine. */
export function validateSatelliteFile(file) {
  if (!SUPPORTED_NAME.test(file?.name || '')) return 'Unsupported format -- use TIFF / GeoTIFF, PNG or JPEG.';
  if (!file.size) return 'This file is empty.';
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `This file exceeds the ${MAX_UPLOAD_MB} MB upload limit.`;
  return null;
}

/**
 * The chat attachment for an image pair. Top-level imageryId / previewUrl /
 * geo are Image 1's, so everything that handles a single attachment (viewer,
 * query submission) works unchanged; comparisonImageryId is Image 2 and
 * `images` holds both, in order, for the pair bubble.
 */
export function makePairAttachment(images, { pairId = null, conversationId = null } = {}) {
  const [first, second] = images;
  return {
    isPair: true,
    pairId,
    conversationId,
    name: `${first.name} + ${second.name}`,
    imageryId: first.imageryId || null,
    comparisonImageryId: second.imageryId || null,
    previewUrl: first.previewUrl,
    geo: first.geo || null,
    images
  };
}

/** Real file extension for badges -- never hardcode "GeoTIFF". */
export function fileExtensionLabel(filename) {
  return filename?.split('.').pop()?.toUpperCase() || 'FILE';
}
