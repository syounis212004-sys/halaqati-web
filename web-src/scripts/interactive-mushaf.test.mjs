/* Interactive mushaf («المصحف» tab of the Quran-range picker in native/roster.js).
   Engine + loader behaviour tests (node:test, no browser, no network) and contract checks that the picker is really wired to the component.
   Fixtures use neutral placeholder words on purpose: no Quran text is stored in this repository. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const read = p => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');

// the page layout map shipped with the app (ayah -> page) is real data used by the existing quran calculator
const layoutCtx = {}; layoutCtx.window = layoutCtx; vm.createContext(layoutCtx);
vm.runInContext(fs.readFileSync(new URL('../public/core/quran-layout.js', import.meta.url), 'utf8'), layoutCtx);
globalThis.HALAQATI_QURAN_LAYOUT = layoutCtx.HALAQATI_QURAN_LAYOUT;
const S = require('../src/features/native/mushaf-state.js');

test('marks: add, replace, toggle-off and clear report the counter deltas the picker applies', () => {
  const s = S.createMushafSession({ initialPage: 42 });
  assert.deepEqual(s.toggleMark('2:254', 'mistake', 42).delta, { mist: 1, prompt: 0, tajweed: 0 });
  assert.deepEqual(s.toggleMark('2:254', 'prompt', 42).delta, { mist: -1, prompt: 1, tajweed: 0 }, 'a replaced mark moves the count');
  assert.deepEqual(s.toggleMark('2:254', 'prompt', 42).delta, { mist: 0, prompt: -1, tajweed: 0 }, 'same type again removes it');
  s.toggleMark('2:255', 'mistake', 42); s.toggleMark('2:256', 'prompt', 42);
  assert.deepEqual(s.getCounts(42), { page: { mistakes: 1, prompts: 1, tajweed: 0 }, total: { mistakes: 1, prompts: 1, tajweed: 0 } });
  assert.equal(s.clearMark('2:255').delta.mist, -1);
  assert.equal(s.clearMark('2:255').action, 'noop', 'clearing twice is a no-op');
  assert.throws(() => s.toggleMark('999:1', 'mistake'), /Invalid ayah_key/);
  assert.throws(() => s.toggleMark('2:255', 'bogus'), /Invalid mark type/);
});

test('the engine never writes to storage and has no draft API (marks live only in the session object)', () => {
  const src = read('features/native/mushaf-state.js') + read('features/native/mushaf.js');
  assert.doesNotMatch(src, /localStorage|sessionStorage|setItem\(|indexedDB/);
  assert.equal(S.buildDraftKey, undefined);
  assert.equal(S.createMushafSession({}).clearDraft, undefined);
});

test('page mapping uses the shipped layout: known ayahs land on their Madinah pages', () => {
  assert.equal(S.resolvePageForAyah(1, 1), 1);
  assert.equal(S.resolvePageForAyah(2, 255), 42);
  assert.equal(S.resolvePageForAyah(112, 1), 604);
  assert.equal(S.clampPage(0), 1); assert.equal(S.clampPage('9999'), 604); assert.equal(S.clampPage('x'), 1);
});

test('range taps: ascending order is normalised, a reverse-direction memorisation range keeps the order of the taps', () => {
  const a = S.createMushafSession({});
  assert.equal(a.selectRangeAyah(114, 6).complete, false);
  assert.deepEqual(a.selectRangeAyah(112, 1), { complete: true, startSurah: 112, startAyah: 1, endSurah: 114, endAyah: 6 }, 'swapped to ascending by default');
  const b = S.createMushafSession({});
  b.selectRangeAyah(114, 6);
  const r = b.selectRangeAyah(112, 1, { keepSurahOrder: true });
  assert.deepEqual([r.startSurah, r.startAyah, r.endSurah, r.endAyah], [114, 6, 112, 1], 'reverse direction keeps An-Nas -> Al-Ikhlas');
  const c = S.createMushafSession({});
  c.selectRangeAyah(2, 20);
  assert.deepEqual([c.selectRangeAyah(2, 10, { keepSurahOrder: true }).startAyah], [10], 'same surah is always ascending even with keepSurahOrder');
  assert.equal(S.isAyahInRange(2, 255, { startSurah: 2, startAyah: 250, endSurah: 3, endAyah: 5 }), true);
  assert.equal(S.isAyahInRange(3, 6, { startSurah: 2, startAyah: 250, endSurah: 3, endAyah: 5 }), false);
});

test('tap vs scroll: a quick still tap is a tap, a drag, a long press or a cancelled gesture is not', () => {
  const start = { x: 100, y: 100, t: 0 };
  assert.equal(S.isTapGesture(start, { x: 103, y: 102, t: 150 }), true);
  assert.equal(S.isTapGesture(start, { x: 100, y: 160, t: 150 }), false, 'vertical scroll');
  assert.equal(S.isTapGesture(start, { x: 100, y: 100, t: 900 }), false, 'long press');
  assert.equal(S.isTapGesture(start, { x: 100, y: 100, t: 100, cancelled: true }), false);
});

// ---- loader: the Quran text only ever comes from the API / its cache; failures are reported, never papered over
const apiPage = (n, words = ['w1', 'w2']) => ({ verses: [{ verse_key: n + ':1', juz_number: 1, words: [...words.map((t, i) => ({ char_type_name: 'word', text_uthmani: t, line_number: i + 1 })), { char_type_name: 'end', text_uthmani: '1', line_number: 9 }] }] });
const okRes = body => ({ ok: true, status: 200, json: async () => body, clone() { return okRes(body); } });
const noCache = { open: async () => ({ match: async () => null, put: async () => {} }) };

test('loader: success is normalised (end marker dropped), cached in memory, and fetched once', async () => {
  let calls = 0;
  const L = S.createPageLoader({ fetchImpl: async () => { calls++; return okRes(apiPage(2)); }, cachesImpl: noCache });
  const r = await L.loadPage(2);
  assert.equal(r.ok, true); assert.equal(r.data.verses[0].text, 'w1 w2'); assert.equal(r.data.juz, 1); assert.equal(r.data.source, 'quran-api-v4');
  assert.equal((await L.loadPage(2)).fromCache, true); assert.equal(calls, 1);
});

test('loader: offline / HTTP error / empty page return ok:false and NO text (no built-in fallback text exists)', async () => {
  for (const f of [async () => { throw new TypeError('Failed to fetch'); }, async () => ({ ok: false, status: 503 }), async () => okRes({ verses: [] })]) {
    const r = await S.createPageLoader({ fetchImpl: f, cachesImpl: noCache }).loadPage(42);
    assert.equal(r.ok, false); assert.equal(r.data, undefined); assert.ok(r.error);
  }
  assert.equal(S.SYNTHETIC_PAGES, undefined, 'the hand-typed page texts were removed');
});

test('loader: a hanging request times out instead of loading forever', async () => {
  const f = (_u, o) => new Promise((_res, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const r = await S.createPageLoader({ fetchImpl: f, cachesImpl: noCache, timeoutMs: 30 }).loadPage(7);
  assert.equal(r.ok, false); assert.match(r.error, /مهلة/);
});

test('loader: an offline copy in the Cache API is used without touching the network', async () => {
  const cache = { open: async () => ({ match: async () => ({ json: async () => apiPage(9, ['c1']) }), put: async () => {} }) };
  let calls = 0;
  const r = await S.createPageLoader({ fetchImpl: async () => { calls++; throw new Error('offline'); }, cachesImpl: cache }).loadPage(9);
  assert.equal(r.ok, true); assert.equal(r.data.verses[0].text, 'c1'); assert.equal(calls, 0);
});

test('escaping: hostile text from the API or the page never becomes markup', () => {
  assert.equal(S.escapeHtml('<img src=x onerror=1>"\''), '&lt;img src=x onerror=1&gt;&quot;&#39;');
  const n = S.normalizeApiPageResponse(1, { verses: [{ verse_key: '1:1', words: [{ char_type_name: 'word', text_uthmani: '<b>x</b>' }] }] });
  assert.equal(n.verses[0].text, '<b>x</b>', 'normalisation keeps text raw; the component escapes at render time');
  const comp = read('features/native/mushaf.js');
  assert.match(comp, /H\(v\.text\)/); assert.doesNotMatch(comp, /innerHTML\s*=\s*[^;]*\bv\.text\b(?!\))/);
});

// ---- the real picker is wired to the component (these are contract checks of the integration, the behaviour was run in a browser)
test('roster picker: 5th tab, mount, counters and re-sync of the recording dialog are wired', () => {
  const r = read('features/native/roster.js');
  assert.match(r, /\['mushaf','المصحف','AutoStories'\]/);
  assert.match(r, /NS\.pkMode=m=>\{if\(m==='mushaf'\)/);
  assert.match(r, /M\.mount\(host,\{session:D\.mushaf/);
  assert.match(r, /onMark:d=>\{D\.mistakes=Math\.max\(0,/, 'marks become the mistakes / prompts counters');
  assert.match(r, /if\(R\.rec&&!R\.rec\.saving\)drawRec\(\)/, 'cancelling the picker redraws the recording dialog so counters match the data');
  assert.match(r, /const mushafIdle=/, 'no hidden default range is applied when only marks were made');
});
test('the legacy #reportDlg monkey-patching is gone and the assets are loaded at boot', () => {
  const c = read('features/native/mushaf.js') + read('features/native/mushaf-state.js');
  assert.doesNotMatch(c, /addRecitationRow|setRecMode|openRowMushaf|recitationRows|__halaqatiMushafHooksInstalled/);
  const m = read('main.js');
  assert.match(m, /native-mushaf\.css/); assert.match(m, /nativeMushafStateUrl/); assert.match(m, /nativeMushafUrl/);
  assert.ok(m.indexOf('nativeMushafStateUrl, ') < m.indexOf('nativeMushafUrl, '), 'engine loads before the component');
});
