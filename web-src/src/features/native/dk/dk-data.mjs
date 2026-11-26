/* Halaqati web RC114: DigitalKhatt page pack, data side (port of Android quran/dk/DkData.kt).
   The pack (glyphs.bin, p1..p604.bin, ids.bin) is generated at build time from a pinned madina.json by scripts/dk/make_dk_assets.py and is NEVER committed:
   its page streams encode the Quran text. Files are gzip data without a .gz suffix and are read with DecompressionStream.
   Rendering follows precomputed/layout.ts of digitalkhatt.org (MIT); glyph outlines come from the Madina font (OFL 1.1). */

export const PACK_DIR = 'dk/';
export const packUrl = (base, name) => `${base}${PACK_DIR}${typeof name === 'number' ? 'p' + name : name}.bin`;

/** gzip bytes (ArrayBuffer) -> parsed JSON. */
export async function gunzipJson(buf) {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
export async function gunzipText(buf) {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** A line is [type, x, xscale, flat] where flat holds 6 numbers per glyph: cp, advance, xOffset, yOffset, leftTatweel, rightTatweel (units of the Madina font, em = 1000). */
export function parsePage(arr) {
  return { lines: arr.map((l) => {
    const flat = l[3], glyphs = [];
    for (let i = 0; i + 5 < flat.length; i += 6) glyphs.push({ cp: flat[i], adv: flat[i + 1], xo: flat[i + 2], yo: flat[i + 3], lt: flat[i + 4], rt: flat[i + 5] });
    const x = l[1], xscale = l[2];
    return { type: l[0], x, xscale, glyphs, width: (x + glyphs.reduce((s, g) => s + g.adv, 0)) * xscale };
  }) };
}

/** glyphs.bin object -> Map<codepoint, {lim, d, ml, xl, mr, xr}>. */
export function parseGlyphs(obj) {
  const m = new Map();
  for (const k of Object.keys(obj)) {
    const g = obj[k];
    m.set(Number(k), { lim: g.lim || null, d: g.d || [], ml: g.ml || null, xl: g.xl || null, mr: g.mr || null, xr: g.xr || null });
  }
  return m;
}

const caches = new WeakMap();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Path commands of a glyph for the given tatweel amounts, interpolated exactly as getGlyphSvg() in digitalkhatt.org layout.ts.
    [['M',x,y], ['C',x1,y1,x2,y2,x,y], ..., ['Z']]; null when the glyph has no outline. Cached per (glyph, lt, rt) in 1/16 steps. */
export function glyphPath(glyphs, cp, ltIn, rtIn) {
  const o = glyphs.get(cp);
  if (!o) return null;
  let cache = caches.get(glyphs);
  if (!cache) caches.set(glyphs, cache = new Map());
  const key = `${cp}|${Math.round(ltIn * 16)}|${Math.round(rtIn * 16)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const lim = o.lim || [0, 0, 0, 0];
  const lt = clamp(ltIn, Math.min(lim[0], lim[1]), Math.max(lim[0], lim[1]));
  const rt = clamp(rtIn, Math.min(lim[2], lim[3]), Math.max(lim[2], lim[3]));
  const ls = lt < 0 && lim[0] !== 0 ? lt / lim[0] : lt > 0 && lim[1] !== 0 ? lt / lim[1] : 0;
  const rs = rt < 0 && lim[2] !== 0 ? rt / lim[2] : rt > 0 && lim[3] !== 0 ? rt / lim[3] : 0;
  const ip = (v, i, j, k) => {
    let x = v;
    if (lt < 0) { if (o.ml) x += (o.ml[i][j][k] - v) * ls; } else if (lt > 0) { if (o.xl) x += (o.xl[i][j][k] - v) * ls; }
    if (rt < 0) { if (o.mr) x += (o.mr[i][j][k] - v) * rs; } else if (rt > 0) { if (o.xr) x += (o.xr[i][j][k] - v) * rs; }
    return x;
  };
  const out = [];
  o.d.forEach((sub, i) => sub.forEach((e, j) => {
    if (e.length === 2) out.push(['M', ip(e[0], i, j, 0), ip(e[1], i, j, 1)]);
    else if (e.length === 6) out.push(['C', ip(e[0], i, j, 0), ip(e[1], i, j, 1), ip(e[2], i, j, 2), ip(e[3], i, j, 3), ip(e[4], i, j, 4), ip(e[5], i, j, 5)]);
  }));
  out.push(['Z']);
  cache.set(key, out);
  return out;
}

/** ids.bin text -> one array of word ids per page (sura:ayah:pos or sura:ayah:end), in reading order. */
export const parseIds = (text) => text.split('\n').map((l) => l.split(',').filter(Boolean));
export function parseWordId(id) {
  const m = /^(\d{1,3}):(\d{1,3}):(\d{1,3})$/.exec(String(id));
  return m ? { surah: +m[1], ayah: +m[2], pos: +m[3] } : null;
}
