// Pure logic of the mushaf jump dialog (port of Android MushafJump.kt). No Quran text anywhere: numbers and surah names only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as J from '../src/features/native/mushaf-jump.mjs';

const layoutPath = new URL('../public/core/quran-layout.js', import.meta.url);
const layout = fs.existsSync(layoutPath) ? (() => { const w = {}; vm.runInNewContext(fs.readFileSync(layoutPath, 'utf8'), { window: w }); return w.HALAQATI_QURAN_LAYOUT; })() : null;

test('thirty juz, in order, starting at page 1 and ending before page 604', () => {
  assert.equal(J.JUZ_START_AYAH.length, 30);
  assert.equal(J.JUZ_START_PAGE.length, 30);
  assert.equal(J.JUZ_START_PAGE[0], 1);
  for (let i = 1; i < 30; i++) { assert.ok(J.JUZ_START_AYAH[i] > J.JUZ_START_AYAH[i - 1]); assert.ok(J.JUZ_START_PAGE[i] > J.JUZ_START_PAGE[i - 1]); }
  assert.ok(J.JUZ_START_PAGE[29] < 604);
});

test('the built-in juz start pages agree with the shipped ayah-to-page layout', { skip: !layout }, () => {
  for (let j = 1; j <= 30; j++) assert.equal(layout.page[J.JUZ_START_AYAH[j - 1]], J.JUZ_START_PAGE[j - 1], 'juz ' + j);
});

test('juzStartPage uses the layout when given, the built-in table otherwise', () => {
  assert.equal(J.juzStartPage(1), 1);
  assert.equal(J.juzStartPage(30), 582);
  assert.equal(J.juzStartPage(0), 1);
  assert.equal(J.juzStartPage(31), 582);
  const fake = { page: [] }; fake.page[J.JUZ_START_AYAH[4]] = 99;
  assert.equal(J.juzStartPage(5, fake), 99);
});

test('juzOfPage returns the juz that contains a page', () => {
  assert.equal(J.juzOfPage(1), 1);
  assert.equal(J.juzOfPage(21), 1);
  assert.equal(J.juzOfPage(22), 2);
  assert.equal(J.juzOfPage(581), 29);
  assert.equal(J.juzOfPage(582), 30);
  assert.equal(J.juzOfPage(604), 30);
});

test('parsePage accepts 1..604 in Latin or Arabic-Indic digits and nothing else', () => {
  assert.equal(J.parsePage('12'), 12);
  assert.equal(J.parsePage('٦٠٤'), 604);
  assert.equal(J.parsePage(' 7 '), 7);
  for (const bad of ['0', '605', '', 'abc', '1.5', '-3', null, undefined]) assert.equal(J.parsePage(bad), null, String(bad));
});

test('parseAyah is bounded by the surah length', () => {
  assert.equal(J.parseAyah('7', 286), 7);
  assert.equal(J.parseAyah('٢٨٦', 286), 286);
  assert.equal(J.parseAyah('287', 286), null);
  assert.equal(J.parseAyah('0', 286), null);
  assert.equal(J.parseAyah('', 286), null);
});

test('filterSurahs matches by number or by name ignoring diacritics and alef forms', () => {
  const list = [{ id: 1, name: 'الفاتحة' }, { id: 2, name: 'البقرة' }, { id: 3, name: 'آل عمران' }, { id: 112, name: 'الإخلاص' }];
  assert.equal(J.filterSurahs(list, '').length, 4);
  assert.deepEqual(J.filterSurahs(list, 'بقر').map((s) => s.id), [2]);
  assert.deepEqual(J.filterSurahs(list, 'ال عمران').map((s) => s.id), [3]);
  assert.deepEqual(J.filterSurahs(list, 'ال').map((s) => s.id), [1, 2, 3, 112]);
  assert.deepEqual(J.filterSurahs(list, 'اخلاص').map((s) => s.id), [112]);
  assert.deepEqual(J.filterSurahs(list, '٣').map((s) => s.id), [3]);
  assert.deepEqual(J.filterSurahs(list, '112').map((s) => s.id), [112]);
  assert.deepEqual(J.filterSurahs(list, 'عمران').map((s) => s.id), [3]);
  assert.deepEqual(J.filterSurahs(list, 'ءامن').map((s) => s.id), []);
});

test('rangePages is ordered whichever way the range is given and capped at 604', () => {
  assert.deepEqual(J.rangePages(5, 3), [3, 4, 5]);
  assert.deepEqual(J.rangePages(5, null), [5]);
  assert.deepEqual(J.rangePages(null, null), []);
  assert.deepEqual(J.rangePages(603, 700), [603, 604]);
});

const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };

test('bookmarks: toggle, sorted, unique, bounded, tolerant of bad storage', () => {
  assert.deepEqual(J.toggleBookmark([], 5), [5]);
  assert.deepEqual(J.toggleBookmark([5, 9], 5), [9]);
  assert.deepEqual(J.toggleBookmark([9], 5), [5, 9]);
  assert.deepEqual(J.toggleBookmark([9], 0), [9]);
  assert.equal(J.toggleBookmark(Array.from({ length: 60 }, (_, i) => i + 1), 100).length, 60);
  const st = mem();
  assert.deepEqual(J.loadBookmarks(st), []);
  J.saveBookmarks(st, [9, 3, 3, 700, 0, 'x']);
  assert.deepEqual(J.loadBookmarks(st), [3, 9]);
  st.setItem(J.BOOKMARKS_KEY, '{bad');
  assert.deepEqual(J.loadBookmarks(st), []);
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(J.loadBookmarks(bad), []);
  assert.doesNotThrow(() => J.saveBookmarks(bad, [1]));
  assert.deepEqual(J.loadBookmarks(null), []);
});

test('hereLabel names page, juz and surah', () => {
  assert.equal(J.hereLabel(22, 'البقرة'), 'أنت في صفحة ٢٢ · الجزء ٢ · سورة البقرة');
  assert.equal(J.hereLabel(1, ''), 'أنت في صفحة ١ · الجزء ١');
});
