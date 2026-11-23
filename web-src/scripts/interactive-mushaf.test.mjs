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

test('the engine never writes to storage and has no draft API (marks live only in the session object)', () => {
  const src = read('features/native/mushaf-state.js') + read('features/native/mushaf.js');
  assert.doesNotMatch(src, /localStorage|sessionStorage|setItem\(|indexedDB/);
  assert.equal(S.buildDraftKey, undefined);
  assert.equal(S.createMushafSession({}).clearDraft, undefined);
  assert.deepEqual(S.VALID_MARK_TYPES, ['mistake', 'prompt'], 'tajweed marks are gone: they were never saved anywhere');
});

test('page mapping uses the shipped layout: known ayahs land on their Madinah pages', () => {
  assert.equal(S.resolvePageForAyah(1, 1), 1);
  assert.equal(S.resolvePageForAyah(2, 255), 42);
  assert.equal(S.resolvePageForAyah(112, 1), 604);
  assert.equal(S.clampPage(0), 1); assert.equal(S.clampPage('9999'), 604); assert.equal(S.clampPage('x'), 1);
});

test('a chosen range (from any old picker) contains its ayahs across surahs, and nothing outside', () => {
  const r = { startSurah: 2, startAyah: 250, endSurah: 3, endAyah: 5 };
  assert.equal(S.isAyahInRange(2, 255, r), true);
  assert.equal(S.isAyahInRange(3, 5, r), true);
  assert.equal(S.isAyahInRange(3, 6, r), false);
  assert.equal(S.isAyahInRange(2, 249, r), false);
  assert.equal(S.selectRangeAyah, undefined, 'the range is picked with the old pickers, not by tapping the page');
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
const okRes = body => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), clone() { return okRes(body); } });
const noCache = { open: async () => ({ match: async () => null, put: async () => {} }) };

test('loader: success is normalised (end marker dropped), cached in memory; a page is built from the API pages around it, each fetched once', async () => {
  let calls = 0;
  const L = S.createPageLoader({ fetchImpl: async () => { calls++; return okRes(apiPage(2)); }, cachesImpl: noCache });
  const r = await L.loadPage(2);
  assert.equal(r.ok, true); assert.equal(r.data.verses[0].text, 'w1 w2'); assert.equal(r.data.juz, 1); assert.equal(r.data.source, 'quran-api-v4');
  assert.equal((await L.loadPage(2)).fromCache, true); assert.equal(calls, 3, 'pages 1, 2 and 3');
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
  assert.match(comp, /H\(w\.text\)/); assert.doesNotMatch(comp, /innerHTML\s*=\s*[^;]*\bw\.text\b(?!\))/);
});

// ---- the four old range pickers stay exactly as they were; the mushaf is a separate screen (T1)
test('the old Quran-range picker keeps its four methods and has no mushaf tab or mounting code', () => {
  const r = read('features/native/roster.js'), css = fs.readFileSync(new URL('../src/styles/native-roster.css', import.meta.url), 'utf8');
  assert.match(r, /const tabs=\[\['ayahs','آية','MenuBook'\],\['pages','صفحات','Description'\],\['surahs','سور','FormatListNumbered'\],\['juz','أجزاء','Apps'\]\]/);
  assert.doesNotMatch(r, /\['mushaf','المصحف'/);
  assert.doesNotMatch(r, /mountMushaf|mushafIdle|nrMushaf\b/);
  assert.match(css, /\.nr-modes\{display:grid;grid-template-columns:repeat\(4,1fr\)/);
});
test('the legacy #reportDlg monkey-patching is gone and the assets are loaded at boot', () => {
  const c = read('features/native/mushaf.js') + read('features/native/mushaf-state.js');
  assert.doesNotMatch(c, /addRecitationRow|setRecMode|openRowMushaf|recitationRows|__halaqatiMushafHooksInstalled/);
  const m = read('main.js');
  assert.match(m, /native-mushaf\.css/); assert.match(m, /nativeMushafStateUrl/); assert.match(m, /nativeMushafUrl/);
  assert.ok(m.indexOf('nativeMushafStateUrl, ') < m.indexOf('nativeMushafUrl, '), 'engine loads before the component');
});

test('page data older than a week is refetched (Quran Foundation caching limit); fresh copies are used offline', async () => {
  const body = JSON.stringify(apiPage(9, ['c1']));
  const store = new Map(), cachesImpl = { open: async () => ({ match: async u => store.get(u) || null, put: async (u, r) => { store.set(u, r); } }) };
  let calls = 0; const mk = () => S.createPageLoader({ cachesImpl, fetchImpl: async () => { calls++; return okRes(JSON.parse(body)); }, now: () => clock });
  let clock = 1000000;
  await mk().loadPage(9); assert.equal(calls, 3);
  clock += 6 * 86400000; await mk().loadPage(9); assert.equal(calls, 3, 'fresh copy');
  clock += 2 * 86400000; await mk().loadPage(9); assert.equal(calls, 6, 'stale copies are refetched');
});

test('loader: a verse that runs from one printed page to the next is listed by only one of the two API pages, so a page merges its neighbours (words of other pages dropped, no duplicates)', async () => {
  const w = (pos, line, pg) => ({ position: pos, line_number: line, page_number: pg, char_type_name: 'word', text_uthmani: 'w' + pos, code_v2: 'G' + pos });
  const pages = {
    119: { verses: [{ verse_key: '5:70', words: [w(1, 1, 119)] }] },
    120: { verses: [{ verse_key: '5:76', words: [w(1, 12, 120)] }] },
    121: { verses: [{ verse_key: '5:77', words: [w(1, 13, 120), w(2, 14, 120), w(3, 1, 121)] }] },
    122: { verses: [{ verse_key: '5:90', words: [w(1, 1, 122)] }] }
  };
  const urls = [];
  const L = S.createPageLoader({ cachesImpl: noCache, fetchImpl: async u => { urls.push(u); return okRes(pages[+u.match(/by_page\/(\d+)/)[1]]); } });
  const r = await L.loadPage(120);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.words.map(x => x.id), ['5:76:1', '5:77:1', '5:77:2'], 'the two words of 5:77 that sit on page 120 come from the page-121 response');
  assert.equal(urls.length, 3);
  const r121 = await L.loadPage(121);
  assert.deepEqual(r121.data.words.map(x => x.id), ['5:77:3']);
});

test('loader: if a neighbouring API page cannot be read the page is reported as failed, never drawn with words missing', async () => {
  const ok = okRes(apiPage(5));
  const L = S.createPageLoader({ cachesImpl: noCache, fetchImpl: async u => { if (/by_page\/6\b/.test(u)) throw new TypeError('offline'); return ok; } });
  const r = await L.loadPage(5);
  assert.equal(r.ok, false); assert.equal(r.data, undefined);
});
