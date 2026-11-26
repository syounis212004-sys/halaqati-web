/* Halaqati web RC114: page-turn motion, port of the graphicsLayer block in Android MushafScreen.kt. Pure: opacity, translateX and scale only.
   The incoming page fades in while the outgoing one fades out and both travel only part of the swipe, so two pages are never seen side by side.
   Reduced motion: no movement, the page swaps at half the distance. Direction follows the layout direction (RTL: the next page is a rightward swipe). */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** offset: pages from the one in view (-1..1); width: px of the page box. */
export function turnStyle(offset, width, rtl, reduced) {
  const a = clamp(Math.abs(offset), 0, 1);
  if (reduced) return { opacity: a < 0.5 ? 1 : 0, translateX: 0, scale: 1 };
  const travel = (rtl ? -1 : 1) * offset * width;
  return { opacity: clamp(1.4 - 1.8 * a, 0, 1), translateX: travel * 0.4 || 0, scale: 0.96 + 0.04 * (1 - a) };
}

/** +1 = next page, -1 = previous, 0 = not a page-turning swipe (too short, or mostly vertical). */
export function swipeDirection(dx, dy, threshold, rtl) {
  if (Math.abs(dx) < threshold || Math.abs(dx) < 1.5 * Math.abs(dy)) return 0;
  const toRight = dx > 0;
  return rtl ? (toRight ? 1 : -1) : (toRight ? -1 : 1);
}

/** Keyframes of a committed turn: `out` is the page leaving, `in` the page arriving (dir +1 = next). */
export function turnKeyframes(dir, width, rtl, reduced) {
  return {
    out: [turnStyle(0, width, rtl, reduced), turnStyle(-dir, width, rtl, reduced)],
    in: [turnStyle(dir, width, rtl, reduced), turnStyle(0, width, rtl, reduced)],
  };
}

export const toCss = (s) => `translate3d(${s.translateX}px,0,0) scale(${s.scale})`;
