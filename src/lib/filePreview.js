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

/** Real file extension for badges -- never hardcode "GeoTIFF". */
export function fileExtensionLabel(filename) {
  return filename?.split('.').pop()?.toUpperCase() || 'FILE';
}
