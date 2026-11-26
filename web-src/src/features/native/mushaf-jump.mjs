/* Halaqati web RC114: pure logic of the mushaf jump dialog (port of Android MushafJump.kt).
   Numbers and surah names only; no Quran text. Juz starts are global ayah indexes (same table as Android QuranMetadata.juzStarts),
   turned into pages through the shipped ayah-to-page layout when it is loaded, otherwise through the built-in page table below
   (the test checks the two agree). Bookmarks are page numbers kept in localStorage on this device. */
export const TOTAL_PAGES = 604;
export const BOOKMARKS_KEY = 'halaqati_mushaf_bookmarks_v1';
export const MAX_BOOKMARKS = 60;
export const JUZ_START_AYAH = [1, 149, 260, 386, 517, 641, 751, 900, 1042, 1201, 1328, 1479, 1649, 1803, 2030, 2215, 2484, 2674, 2876, 3215, 3386, 3564, 3733, 4090, 4265, 4511, 4706, 5105, 5242, 5673];
export const JUZ_START_PAGE = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];

const clampJuz = (j) => Math.min(30, Math.max(1, Math.trunc(Number(j)) || 1));
const latin = (s) => String(s == null ? '' : s).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6F0));
export const arDigits = (n) => String(n == null ? '' : n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

export function juzStartPage(juz, layout) {
  const j = clampJuz(juz);
  const p = layout && Array.isArray(layout.page) ? layout.page[JUZ_START_AYAH[j - 1]] : 0;
  return p > 0 ? p : JUZ_START_PAGE[j - 1];
}
export function juzOfPage(page, layout) {
  let juz = 1;
  for (let j = 1; j <= 30; j++) if (juzStartPage(j, layout) <= page) juz = j;
  return juz;
}

export function parsePage(v) {
  const t = latin(v).trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= TOTAL_PAGES ? n : null;
}
export function parseAyah(v, max) {
  const t = latin(v).trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= max ? n : null;
}

const norm = (s) => String(s == null ? '' : s).replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
/** list: [{id, name}]; a query matches the surah number or part of its name. */
export function filterSurahs(list, query) {
  const q = norm(latin(query));
  if (!q) return list.slice();
  return list.filter((s) => String(s.id) === q || norm(s.name).includes(q));
}

export function rangePages(start, end) {
  if (!start) return [];
  const a = Math.min(start, end || start), b = Math.min(TOTAL_PAGES, Math.max(start, end || start));
  const out = [];
  for (let p = Math.max(1, a); p <= b; p++) out.push(p);
  return out;
}

const clean = (list) => [...new Set((Array.isArray(list) ? list : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_PAGES))].sort((a, b) => a - b);
export function toggleBookmark(list, page) {
  const cur = clean(list);
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) return cur;
  if (cur.includes(page)) return cur.filter((p) => p !== page);
  return cur.length >= MAX_BOOKMARKS ? cur : clean([...cur, page]);
}
const defStore = () => { try { return globalThis.localStorage; } catch (_e) { return null; } };
export function loadBookmarks(storage = defStore()) { try { return clean(JSON.parse(storage.getItem(BOOKMARKS_KEY) || '[]')); } catch (_e) { return []; } }
export function saveBookmarks(storage, list) {
  if (storage === undefined) storage = defStore(); try { storage.setItem(BOOKMARKS_KEY, JSON.stringify(clean(list))); } catch (_e) { /* storage blocked */ } }

export const hereLabel = (page, surahName, layout) => `أنت في صفحة ${arDigits(page)} · الجزء ${arDigits(juzOfPage(page, layout))}${surahName ? ' · سورة ' + surahName : ''}`;
