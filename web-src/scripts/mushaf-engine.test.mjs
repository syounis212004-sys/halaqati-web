/* Interactive mushaf v2 engine: words, 15-line pages, word-level marks with undo/redo.
   Fixtures use neutral placeholder words (no Quran text in the repository). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../src/features/native/mushaf-state.js');

const word = (pos, line, text = 'w' + pos, type = 'word') => ({ position: pos, line_number: line, char_type_name: type, text_uthmani: text, code_v2: (type === 'end' ? 'E' : 'G') + pos, v2_page: 604 });
const verse = (key, words) => ({ verse_key: key, juz_number: 1, words: [...words, word(words.length + 1, words.at(-1).line_number, String(key.split(':')[1]), 'end')] });
// a page like page 604: three short surahs, banner + basmala lines before each, gaps elsewhere
const shortSurahs = () => ({ verses: [
  verse('112:1', [word(1, 3), word(2, 3)]), verse('112:2', [word(1, 4), word(2, 4)]),
  verse('113:1', [word(1, 7), word(2, 7)]), verse('113:2', [word(1, 8), word(2, 8), word(3, 9)]),
  verse('114:1', [word(1, 12), word(2, 12)]),
] });
// a page like page 1: banner line, then the surah starts (its first ayah is the basmala itself), trailing empty lines
const firstPage = () => ({ verses: [verse('1:1', [word(1, 2), word(2, 2)]), verse('1:2', [word(1, 3), word(2, 3)])] });

test('normalize keeps every text word with its line, drops the end marker, flags the first word of each ayah', () => {
  const p = S.normalizeApiPageResponse(604, shortSurahs());
  assert.equal(p.words.length, 11, 'end markers are not words');
  assert.deepEqual(p.words[0], { id: '112:1:1', ayah_key: '112:1', surah: 112, ayah: 1, pos: 1, text: 'w1', glyph: 'G1', fontPage: 604, line: 3, ayahStart: true });
  assert.equal(p.items.length, 16, 'the printed page also draws the ayah-end markers (5 ayahs)');
  assert.deepEqual(p.items.find(i => i.end && i.ayah_key === '112:1'), { id: '112:1:end', ayah_key: '112:1', end: true, glyph: 'E3', fontPage: 604, line: 3 });
  assert.equal(p.words[1].ayahStart, false);
  assert.equal(p.words.find(w => w.id === '113:2:3').line, 9);
  assert.equal(p.verses[0].text, 'w1 w2', 'the ayah text view used elsewhere is unchanged');
});

test('a page always has 15 lines; gaps before a surah start become banner + basmala, other gaps stay empty', () => {
  const lines = S.buildPageLines(S.normalizeApiPageResponse(604, shortSurahs())).lines;
  assert.equal(lines.length, 15);
  assert.deepEqual(lines.map(l => l.kind), ['banner', 'basmala', 'text', 'text', 'banner', 'basmala', 'text', 'text', 'text', 'banner', 'basmala', 'text', 'empty', 'empty', 'empty']);
  assert.equal(lines[0].surah, 112); assert.equal(lines[4].surah, 113); assert.equal(lines[9].surah, 114);
  assert.deepEqual(lines[2].words.map(w => w.id), ['112:1:1', '112:1:2']);
  assert.equal(lines[8].words[0].id, '113:2:3');
});

test('the first page: its first ayah is the basmala, so the line before it is only a banner; trailing lines are empty', () => {
  const lines = S.buildPageLines(S.normalizeApiPageResponse(1, firstPage())).lines;
  assert.equal(lines.length, 15);
  assert.deepEqual(lines.slice(0, 4).map(l => l.kind), ['banner', 'text', 'text', 'empty']);
  assert.equal(lines[0].surah, 1);
  assert.ok(lines.slice(3).every(l => l.kind === 'empty'));
});

test('an ayah continued from the previous page has no banner and keeps its own word ids', () => {
  const p = S.normalizeApiPageResponse(42, { verses: [verse('2:253', [word(5, 1), word(6, 1)]), verse('2:254', [word(1, 2)])] });
  const lines = S.buildPageLines(p).lines;
  assert.equal(lines[0].kind, 'text'); assert.equal(lines[0].words[0].id, '2:253:5');
  assert.equal(lines[0].words[0].ayahStart, false, 'position 5 is not the start of the ayah');
});

// ---- word-level marks, spans, eraser, history
const session = () => S.createMushafSession({ initialPage: 604 });

test('markWord: add, same type removes, other type replaces; the delta is what the recitation counters apply', () => {
  const s = session();
  assert.deepEqual(s.markWord('112:1:1', 'mistake', { page: 604 }).delta, { mist: 1, prompt: 0 });
  assert.deepEqual(s.markWord('112:1:1', 'prompt', { page: 604 }).delta, { mist: -1, prompt: 1 });
  assert.deepEqual(s.markWord('112:1:1', 'prompt', { page: 604 }).delta, { mist: 0, prompt: -1 });
  assert.deepEqual(s.getCounts(604).total, { mistakes: 0, prompts: 0 });
  assert.throws(() => s.markWord('bad id', 'mistake'), /Invalid word id/);
  assert.throws(() => s.markWord('112:1:1', 'nope'), /Invalid mark type/);
});

test('kinds: word by default, harakah on request, invalid kinds rejected', () => {
  const s = session();
  s.markWord('112:1:2', 'mistake', { page: 604, kind: 'harakah' });
  assert.equal(s.getMark('112:1:2').kind, 'harakah');
  s.markWord('112:2:1', 'prompt', { page: 604 });
  assert.equal(s.getMark('112:2:1').kind, 'word');
  assert.throws(() => s.markWord('112:2:2', 'mistake', { kind: 'zzz' }), /Invalid kind/);
});

test('markSpan marks every word once (no toggling), returns the summed delta, and only changes what changed', () => {
  const s = session();
  s.markWord('112:1:2', 'mistake', { page: 604 });
  const r = s.markSpan(['112:1:1', '112:1:2', '112:2:1'], 'mistake', { page: 604 });
  assert.deepEqual(r.delta, { mist: 2, prompt: 0 }, 'the already-marked word adds nothing');
  const r2 = s.markSpan(['112:1:1', '112:1:2'], 'prompt', { page: 604 });
  assert.deepEqual(r2.delta, { mist: -2, prompt: 2 }, 'replacing mistakes with prompts moves the counts');
});

test('eraseWords removes only marked words and reports the delta', () => {
  const s = session();
  s.markSpan(['112:1:1', '112:1:2'], 'mistake', { page: 604 }); s.markWord('112:2:1', 'prompt', { page: 604 });
  const r = s.eraseWords(['112:1:2', '112:2:1', '112:2:2']);
  assert.deepEqual(r.delta, { mist: -1, prompt: -1 });
  assert.equal(s.getMark('112:1:1').type, 'mistake'); assert.equal(s.getMark('112:1:2'), null);
});

test('undo and redo walk the history and return the opposite delta, including after a page change', () => {
  const s = session();
  s.markWord('112:1:1', 'mistake', { page: 604 });
  s.markSpan(['112:2:1', '112:2:2'], 'prompt', { page: 604 });
  s.setPage(603);
  assert.deepEqual(s.undo().delta, { mist: 0, prompt: -2 });
  assert.deepEqual(s.undo().delta, { mist: -1, prompt: 0 });
  assert.equal(s.undo(), null, 'nothing left to undo');
  assert.deepEqual(s.redo().delta, { mist: 1, prompt: 0 });
  assert.deepEqual(s.redo().delta, { mist: 0, prompt: 2 });
  assert.equal(s.redo(), null);
  assert.equal(s.canUndo(), true); assert.equal(s.canRedo(), false);
  s.undo(); s.markWord('112:4:1', 'mistake', { page: 604 });
  assert.equal(s.canRedo(), false, 'a new action drops the redo branch');
});

test('a no-op never enters the history, and counts per page follow the mark page', () => {
  const s = session();
  assert.equal(s.eraseWords(['112:1:1']).delta.mist, 0);
  assert.equal(s.canUndo(), false);
  s.markWord('112:1:1', 'mistake', { page: 604 }); s.markWord('2:255:3', 'prompt', { page: 42 });
  assert.deepEqual(s.getCounts(604).page, { mistakes: 1, prompts: 0 });
  assert.deepEqual(s.getCounts(42).page, { mistakes: 0, prompts: 1 });
  assert.deepEqual(s.getCounts(42).total, { mistakes: 1, prompts: 1 });
});

test('exportPayload lists marks with word, kind and type in reading order', () => {
  const s = session();
  s.markWord('113:1:2', 'prompt', { page: 604 }); s.markWord('112:1:1', 'mistake', { page: 604, kind: 'harakah' });
  const e = s.exportPayload();
  assert.deepEqual(e.marks.map(m => [m.ayah_key, m.word, m.type, m.kind]), [['112:1', 1, 'mistake', 'harakah'], ['113:1', 2, 'prompt', 'word']]);
  assert.equal(e.mistakes, 1); assert.equal(e.prompts, 1);
});

// ---- pure helpers used by the page component
test('spanBetween: reading order across lines, either drag direction, unknown ids give nothing', () => {
  const lines = S.buildPageLines(S.normalizeApiPageResponse(604, shortSurahs())).lines;
  assert.deepEqual(S.spanBetween(lines, '112:1:2', '112:2:1'), ['112:1:2', '112:2:1']);
  assert.deepEqual(S.spanBetween(lines, '112:2:1', '112:1:2'), ['112:1:2', '112:2:1'], 'dragging backwards gives the same span');
  assert.deepEqual(S.spanBetween(lines, '112:1:1', '113:2:3').length, 9, 'crosses the banner lines without including them');
  assert.deepEqual(S.spanBetween(lines, '113:1:1', '113:1:1'), ['113:1:1']);
  assert.deepEqual(S.spanBetween(lines, '1:1:1', '112:1:1'), []);
});

test('keyboard map: 1/2 type, T/H/E tools, Ctrl+Z undo, Ctrl+Shift+Z or Ctrl+Y redo, arrows move; other keys and other modifiers do nothing', () => {
  assert.deepEqual(S.shortcutAction({ key: '1' }), { type: 'type', value: 'mistake' });
  assert.deepEqual(S.shortcutAction({ key: '2' }), { type: 'type', value: 'prompt' });
  assert.deepEqual(S.shortcutAction({ key: 'h' }), { type: 'tool', value: 'highlight' });
  assert.deepEqual(S.shortcutAction({ key: 'T' }), { type: 'tool', value: 'tap' });
  assert.deepEqual(S.shortcutAction({ key: 'e' }), { type: 'tool', value: 'erase' });
  assert.deepEqual(S.shortcutAction({ key: 'z', ctrlKey: true }), { type: 'undo' });
  assert.deepEqual(S.shortcutAction({ key: 'Z', ctrlKey: true, shiftKey: true }), { type: 'redo' });
  assert.deepEqual(S.shortcutAction({ key: 'y', metaKey: true }), { type: 'redo' });
  assert.deepEqual(S.shortcutAction({ key: 'ArrowLeft' }), { type: 'move', value: 'next' }, 'RTL: left is the next word');
  assert.deepEqual(S.shortcutAction({ key: 'ArrowRight' }), { type: 'move', value: 'prev' });
  assert.deepEqual(S.shortcutAction({ key: 'ArrowDown' }), { type: 'move', value: 'down' });
  assert.deepEqual(S.shortcutAction({ key: 'ArrowUp' }), { type: 'move', value: 'up' });
  assert.equal(S.shortcutAction({ key: '1', altKey: true }), null);
  assert.equal(S.shortcutAction({ key: 'x' }), null);
});

test('undo/redo report the page of the mark they changed so the view can follow', () => {
  const s = session();
  s.markWord('112:1:1', 'mistake', { page: 604 }); s.setPage(603);
  assert.equal(s.undo().page, 604); assert.equal(s.redo().page, 604);
});

test('a non-contiguous surah selection highlights only the chosen surahs', () => {
  const r = { startSurah: 2, endSurah: 5, selectedSurahs: [2, 5] };
  assert.equal(S.isAyahInRange(3, 1, r), false); assert.equal(S.isAyahInRange(5, 1, r), true);
});

test('each line keeps the words for marking and also the ayah-end markers for drawing, in print order', () => {
  const lines = S.buildPageLines(S.normalizeApiPageResponse(604, shortSurahs())).lines;
  assert.deepEqual(lines[2].items.map(i => i.glyph), ['G1', 'G2', 'E3']);
  assert.deepEqual(lines[2].words.map(w => w.id), ['112:1:1', '112:1:2'], 'markers are never markable words');
  assert.equal(S.spanBetween(lines, '112:1:2', '112:2:1').length, 2, 'a span never contains a marker');
});

test('layout facts: pages 1-2 are the 8-line opening pages; centred short lines come from the print layout table', () => {
  assert.equal(S.isOpeningPage(1), true); assert.equal(S.isOpeningPage(2), true); assert.equal(S.isOpeningPage(3), false);
  assert.equal(S.isCenteredLine(604, 4), true); assert.equal(S.isCenteredLine(602, 15), true);
  assert.equal(S.isCenteredLine(604, 3), false); assert.equal(S.isCenteredLine(3, 5), false);
  assert.equal(S.isCenteredLine(1, 5), true, 'opening pages are fully centred');
});

test('overflowScale: only a line wider than the page is made smaller, by one ratio (no per-line tuning of fitting lines)', () => {
  assert.equal(S.overflowScale(290, 300), 1); assert.equal(S.overflowScale(300, 300), 1);
  assert.equal(S.overflowScale(330, 300), 0.9); // 300 * 0.99 / 330
  assert.equal(S.overflowScale(100, 0), 1);
});

const fontFace = () => { const made = []; class FF { constructor(fam, src) { this.family = fam; this.src = src; made.push(this); } async load() { return this; } } return { FF, made }; };
const fakeFonts = () => { const set = new Set(); return { set, add: f => set.add(f), delete: f => set.delete(f) }; };
const okBin = () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8), clone() { return okBin(); } });
const memCaches = () => { const m = new Map(); return { m, open: async () => ({ match: async u => m.get(u) || null, put: async (u, r) => { m.set(u, r); } }) }; };

test('font loader: fetches a page font from the official CDN once, keeps a copy for offline, and registers it under its own family', async () => {
  const { FF, made } = fontFace(), fonts = fakeFonts(), caches = memCaches(); let calls = [];
  const L = S.createFontLoader({ fetchImpl: async u => { calls.push(u); return okBin(); }, cachesImpl: caches, FontFaceImpl: FF, fontsImpl: fonts });
  assert.equal((await L.loadPageFont(3)).family, 'qcf-v2-p3');
  assert.deepEqual(calls, ['https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p3.woff2']);
  await L.loadPageFont(3); assert.equal(calls.length, 1, 'already registered');
  const L2 = S.createFontLoader({ fetchImpl: async () => { throw new Error('offline'); }, cachesImpl: caches, FontFaceImpl: FF, fontsImpl: fakeFonts() });
  assert.equal((await L2.loadPageFont(3)).ok, true, 'a later session works offline from the kept copy');
  assert.equal((await L2.loadPageFont(9)).ok, false, 'a font never downloaded cannot be drawn offline');
  assert.equal(made.length >= 2, true);
});

test('font loader: only the most recent page fonts stay registered (memory)', async () => {
  const { FF } = fontFace(), fonts = fakeFonts();
  const L = S.createFontLoader({ fetchImpl: async () => okBin(), cachesImpl: memCaches(), FontFaceImpl: FF, fontsImpl: fonts, maxFonts: 3 });
  for (const p of [1, 2, 3, 4, 5]) await L.loadPageFont(p);
  assert.equal(fonts.set.size, 3);
});
