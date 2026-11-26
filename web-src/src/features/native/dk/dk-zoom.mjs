/* Halaqati web RC114: pinch zoom (1x to 4x) and pan maths, port of zoomPinch in Android MushafDkPage.kt. Pure. */
export const MIN_ZOOM = 1, MAX_ZOOM = 4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** One zoom step. pan/delta/centroid in px relative to the page box (size = {w,h}); centroid null = zoom about the centre. */
export function pinch({ zoom, pan, size, factor, centroid, delta }) {
  const z0 = zoom, z1 = clamp(z0 * factor, MIN_ZOOM, MAX_ZOOM);
  const centre = { x: size.w / 2, y: size.h / 2 }, c = centroid || centre, k = z1 / z0;
  let x = (c.x - centre.x) * (1 - k) + pan.x * k + delta.x;
  let y = (c.y - centre.y) * (1 - k) + pan.y * k + delta.y;
  const maxX = (z1 - 1) * size.w / 2, maxY = (z1 - 1) * size.h / 2;
  x = clamp(x, -maxX, maxX); y = clamp(y, -maxY, maxY);
  if (z1 <= 1.001) { x = 0; y = 0; }
  return { zoom: z1, pan: { x, y } };
}

/** Two fingers always zoom; one finger pans only while zoomed, only with the tap tool, once it has clearly moved (so taps, long press and highlighting keep working). */
export const shouldPan = ({ zoom, tapToolOnly, travelled, slop, fingers }) => fingers >= 2 || (zoom > 1.02 && tapToolOnly && travelled > slop);

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/** Between two frames of the same two pointers: scale factor, the previous centroid (the zoom anchor) and how far the centroid moved. */
export function twoFingers(prev, now) {
  const pc = mid(prev[0], prev[1]), nc = mid(now[0], now[1]), d0 = dist(prev[0], prev[1]);
  return { factor: d0 > 0 ? dist(now[0], now[1]) / d0 : 1, centroid: pc, delta: { x: nc.x - pc.x, y: nc.y - pc.y } };
}

/** Mouse wheel with Ctrl (also what a trackpad pinch sends) zooms; a plain wheel does not. */
export const wheelFactor = ({ deltaY, ctrlKey }) => (ctrlKey ? Math.exp(-deltaY * 0.002) : 1);
