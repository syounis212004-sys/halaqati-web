// DigitalKhatt engine, pure parts (port of Android DkData.kt / DkRender). Synthetic glyphs only: no Quran text in this file.
// Tests marked "real pack" run when web-src/public/dk exists (copied locally; in CI the workflow generates it) and are skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as D from '../src/features/native/dk/dk-data.mjs';
import * as R from '../src/features/native/dk/dk-render.mjs';
import * as E from '../src/features/native/dk/dk-engine.mjs';

/** synthetic lines are written with nested glyphs for readability; the pack stores each line's glyphs as one flat array of 6 numbers per glyph */
const P = (lines) => D.parsePage(lines.map(([t, x, xs, gl]) => [t, x, xs, gl.flat()]));
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-4, `${m}: ${a} vs ${b}`);

test('parsePage: lines, glyphs and the natural width (x + sum of advances) * xscale', () => {
  const page = P([[0, 10, 2, [[65, 100, 1, 2, 0, 0], [66, 50, 0, 0, 0, 0]]], [1, 0, 1, [[67, 200, 0, 0, 0, 0]]]]);
  assert.equal(page.lines.length, 2);
  assert.equal(page.lines[0].type, 0);
  assert.equal(page.lines[0].glyphs[0].cp, 65);
  near(page.lines[0].width, (10 + 150) * 2, 'width line 0');
  near(page.lines[1].width, 200, 'width line 1');
});

test('parseGlyphs keeps the default outline, the limits and the four tatweel masters', () => {
  const m = D.parseGlyphs({ 65: { lim: [-4, 4, -2, 2], d: [[[0, 0], [1, 1, 2, 2, 3, 3]]], ml: [[[0, 0], [2, 2, 3, 3, 4, 4]]], xl: null }, 66: { d: [[[5, 5]]] } });
  assert.equal(m.size, 2);
  assert.deepEqual(m.get(65).lim, [-4, 4, -2, 2]);
  assert.equal(m.get(66).lim, null);
  assert.equal(m.get(66).ml, null);
});

const outline = { lim: [-10, 10, -10, 10], d: [[[0, 0], [10, 10, 20, 20, 30, 30]]], ml: [[[0, 0], [20, 20, 40, 40, 60, 60]]], xl: [[[0, 0], [30, 30, 60, 60, 90, 90]]], mr: null, xr: null };

test('glyphPath with no tatweel is the default outline (M then C then close)', () => {
  const g = new Map([[65, outline]]);
  assert.deepEqual(D.glyphPath(g, 65, 0, 0), [['M', 0, 0], ['C', 10, 10, 20, 20, 30, 30], ['Z']]);
  assert.equal(D.glyphPath(g, 999, 0, 0), null);
});

test('glyphPath interpolates toward the left masters exactly like getGlyphSvg()', () => {
  const g = new Map([[65, outline]]);
  // lt = -5 of lim -10 -> scale 0.5 toward minLeft: 10 + (20-10)*0.5 = 15
  assert.deepEqual(D.glyphPath(g, 65, -5, 0)[1], ['C', 15, 15, 30, 30, 45, 45]);
  // lt = +10 of lim +10 -> scale 1 toward maxLeft: 10 + (30-10) = 30
  assert.deepEqual(D.glyphPath(g, 65, 10, 0)[1], ['C', 30, 30, 60, 60, 90, 90]);
});

test('glyphPath clamps the tatweel to the glyph limits and treats missing masters as no change', () => {
  const g = new Map([[65, outline]]);
  assert.deepEqual(D.glyphPath(g, 65, -99, 0), D.glyphPath(g, 65, -10, 0));
  assert.deepEqual(D.glyphPath(g, 65, 0, 7), D.glyphPath(g, 65, 0, 0));
});

test('glyphPath is cached per glyph and 1/16 tatweel step', () => {
  const g = new Map([[65, outline]]);
  const a = D.glyphPath(g, 65, -5, 0), b = D.glyphPath(g, 65, -5.01, 0);
  assert.equal(a, b);
});

test('pack URLs and the ids parser', () => {
  assert.equal(D.packUrl('x/', 'glyphs'), 'x/dk/glyphs.bin');
  assert.equal(D.packUrl('x/', 12), 'x/dk/p12.bin');
  assert.equal(D.packUrl('x/', 'ids'), 'x/dk/ids.bin');
  assert.deepEqual(D.parseIds('1:1:1,1:1:end\n2:5:3'), [['1:1:1', '1:1:end'], ['2:5:3']]);
  assert.deepEqual(D.parseWordId('2:255:7'), { surah: 2, ayah: 255, pos: 7 });
  assert.equal(D.parseWordId('2:255:end'), null);
});

test('feature switch: on by default, off with ?mushaf=qcf or the stored choice, and storage errors never turn it off', () => {
  const st = (v) => ({ getItem: () => v });
  assert.equal(E.engineEnabled(st(null), ''), true);
  assert.equal(E.engineEnabled(st('qcf'), ''), false);
  assert.equal(E.engineEnabled(st(null), '?a=1&mushaf=qcf'), false);
  assert.equal(E.engineEnabled(st('dk'), '?mushaf=dk'), true);
  assert.equal(E.engineEnabled({ getItem() { throw new Error('blocked'); } }, ''), true);
  assert.equal(E.engineEnabled(null, ''), true);
});

test('pack loader: missing files, a wrong ids.bin or no DecompressionStream all mean "not available" and never throw', async () => {
  assert.equal(await E.createPack({ base: 'x/', fetchImpl: async () => ({ ok: false, status: 404 }) }).available(), false);
  assert.equal(await E.createPack({ base: 'x/', fetchImpl: async () => { throw new Error('offline'); } }).available(), false);
  assert.equal(await E.createPack({ base: 'x/', fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode('<html>spa fallback</html>').buffer }) }).available(), false);
  assert.equal(await E.createPack({ base: 'x/', fetchImpl: null }).available(), false);
});

test('pack loader: a network blip is retried on the next call, a definitive 404 is remembered', async () => {
  const { gzipSync } = await import('node:zlib');
  const ids = gzipSync(Buffer.from(Array.from({ length: 604 }, () => '1:1:1').join('\n')));
  const buf = ids.buffer.slice(ids.byteOffset, ids.byteOffset + ids.byteLength);
  let calls = 0;
  const flaky = E.createPack({ base: 'x/', fetchImpl: async () => { calls++; if (calls === 1) throw new TypeError('network'); return { ok: true, arrayBuffer: async () => buf }; } });
  assert.equal(await flaky.available(), false, 'first call fails');
  assert.equal(await flaky.available(), true, 'the next call tries again and succeeds');
  assert.equal(await flaky.available(), true);
  assert.equal(calls, 2, 'a success is remembered');
  let n404 = 0;
  const gone = E.createPack({ base: 'x/', fetchImpl: async () => { n404++; return { ok: false, status: 404 }; } });
  await gone.available(); await gone.available();
  assert.equal(n404, 1, '404 is definitive and not asked again');
  let n503 = 0;
  const down = E.createPack({ base: 'x/', fetchImpl: async () => { n503++; return { ok: false, status: 503 }; } });
  await down.available(); await down.available();
  assert.equal(n503, 2, 'a server error is retried');
});

test('drawOrnament works without ctx.roundRect (older WebViews) and draws the same frame with arcs', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k === 'roundRect' ? undefined : k in t ? t[k] : (...a) => { calls.push(k); }), set: (t, k, v) => { t[k] = v; return true; } });
  assert.doesNotThrow(() => R.drawOrnament(ctx, 800, 10, 50, { rangeBg: '#eee', rule: '#a00', frame: '#134e4a', pageBg: '#fff' }));
  assert.ok(calls.includes('arcTo') && !calls.includes('roundRect'));
});

test('withAlpha turns #rrggbb into rgba and leaves other colours alone', () => {
  assert.equal(E.withAlpha('#134e4a', 0.5), 'rgba(19,78,74,0.5)');
  assert.equal(E.withAlpha('rgb(1,2,3)', 0.5), 'rgb(1,2,3)');
});

test('gunzipJson reads gzip data without a .gz suffix (DecompressionStream)', async () => {
  const { gzipSync } = await import('node:zlib');
  const buf = gzipSync(Buffer.from(JSON.stringify([1, 2, 3])));
  assert.deepEqual(await D.gunzipJson(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), [1, 2, 3]);
});

// ---------- geometry ----------
const synth = () => P([
  [1, 0, 1, [[70, 400, 0, 0, 0, 0]]],                                                   // sura-name line
  [0, 0, 1, [[71, 100, 0, 0, 0, 0], [32, 20, 0, 0, 0, 0], [72, 80, 0, 0, 0, 0], [73, 60, 0, 0, 0, 0]]], // two words
]);

test('lineHeight, scaleFor', () => {
  near(R.lineHeight(1440), 232, 'lineHeight');
  near(R.scaleFor(synth(), 800), 800 / 400, 'scale = wPx / widest line');
});

test('metrics: the page keeps the 15-row pitch and never gets wider than the area', () => {
  const m = R.metrics(965, 955, 15);
  assert.ok(m.wPx <= 965 && m.pitch <= 955 / 15 + 1e-6);
  assert.ok(Math.abs(m.pageH - m.pitch * 15) < 1e-6);
  const wide = R.metrics(2000, 600, 15);
  assert.ok(wide.wPx <= (600 / 15) / 0.11 + 1e-6, 'width follows the height on wide areas');
});

test('wordRects: one rectangle per word, in reading order, spanning the full line pitch', () => {
  const rects = R.wordRects(synth(), 800, 50);
  assert.equal(rects.length, 2);
  const s = 2;
  // line 1 (li = 1): pos starts at -x = 0; glyph 71 spans [-100, 0]; space; glyph 72 spans [-200,-120]; 73 [-260,-200] -> second word [-260,-120]
  near(rects[0].l, 800 + -100 * s, 'word1 left'); near(rects[0].r, 800, 'word1 right');
  near(rects[1].l, 800 + -260 * s, 'word2 left'); near(rects[1].r, 800 + -120 * s, 'word2 right');
  near(rects[0].t, 50, 'top'); near(rects[0].b, 100, 'bottom');
});

test('rectsById joins words that share an id and leaves ayah ends out', () => {
  const rects = [{ l: 10, t: 0, r: 20, b: 5 }, { l: 22, t: 0, r: 30, b: 5 }, { l: 40, t: 0, r: 50, b: 5 }, { l: 60, t: 0, r: 70, b: 5 }];
  const m = R.rectsById(['1:1:1', '1:1:1', '1:1:end', '1:2:1'], rects);
  assert.deepEqual([...m.keys()], ['1:1:1', '1:2:1']);
  assert.deepEqual(m.get('1:1:1'), { l: 10, t: 0, r: 30, b: 5 });
});

test('isSign covers pause signs, rub el hizb and sajdah only', () => {
  for (const c of [1750, 1753, 1756, 1758, 1769]) assert.ok(R.isSign(c), String(c));
  for (const c of [1757, 1759, 65, 58193]) assert.ok(!R.isSign(c), String(c));
});

// ---------- drawing, against a recording context ----------
function recorder() {
  const log = []; const rec = (name) => (...a) => { log.push([name, ...a]); };
  const ctx = { save: rec('save'), restore: rec('restore'), translate: rec('translate'), scale: rec('scale'), fill: (p) => { log.push(['fill', p, ctx.fillStyle]); } };
  return { ctx, log };
}
const colors = { ink: '#111', header: '#222', ayah: '#333', sign: '#444' };

test('drawPage: text line transform, glyph placement and colours by role', () => {
  const page = P([[0, 0, 1, [[71, 100, 5, 7, 0, 0], [58200, 50, 0, 0, 0, 0], [1756, 40, 0, 0, 0, 0]]]]);
  const { ctx, log } = recorder();
  R.drawPage(ctx, () => 'PATH', page, 300, 40, colors);
  // single line (li 0): translate(wPx, pitch*0.72), scale(s*xscale, -s); s = 300 / (0+190)
  const s = 300 / 190;
  assert.deepEqual(log[0], ['save']);
  assert.deepEqual(log[1], ['translate', 300, 40 * 0.72]);
  near(log[2][1], s, 'sx'); near(log[2][2], -s, 'sy');
  const fills = log.filter((e) => e[0] === 'fill');
  assert.deepEqual(fills.map((f) => f[2]), ['#111', '#333', '#444']);
  // first glyph: pos = -100, translate(pos + xo, yo) = (-95, 7)
  const t = log.filter((e) => e[0] === 'translate');
  assert.deepEqual(t[1], ['translate', -95, 7]);
});

test('drawPage: the sura-name line is scaled by HEADER_SCALE and raised to HEADER_BASELINE, in the header colour', () => {
  const page = P([[1, 0, 1, [[70, 400, 0, 0, 0, 0]]]]);
  const { ctx, log } = recorder();
  R.drawPage(ctx, () => 'P', page, 800, 60, colors);
  const t = log.filter((e) => e[0] === 'translate' || e[0] === 'scale');
  assert.deepEqual(t[0], ['translate', 400, 60 * 0.575]);
  assert.deepEqual(t[1], ['scale', 0.84, 0.84]);
  assert.deepEqual(t[2], ['translate', 400, 0]);
  assert.equal(log.find((e) => e[0] === 'fill')[2], '#222');
});

test('drawPage skips glyphs without an outline and stops at the next line when cancelled', () => {
  const page = P([[0, 0, 1, [[71, 100, 0, 0, 0, 0], [72, 100, 0, 0, 0, 0]]], [0, 0, 1, [[71, 100, 0, 0, 0, 0]]]]);
  const { ctx, log } = recorder();
  let n = 0;
  assert.throws(() => R.drawPage(ctx, (cp) => (cp === 71 ? 'P' : null), page, 200, 30, colors, () => { if (++n > 1) throw new Error('stop'); }), /stop/);
  assert.equal(n, 2);
  assert.equal(log.filter((e) => e[0] === 'fill').length, 1, 'the glyph without an outline was skipped and the second line never drawn');
});

// ---------- real pack ----------
const packDir = new URL('../public/dk/', import.meta.url);
const hasPack = fs.existsSync(new URL('ids.bin', packDir)) && fs.existsSync(new URL('p604.bin', packDir));
const readJson = (n) => JSON.parse(gunzipSync(fs.readFileSync(new URL(n, packDir))).toString('utf8'));

test('real pack: every page has one rectangle per id and ids look like sura:ayah:pos|end', { skip: !hasPack }, () => {
  const ids = D.parseIds(gunzipSync(fs.readFileSync(new URL('ids.bin', packDir))).toString('utf8'));
  assert.equal(ids.length, 604);
  let ends = 0;
  for (let n = 1; n <= 604; n++) {
    const page = D.parsePage(readJson(`p${n}.bin`));
    const rects = R.wordRects(page, 1000, 60);
    assert.equal(rects.length, ids[n - 1].length, `page ${n}: rects vs ids`);
    for (const id of ids[n - 1]) { assert.match(id, /^\d{1,3}:\d{1,3}:(\d{1,3}|end)$/); if (id.endsWith(':end')) ends++; }
  }
  assert.equal(ends, 6236);
});

test('real pack: ayah counts per surah equal the web surah table (ids agree with the existing mushaf ids)', { skip: !hasPack }, async () => {
  const { createRequire } = await import('node:module');
  const S = createRequire(import.meta.url)('../src/features/native/mushaf-state.js');
  const ids = D.parseIds(gunzipSync(fs.readFileSync(new URL('ids.bin', packDir))).toString('utf8')).flat();
  const maxAyah = new Map(); const seen = new Set();
  for (const id of ids) { const [s, a] = id.split(':').map(Number); if (id.endsWith(':end')) maxAyah.set(s, Math.max(maxAyah.get(s) || 0, a)); seen.add(`${s}:${a}`); }
  for (const sr of S.SURAHS) assert.equal(maxAyah.get(sr.id), sr.ayahs, `surah ${sr.id}`);
  assert.equal(seen.size, 6236);
});

test('real pack: the glyph table covers every codepoint the pages use', { skip: !hasPack }, () => {
  const glyphs = D.parseGlyphs(readJson('glyphs.bin'));
  const missing = new Set();
  for (const n of [1, 2, 3, 50, 300, 604]) for (const l of D.parsePage(readJson(`p${n}.bin`)).lines) for (const g of l.glyphs) if (g.cp !== 32 && !glyphs.has(g.cp)) missing.add(g.cp);
  assert.deepEqual([...missing], []);
});
