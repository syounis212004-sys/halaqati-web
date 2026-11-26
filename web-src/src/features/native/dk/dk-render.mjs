/* Halaqati web RC114: DigitalKhatt page geometry and drawing on a Canvas 2D context (port of Android DkRender and SuraOrnament.kt).
   Pure: drawing goes through whatever context object is passed (tests pass a recorder). */
export const AYAH_FIRST = 58193, AYAH_LAST = 58478;
export const HEADER_SCALE = 0.84, HEADER_BASELINE = 0.575;
/** Unicode pause signs U+06D6..U+06DC, rub el hizb U+06DE and sajdah U+06E9 as they appear in the stream. */
export const isSign = (cp) => (cp >= 1750 && cp <= 1756) || cp === 1758 || cp === 1769;

export const lineHeight = (wPx) => wPx * 232 / 1440;
export const scaleFor = (page, wPx) => wPx / Math.max(...page.lines.map((l) => l.width));

/** Page size inside an area: the printed text block keeps a 15-row pitch and glyphs are never stretched. */
export function metrics(areaW, areaH, nLines) {
  const rowsPitch = areaH / 15;
  const wPx = Math.min(areaW, rowsPitch / 0.11);
  const pitch = Math.min(rowsPitch, lineHeight(wPx));
  return { wPx, pitch, pageH: pitch * nLines };
}

/** Draws every line with the page's own transform. `pathFor(cp, lt, rt)` gives path commands or null; `check` lets a cancelled render stop at the next line. */
export function drawPage(ctx, pathFor, page, wPx, pitch, colors, check) {
  const s = scaleFor(page, wPx);
  page.lines.forEach((line, li) => {
    if (check) check();
    ctx.save();
    if (line.type === 1) {
      // the sura-name line sits inside its cartouche: a little smaller and raised, so tails stay inside the frame
      ctx.translate(wPx / 2, li * pitch + pitch * HEADER_BASELINE); ctx.scale(HEADER_SCALE, HEADER_SCALE); ctx.translate(wPx / 2, 0);
    } else ctx.translate(wPx, li * pitch + pitch * 0.72);
    ctx.scale(s * line.xscale, -s);
    let pos = -line.x;
    for (const g of line.glyphs) {
      pos -= g.adv;
      const path = pathFor(g.cp, g.lt, g.rt);
      if (!path) continue;
      ctx.fillStyle = line.type === 1 ? colors.header : line.type === 0 && g.cp >= AYAH_FIRST && g.cp <= AYAH_LAST ? colors.ayah : line.type === 0 && isSign(g.cp) ? colors.sign : colors.ink;
      ctx.save(); ctx.translate(pos + g.xo, g.yo); ctx.fill(path); ctx.restore();
    }
    ctx.restore();
  });
}

/** One rectangle {l,t,r,b} per DK word of the text lines (type 0), in reading order, as drawn by drawPage with the same pitch. */
export function wordRects(page, wPx, pitch) {
  const s = scaleFor(page, wPx), out = [];
  page.lines.forEach((line, li) => {
    if (line.type !== 0) return;
    let pos = -line.x, minL = Infinity, maxR = -Infinity, inWord = false;
    const flush = () => {
      if (inWord && minL < maxR) out.push({ l: wPx + minL * s * line.xscale, t: li * pitch, r: wPx + maxR * s * line.xscale, b: (li + 1) * pitch });
      minL = Infinity; maxR = -Infinity; inWord = false;
    };
    for (const g of line.glyphs) {
      if (g.cp === 32) { pos -= g.adv; flush(); continue; }
      const right = pos; pos -= g.adv;
      inWord = true; minL = Math.min(minL, pos); maxR = Math.max(maxR, right);
    }
    flush();
  });
  return out;
}

/** id -> rectangle; words that share an id (a pair DK splits) are joined. Ayah-end markers are not markable and are left out. */
export function rectsById(ids, rects) {
  const m = new Map();
  for (let i = 0; i < Math.min(ids.length, rects.length); i++) {
    if (ids[i].endsWith(':end')) continue;
    const r = rects[i], e = m.get(ids[i]);
    m.set(ids[i], e ? { l: Math.min(e.l, r.l), t: Math.min(e.t, r.t), r: Math.max(e.r, r.r), b: Math.max(e.b, r.b) } : { ...r });
  }
  return m;
}

/** Sura-name cartouche drawn in code (original geometry, no third-party artwork): double rounded frame, an eight-petal rosette at each end and
    small diamonds along both rails. pal = { rangeBg, rule, frame, pageBg } as CSS colours; alpha variants come from `withAlpha`. */
export function drawOrnament(ctx, width, top, h, pal, withAlpha) {
  const left = width * 0.015, w = width * 0.97, a = withAlpha || ((c) => c);
  const rr = (x, y, ww, hh, r) => { // roundRect is missing in older browsers and WebViews: draw the same shape with arcs
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, ww, hh, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath();
  };
  rr(left, top, w, h, h * 0.30); ctx.fillStyle = pal.rangeBg; ctx.fill();
  ctx.lineWidth = Math.max(2, h * 0.05); ctx.strokeStyle = pal.rule; ctx.stroke();
  const inset = h * 0.12;
  rr(left + inset, top + inset, w - 2 * inset, h - 2 * inset, h * 0.20); ctx.lineWidth = Math.max(1, h * 0.022); ctx.strokeStyle = a(pal.frame, 0.55); ctx.stroke();
  const r = h * 0.34;
  for (const cx of [left + h * 0.62, left + w - h * 0.62]) medallion(ctx, cx, top + h / 2, r, pal, a);
  const d = h * 0.055, railTop = top + inset + h * 0.075, railBottom = top + h - inset - h * 0.075, step = h * 0.30;
  for (let x = left + h * 1.32; x <= left + w - h * 1.32; x += step) {
    if (x > left + w * 0.34 && x < left + w * 0.66) continue;
    diamond(ctx, x, railTop, d, a(pal.rule, 0.8)); diamond(ctx, x, railBottom, d, a(pal.rule, 0.8));
  }
}
function diamond(ctx, cx, cy, r, color) {
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function medallion(ctx, cx, cy, r, pal, a) {
  const circle = (rad) => { ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); };
  circle(r); ctx.fillStyle = pal.pageBg; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = pal.rule; ctx.stroke();
  circle(r * 0.82); ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = a(pal.frame, 0.6); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 4);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(r * 0.30, -r * 0.22, r * 0.30, -r * 0.62, 0, -r * 0.74);
    ctx.bezierCurveTo(-r * 0.30, -r * 0.62, -r * 0.30, -r * 0.22, 0, 0);
    ctx.closePath(); ctx.fillStyle = a(pal.frame, i % 2 === 0 ? 0.85 : 0.5); ctx.fill(); ctx.restore();
  }
  circle(r * 0.12); ctx.fillStyle = pal.rule; ctx.fill();
  for (let i = 0; i < 8; i++) {
    const ang = i * Math.PI / 4 + Math.PI / 8;
    ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * r * 0.9, cy + Math.sin(ang) * r * 0.9, r * 0.045, 0, Math.PI * 2); ctx.fillStyle = pal.rule; ctx.fill();
  }
}
