/* Halaqati web RC114: DigitalKhatt engine, browser side. Loads the generated pack (never committed) and builds one page as a stage:
   a canvas with the sura-name cartouche, one transparent <span class="hm-word" data-wid> per word (the hit layer, which is also the keyboard/screen-reader
   layer and carries the marks), and a canvas with the glyph outlines on top (pointer-events: none). Marks therefore sit under the ink, as on Android.
   No Quran text is held here: the words are drawn from outlines and the overlay has only ids and number-based labels. */
import { packUrl, gunzipJson, gunzipText, parsePage, parseGlyphs, parseIds, parseWordId, glyphPath } from './dk-data.mjs';
import * as R from './dk-render.mjs';

/** Feature switch: DigitalKhatt is the main viewer; `?mushaf=qcf` or localStorage halaqati_mushaf_engine=qcf forces the QCF fallback. */
export const ENGINE_KEY = 'halaqati_mushaf_engine';
export function engineEnabled(storage, search = '') {
  try {
    if (/(^|[?&])mushaf=qcf(&|$)/.test(search)) return false;
    return !(storage && storage.getItem(ENGINE_KEY) === 'qcf');
  } catch (_e) { return true; }
}

/** The pack loader. `fetchImpl` and `base` are injectable for tests; `available()` is resolved once and never throws. */
export function createPack({ base = '', fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null) } = {}) {
  let availableP = null, glyphsP = null, ids = null;
  const pages = new Map();
  const get = async (name) => {
    const r = await fetchImpl(packUrl(base, name)).catch((e) => { e.transient = true; throw e; });
    if (!r.ok) { const e = new Error('dk ' + r.status); e.transient = r.status >= 500 || r.status === 408 || r.status === 429; throw e; }
    return r.arrayBuffer();
  };
  const available = () => availableP || (availableP = (async () => {
    try {
      if (!fetchImpl || typeof DecompressionStream === 'undefined') return false;
      const parsed = parseIds(await gunzipText(await get('ids')));
      if (parsed.length !== 604 || parsed.some((l) => !l.length)) return false;
      ids = parsed; return true;
    } catch (e) { if (e && e.transient) availableP = null; return false; } // only a definitive answer (404, bad file, no DecompressionStream) is remembered; a network blip is retried on the next mount
  })());
  const glyphs = () => glyphsP || (glyphsP = get('glyphs').then(gunzipJson).then(parseGlyphs).catch((e) => { glyphsP = null; throw e; }));
  /** { page: {lines}, ids: [...] } for page n (1..604). */
  const page = (n) => {
    const k = Math.min(604, Math.max(1, Math.trunc(n)));
    if (!pages.has(k)) {
      const p = Promise.all([get(k).then(gunzipJson), available()]).then(([raw, ok]) => { if (!ok) throw new Error('dk pack not available'); return { page: parsePage(raw), ids: ids[k - 1] }; });
      p.catch(() => pages.delete(k));
      pages.set(k, p);
      if (pages.size > 8) pages.delete(pages.keys().next().value);
    }
    return pages.get(k);
  };
  return { available, glyphs, page, prefetch: (n) => { if (n >= 1 && n <= 604) page(n).catch(() => {}); } };
}

const hex = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(String(c).trim()); return m ? [1, 3, 5].map((i) => parseInt(m[1].slice(i - 1, i + 1), 16)) : null; };
/** '#rrggbb' + alpha -> rgba(); anything else is returned unchanged. */
export const withAlpha = (c, a) => { const h = hex(c); return h ? `rgba(${h[0]},${h[1]},${h[2]},${a})` : c; };

const path2d = new WeakMap();
const toPath2D = (cmds) => {
  let p = path2d.get(cmds);
  if (!p) {
    p = new Path2D();
    for (const c of cmds) { if (c[0] === 'M') p.moveTo(c[1], c[2]); else if (c[0] === 'C') p.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); else p.closePath(); }
    path2d.set(cmds, p);
  }
  return p;
};

/** Palette from the mushaf root's own tokens, so light, dark and the page frame stay in one place (native-mushaf.css). */
export function readPalette(el) {
  const cs = getComputedStyle(el), v = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
  const frame = v('--hm-page-frame', '#134e4a');
  return { ink: v('--hm-page-ink', '#1f2a27'), header: frame, ayah: frame, sign: v('--hm-page-rule', '#b45309'), pageBg: v('--hm-page-bg', '#fffcf3'), rangeBg: v('--hm-range-bg', 'rgba(13,148,136,.1)'), rule: v('--hm-page-rule', '#b45309'), frame };
}

/** Builds the stage for one page inside `host` (its content is replaced). areaW/areaH: the box the page may use, in px.
    surahName(id) -> string and juz are only used for labels. Returns { el, lines, rects, wPx, pitch, pageH, redrawText(scale) }. */
export function buildStage({ host, data, glyphs, palette, areaW, areaH, dpr = 1, surahName = () => '', digits = String }) {
  const doc = host.ownerDocument;
  const { wPx: w0, pitch, pageH: ph } = R.metrics(areaW * 0.965, areaH * 0.955, data.page.lines.length);
  const wPx = Math.max(1, Math.floor(w0)), pageH = Math.max(1, Math.ceil(ph));
  const rects = R.rectsById(data.ids, R.wordRects(data.page, wPx, pitch));
  const el = doc.createElement('div');
  el.className = 'hm-dk';
  el.style.width = wPx + 'px'; el.style.height = pageH + 'px'; el.style.fontSize = (pitch * 0.55).toFixed(1) + 'px';
  el.setAttribute('role', 'group');

  const bg = doc.createElement('canvas'); bg.className = 'hm-dk-bg'; bg.setAttribute('aria-hidden', 'true');
  const text = doc.createElement('canvas'); text.className = 'hm-dk-text'; text.setAttribute('aria-hidden', 'true');
  const fit = (cv, scale) => { cv.width = Math.round(wPx * scale); cv.height = Math.round(pageH * scale); cv.style.width = wPx + 'px'; cv.style.height = pageH + 'px'; const c = cv.getContext('2d'); c.setTransform(scale, 0, 0, scale, 0, 0); return c; };
  const bctx = fit(bg, dpr);
  data.page.lines.forEach((l, i) => { if (l.type === 1) R.drawOrnament(bctx, wPx, i * pitch + pitch * 0.06, pitch * 0.88, palette, withAlpha); });
  el.appendChild(bg);

  const lines = [];
  for (const [id, r] of rects) {
    const p = parseWordId(id); if (!p) continue;
    const li = Math.round(r.t / pitch);
    while (lines.length <= li) lines.push({ n: lines.length + 1, kind: 'text', words: [] });
    const label = `كلمة ${digits(p.pos)} من الآية ${digits(p.ayah)} من سورة ${surahName(p.surah)}`;
    lines[li].words.push({ id, surah: p.surah, ayah: p.ayah, pos: p.pos, text: label });
    const s = doc.createElement('span');
    s.className = 'hm-word hm-dkw'; s.setAttribute('role', 'button'); s.setAttribute('lang', 'ar'); s.setAttribute('tabindex', '-1');
    s.setAttribute('data-wid', id); s.setAttribute('aria-label', label);
    s.style.left = r.l.toFixed(1) + 'px'; s.style.top = r.t.toFixed(1) + 'px'; s.style.width = (r.r - r.l).toFixed(1) + 'px'; s.style.height = (r.b - r.t).toFixed(1) + 'px';
    el.appendChild(s);
  }
  const first = el.querySelector('.hm-word'); if (first) first.setAttribute('tabindex', '0');
  text.style.pointerEvents = 'none'; bg.style.pointerEvents = 'none';
  el.appendChild(text);

  const pathFor = (cp, lt, rt) => { const c = glyphPath(glyphs, cp, lt, rt); return c ? toPath2D(c) : null; };
  const redrawText = (scale) => {
    // never ask for a canvas bigger than browsers allow; at 4x on a phone this still keeps the glyph edges sharp
    const s = Math.min(scale, 4096 / Math.max(wPx, pageH));
    const ctx = fit(text, s);
    R.drawPage(ctx, pathFor, data.page, wPx, pitch, palette);
  };
  redrawText(dpr);
  return { el, lines: lines.filter((l) => l.words.length), rects, wPx, pitch, pageH, redrawText };
}
