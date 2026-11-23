/* Halaqati Interactive Mushaf — Pure State, Data & Gesture Engine (Phase 1: Ayah-level)
 * Classic-script compatible (attaches to window.HalaqatiMushafState) and Node/CommonJS testable.
 * Zero external dependencies, no Supabase calls, nothing written to storage. The Quran text is never typed in this repo: it comes only from the Quran.com API (or its Cache API copy).
 */
(function (root) {
  'use strict';

  var TOTAL_PAGES = 604;
  var VALID_MARK_TYPES = ['mistake', 'prompt'];
  var VALID_KINDS = ['word', 'harakah', 'ayah_start'];
  var QURAN_API_BASE = 'https://api.quran.com/api/v4/verses/by_page/';
  var CACHE_NAME = 'halaqati-mushaf-pages-v2';
  var OLD_CACHES = ['halaqati-mushaf-pages-v1'];
  var FONT_CACHE_NAME = 'halaqati-mushaf-fonts-v1';
  var PAGE_FONT_URL = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p';
  var SURAH_NAMES_FONT_URL = 'https://verses.quran.foundation/fonts/quran/surah-names/v1/sura_names.woff2';
  // Quran Foundation terms: API text may be cached for one week at most (font files are exempt)
  var DATA_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
  // The only six places where the API line number differs from the printed layout (QUL page layout, checked against all 604 pages): page -> {word id: printed line}
  var LINE_OVERRIDES = { 27: { '2:181:5': 15 }, 177: { '8:6:10': 12 }, 254: { '13:37:8': 6 }, 400: { '29:33:11': 6 }, 443: { '36:52:10': 13 }, 589: { '84:21:end': 14 } };
  // Pages whose last printed line is a surah header (the surah's first ayah starts on the next page): page -> surah
  var HEADER_AT_PAGE_END = { 76: 4, 207: 10, 331: 22, 341: 23, 349: 24, 366: 26, 376: 27, 414: 32, 417: 33, 445: 37, 452: 38, 498: 45, 506: 47, 525: 53, 548: 60, 555: 64, 557: 65, 584: 80 };
  // Short lines the 1421H Madinah print centres (page -> line numbers); layout metadata from the QUL page layout. Pages 1-2 are fully centred.
  var CENTERED_LINES = { 255: [2], 528: [9], 534: [6], 545: [6], 586: [1], 593: [2], 594: [5], 600: [10], 602: [5, 11, 15], 603: [10, 15], 604: [4, 9, 14, 15] };

  // Compact 114-surah index: [number, arabicName, ayahCount, madinahStartPage]
  var SURAH_TUPLES = [
    [1,'الفاتحة',7,1],[2,'البقرة',286,2],[3,'آل عمران',200,50],[4,'النساء',176,77],[5,'المائدة',120,106],
    [6,'الأنعام',165,128],[7,'الأعراف',206,151],[8,'الأنفال',75,177],[9,'التوبة',129,187],[10,'يونس',109,208],
    [11,'هود',123,221],[12,'يوسف',111,235],[13,'الرعد',43,249],[14,'إبراهيم',52,255],[15,'الحجر',99,262],
    [16,'النحل',128,267],[17,'الإسراء',111,282],[18,'الكهف',110,293],[19,'مريم',98,305],[20,'طه',135,312],
    [21,'الأنبياء',112,322],[22,'الحج',78,332],[23,'المؤمنون',118,342],[24,'النور',64,350],[25,'الفرقان',77,359],
    [26,'الشعراء',227,367],[27,'النمل',93,377],[28,'القصص',88,385],[29,'العنكبوت',69,396],[30,'الروم',60,404],
    [31,'لقمان',34,411],[32,'السجدة',30,415],[33,'الأحزاب',73,418],[34,'سبأ',54,428],[35,'فاطر',45,434],
    [36,'يس',83,440],[37,'الصافات',182,446],[38,'ص',88,453],[39,'الزمر',75,458],[40,'غافر',85,467],
    [41,'فصلت',54,477],[42,'الشورى',53,483],[43,'الزخرف',89,489],[44,'الدخان',59,496],[45,'الجاثية',37,499],
    [46,'الأحقاف',35,502],[47,'محمد',38,507],[48,'الفتح',29,511],[49,'الحجرات',18,515],[50,'ق',45,518],
    [51,'الذاريات',60,520],[52,'الطور',49,523],[53,'النجم',62,526],[54,'القمر',55,528],[55,'الرحمن',78,531],
    [56,'الواقعة',96,534],[57,'الحديد',29,537],[58,'المجادلة',22,542],[59,'الحشر',24,545],[60,'الممتحنة',13,549],
    [61,'الصف',14,551],[62,'الجمعة',11,553],[63,'المنافقون',11,554],[64,'التغابن',18,556],[65,'الطلاق',12,558],
    [66,'التحريم',12,560],[67,'الملك',30,562],[68,'القلم',52,564],[69,'الحاقة',52,566],[70,'المعارج',44,568],
    [71,'نوح',28,570],[72,'الجن',28,572],[73,'المزمل',20,574],[74,'المدثر',56,575],[75,'القيامة',40,577],
    [76,'الإنسان',31,578],[77,'المرسلات',50,580],[78,'النبأ',40,582],[79,'النازعات',46,583],[80,'عبس',42,585],
    [81,'التكوير',29,586],[82,'الانفطار',19,587],[83,'المطففين',36,587],[84,'الانشقاق',25,589],[85,'البروج',22,590],
    [86,'الطارق',17,591],[87,'الأعلى',19,591],[88,'الغاشية',26,592],[89,'الفجر',30,593],[90,'البلد',20,594],
    [91,'الشمس',15,595],[92,'الليل',21,595],[93,'الضحى',11,596],[94,'الشرح',8,596],[95,'التين',8,597],
    [96,'العلق',19,597],[97,'القدر',5,598],[98,'البينة',8,598],[99,'الزلزلة',8,599],[100,'العاديات',11,599],
    [101,'القارعة',11,600],[102,'التكاثر',8,600],[103,'العصر',3,601],[104,'الهمزة',9,601],[105,'الفيل',5,601],
    [106,'قريش',4,602],[107,'الماعون',7,602],[108,'الكوثر',3,602],[109,'الكافرون',6,603],[110,'النصر',3,603],
    [111,'المسد',5,603],[112,'الإخلاص',4,604],[113,'الفلق',5,604],[114,'الناس',6,604]
  ];

  var SURAHS = SURAH_TUPLES.map(function (t) {
    return { id: t[0], name: t[1], ayahs: t[2], startPage: t[3] };
  });

  function escapeHtml(val) {
    if (root && root.NX && typeof root.NX.h === 'function') {
      return root.NX.h(val);
    }
    if (root && typeof root.esc === 'function') {
      return root.esc(val);
    }
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clampPage(page) {
    var n = parseInt(page, 10);
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > TOTAL_PAGES) return TOTAL_PAGES;
    return n;
  }

  function getSurah(surahId) {
    var id = parseInt(surahId, 10);
    if (!Number.isFinite(id) || id < 1 || id > 114) return null;
    return SURAHS[id - 1];
  }

  function globalAyahIndex(surah, ayah) {
    var s = parseInt(surah, 10);
    var a = parseInt(ayah, 10);
    if (!Number.isFinite(s) || s < 1 || s > 114) return 0;
    if (!Number.isFinite(a) || a < 1) a = 1;
    var offset = 0;
    for (var i = 0; i < s - 1; i++) offset += SURAHS[i].ayahs;
    return offset + Math.min(a, SURAHS[s - 1].ayahs);
  }

  function resolvePageForAyah(surah, ayah, layoutObj) {
    var layout = layoutObj || (root && root.HALAQATI_QURAN_LAYOUT);
    var idx = globalAyahIndex(surah, ayah);
    if (layout && Array.isArray(layout.page) && idx > 0 && layout.page[idx]) {
      return clampPage(layout.page[idx]);
    }
    var info = getSurah(surah);
    return info ? info.startPage : 1;
  }

  function compareAyahRef(a, b) {
    if (a.surah !== b.surah) return a.surah - b.surah;
    return a.ayah - b.ayah;
  }

  function parseAyahKey(key) {
    var parts = String(key || '').split(':');
    var s = parseInt(parts[0], 10);
    var a = parseInt(parts[1], 10);
    if (!Number.isFinite(s) || !Number.isFinite(a) || s < 1 || s > 114 || a < 1) return null;
    return { surah: s, ayah: a };
  }

  function isAyahInRange(surah, ayah, range) {
    if (!range) return false;
    var s = parseInt(surah, 10);
    var a = parseInt(ayah, 10);
    if (!Number.isFinite(s) || !Number.isFinite(a)) return false;
    if (Array.isArray(range.selectedSurahs) && range.selectedSurahs.length) {
      return range.selectedSurahs.indexOf(s) !== -1;
    }
    if (range.startSurah && range.endSurah) {
      var start = { surah: +range.startSurah, ayah: +range.startAyah || 1 };
      var end = { surah: +range.endSurah, ayah: +range.endAyah || (getSurah(+range.endSurah)?.ayahs || 999) };
      if (compareAyahRef(start, end) > 0) {
        var tmp = start; start = end; end = tmp;
      }
      var cur = { surah: s, ayah: a };
      return compareAyahRef(cur, start) >= 0 && compareAyahRef(cur, end) <= 0;
    }
    if (Array.isArray(range.selectedSurahs) && range.selectedSurahs.length) {
      return range.selectedSurahs.indexOf(s) !== -1;
    }
    if (range.startPage && range.endPage && range.page) {
      var sp = Math.min(+range.startPage, +range.endPage);
      var ep = Math.max(+range.startPage, +range.endPage);
      return +range.page >= sp && +range.page <= ep;
    }
    return false;
  }

  // Distinguish a quick tap on an ayah from a mobile vertical scroll or cancelled gesture
  function isTapGesture(start, end, opts) {
    if (!start || !end || end.cancelled) return false;
    var cfg = opts || {};
    var maxMovePx = Number.isFinite(cfg.maxMovePx) ? cfg.maxMovePx : 10;
    var maxDurationMs = Number.isFinite(cfg.maxDurationMs) ? cfg.maxDurationMs : 400;
    var dx = (Number(end.x) || 0) - (Number(start.x) || 0);
    var dy = (Number(end.y) || 0) - (Number(start.y) || 0);
    var dist = Math.hypot(dx, dy);
    var duration = (Number(end.t) || 0) - (Number(start.t) || 0);
    if (duration < 0 || duration > maxDurationMs) return false;
    return dist <= maxMovePx;
  }

  function parseWordId(id) {
    var m = /^(\d{1,3}):(\d{1,3}):(\d{1,3})$/.exec(String(id == null ? '' : id));
    if (!m) return null;
    var surah = +m[1], ayah = +m[2], pos = +m[3];
    if (surah < 1 || surah > 114 || ayah < 1 || pos < 1) return null;
    return { surah: surah, ayah: ayah, pos: pos, ayah_key: surah + ':' + ayah };
  }

  function printedLine(page, id, line) { var o = LINE_OVERRIDES[clampPage(page)]; return o && o[id] ? o[id] : line; }

  function normalizeApiPageResponse(page, payload) {
    var versesRaw = payload && Array.isArray(payload.verses) ? payload.verses : [];
    var words = [], items = [], seen = {};
    var verses = versesRaw.map(function (v) {
      var key = v.verse_key || v.ayah_key;
      var parsed = parseAyahKey(key);
      var raw = Array.isArray(v.words) ? v.words : [];
      var textWords = raw.filter(function (w) { return w && w.char_type_name !== 'end'; });
      if (parsed) {
        raw.forEach(function (w) {
          if (!w) return;
          // the API also returns the words of a verse that belong to the neighbouring page: they are drawn on their own page only
          if (Number(w.page_number) && Number(w.page_number) !== clampPage(page)) return;
          var uid = parsed.surah + ':' + parsed.ayah + ':' + (w.char_type_name === 'end' ? 'end' : w.position);
          if (seen[uid]) return; seen[uid] = 1;
          var line = Number(w.line_number) || 0, fontPage = Number(w.v2_page) || Number(w.page_number) || clampPage(page);
          if (w.char_type_name === 'end') {
            var eid = parsed.surah + ':' + parsed.ayah + ':end';
            items.push({ id: eid, ayah_key: parsed.surah + ':' + parsed.ayah, end: true, glyph: w.code_v2 || '', fontPage: fontPage, line: printedLine(page, eid, line) });
            return;
          }
          var pos = Number(w.position);
          if (!(pos >= 1)) return;
          var word = { id: parsed.surah + ':' + parsed.ayah + ':' + pos, ayah_key: parsed.surah + ':' + parsed.ayah, surah: parsed.surah, ayah: parsed.ayah, pos: pos,
            text: w.text_uthmani || '', glyph: w.code_v2 || '', fontPage: fontPage, line: 0, ayahStart: pos === 1 };
          word.line = printedLine(page, word.id, line);
          words.push(word); items.push(word);
        });
      }
      var text = v.text_uthmani || textWords.map(function (w) { return w.text_uthmani || w.text || ''; }).join(' ').trim();
      var lines = raw.map(function (w) { return Number(w.line_number) || 0; }).filter(Boolean);
      return {
        ayah_key: key || (parsed ? parsed.surah + ':' + parsed.ayah : ''),
        surah: parsed ? parsed.surah : 0,
        ayah: parsed ? parsed.ayah : 0,
        text: text,
        line_start: lines.length ? Math.min.apply(null, lines) : (v.line_start || 1),
        line_end: lines.length ? Math.max.apply(null, lines) : (v.line_end || 1)
      };
    }).filter(function (v) { return v.ayah_key && v.text; });
    var juz = versesRaw[0] && versesRaw[0].juz_number ? versesRaw[0].juz_number : null;
    return { page: clampPage(page), juz: juz, source: 'quran-api-v4', verses: verses, words: words, items: items };
  }

  /* The printed Madinah page has 15 lines. Lines without words are the surah banner / basmala lines (right before a surah's first ayah) or empty. */
  function buildPageLines(pageData) {
    var byLine = {};
    ((pageData && pageData.items) || (pageData && pageData.words) || []).forEach(function (w) { if (w.line >= 1 && w.line <= 15) (byLine[w.line] = byLine[w.line] || []).push(w); });
    var lines = [];
    for (var i = 1; i <= 15; i++) lines.push({ n: i, kind: byLine[i] ? 'text' : 'empty', items: byLine[i] || [], words: (byLine[i] || []).filter(function (w) { return !w.end; }) });
    lines.forEach(function (line, idx) {
      var first = line.words[0];
      if (!first || first.pos !== 1 || first.ayah !== 1) return;
      var s = first.surah, above = idx - 1;
      var hasBasmalaLine = s !== 1 && s !== 9;
      if (above >= 0 && lines[above].kind === 'empty') {
        if (hasBasmalaLine && above - 1 >= 0 && lines[above - 1].kind === 'empty') {
          lines[above].kind = 'basmala'; lines[above].surah = s;
          lines[above - 1].kind = 'banner'; lines[above - 1].surah = s;
        } else { lines[above].kind = 'banner'; lines[above].surah = s; }
      }
    });
    var pg = pageData && pageData.page;
    if (HEADER_AT_PAGE_END[pg] && lines[14].kind === 'empty') { lines[14].kind = 'banner'; lines[14].surah = HEADER_AT_PAGE_END[pg]; }
    if (HEADER_AT_PAGE_END[pg - 1] && lines[0].kind !== 'text') { lines[0].kind = 'basmala'; lines[0].surah = HEADER_AT_PAGE_END[pg - 1]; }
    return { lines: lines };
  }

  /* QCF V2 page fonts (King Fahd Complex, unmodified) from the Quran Foundation CDN, kept in the Cache API so a page read once works offline.
   * Terms: bundling/caching fonts is allowed for an app whose developer account is active and that credits Quran Foundation (credit is in the mushaf footer). */
  function createFontLoader(options) {
    var opts = options || {};
    var fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch.bind(root) : null);
    var cachesImpl = opts.cachesImpl || (typeof caches !== 'undefined' ? caches : null);
    var FaceImpl = opts.FontFaceImpl || (typeof FontFace !== 'undefined' ? FontFace : null);
    var fontsImpl = opts.fontsImpl || (typeof document !== 'undefined' ? document.fonts : null);
    var maxFonts = opts.maxFonts || 24;
    var loaded = new Map(), inflight = new Map();

    async function bytes(url) {
      var cache = null;
      try { cache = cachesImpl && cachesImpl.open ? await cachesImpl.open(FONT_CACHE_NAME) : null; } catch (_e) { cache = null; }
      try { var kept = cache ? await cache.match(url) : null; if (kept) return await kept.arrayBuffer(); } catch (_e) {}
      if (!fetchImpl) throw new Error('no network');
      var res = await fetchImpl(url);
      if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'ERR'));
      var copy = typeof res.clone === 'function' ? res.clone() : null;
      var buf = await res.arrayBuffer();
      try { if (cache && copy) await cache.put(url, copy); } catch (_e) {}
      return buf;
    }
    function register(family, url) {
      if (loaded.has(family)) { var f = loaded.get(family); loaded.delete(family); loaded.set(family, f); return Promise.resolve({ ok: true, family: family }); }
      if (inflight.has(family)) return inflight.get(family);
      var p = (async function () {
        try {
          if (!FaceImpl || !fontsImpl) throw new Error('no FontFace');
          var face = new FaceImpl(family, await bytes(url));
          await face.load(); fontsImpl.add(face); loaded.set(family, face);
          while (loaded.size > maxFonts) { var oldest = loaded.keys().next().value; try { fontsImpl.delete(loaded.get(oldest)); } catch (_e) {} loaded.delete(oldest); }
          return { ok: true, family: family };
        } catch (e) { return { ok: false, family: family, error: String(e && e.message || e) }; }
        finally { inflight.delete(family); }
      })();
      inflight.set(family, p);
      return p;
    }
    return {
      loadPageFont: function (page) { var n = clampPage(page); return register('qcf-v2-p' + n, PAGE_FONT_URL + n + '.woff2'); },
      loadSurahNames: function () { return register('qcf-surah-names', SURAH_NAMES_FONT_URL); }
    };
  }

  // Page fetcher with in-memory cache + Cache API copy (offline) and a timeout; failures are reported, never papered over
  function createPageLoader(options) {
    var opts = options || {};
    var memCache = new Map();
    var inflight = new Map();
    var fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch.bind(root) : null);
    var cachesImpl = opts.cachesImpl || (typeof caches !== 'undefined' ? caches : null);
    var timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 12000;
    var now = typeof opts.now === 'function' ? opts.now : Date.now;

    function getUrl(page) {
      return QURAN_API_BASE + clampPage(page) +
        '?words=true&word_fields=code_v2,text_uthmani,page_number,line_number&per_page=50';
    }

    async function readFromCacheApi(url) {
      if (!cachesImpl || typeof cachesImpl.open !== 'function') return null;
      try {
        var cache = await cachesImpl.open(CACHE_NAME);
        var match = await cache.match(url);
        if (!match) return null;
        var at = Number(match.headers && match.headers.get && match.headers.get('x-halaqati-cached-at'));
        if (at && now() - at > DATA_MAX_AGE_MS) { try { await cache.delete(url); } catch (_e) {} return null; }
        return await match.json();
      } catch (_e) {
        return null;
      }
    }

    async function writeToCacheApi(url, responseClone) {
      if (!cachesImpl || typeof cachesImpl.open !== 'function' || !responseClone) return;
      try {
        var cache = await cachesImpl.open(CACHE_NAME);
        var headers = new Headers({ 'content-type': 'application/json', 'x-halaqati-cached-at': String(now()) });
        await cache.put(url, new Response(await responseClone.text(), { status: 200, headers: headers }));
        OLD_CACHES.forEach(function (n) { try { cachesImpl.delete(n); } catch (_e) {} });
      } catch (_e) {
        // Ignore quota/private-mode cache errors
      }
    }

    // one API page, from memory, the Cache API (max a week old) or the network
    var rawMem = new Map(), rawInflight = new Map();
    function rawPage(n) {
      if (rawMem.has(n)) return Promise.resolve({ ok: true, json: rawMem.get(n) });
      if (rawInflight.has(n)) return rawInflight.get(n);
      var pr = (async function () {
        var url = getUrl(n);
        var cachedJson = await readFromCacheApi(url);
        if (cachedJson && Array.isArray(cachedJson.verses) && cachedJson.verses.length) { rawMem.set(n, cachedJson); return { ok: true, json: cachedJson }; }
        // the Quran text only ever comes from the API or its cache: nothing typed in this repo is ever substituted
        if (!fetchImpl) return { ok: false, error: 'لا يتوفر اتصال بالشبكة لتحميل الصفحة' };
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_e) {} }, timeoutMs) : null;
        try {
          var res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined });
          if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'ERR'));
          var clone = typeof res.clone === 'function' ? res.clone() : null;
          var json = await res.json();
          if (!json || !Array.isArray(json.verses) || !json.verses.length) throw new Error('EMPTY_PAGE_DATA');
          rawMem.set(n, json);
          if (clone) await writeToCacheApi(url, clone);
          return { ok: true, json: json };
        } catch (err) {
          return { ok: false, error: err && err.name === 'AbortError' ? 'انتهت مهلة تحميل الصفحة' : 'تعذر تحميل بيانات الصفحة' };
        } finally { if (timer) clearTimeout(timer); }
      })();
      rawInflight.set(n, pr);
      return pr.finally(function () { rawInflight.delete(n); });
    }

    // A verse that runs from one printed page to the next is listed by only one of the two API pages, so a printed page is built from its
    // own API page plus both neighbours (words are kept by their own page_number); a neighbour that cannot be read fails the page.
    async function loadPage(pageNum) {
      var p = clampPage(pageNum);
      if (memCache.has(p)) return { ok: true, data: memCache.get(p), fromCache: true };
      if (inflight.has(p)) return inflight.get(p);
      var promise = (async function () {
        var wanted = [p - 1, p, p + 1].filter(function (n) { return n >= 1 && n <= TOTAL_PAGES; });
        var got = await Promise.all(wanted.map(rawPage));
        var bad = got.filter(function (g) { return !g.ok; })[0];
        if (bad) return { ok: false, error: bad.error, page: p };
        var verses = [];
        got.forEach(function (g) { verses = verses.concat(g.json.verses); });
        var data = normalizeApiPageResponse(p, { verses: verses });
        if (!data.verses.length) return { ok: false, error: 'تعذر تحميل بيانات الصفحة', page: p };
        memCache.set(p, data);
        return { ok: true, data: data, fromCache: false };
      })();
      inflight.set(p, promise);
      try { return await promise; } finally { inflight.delete(p); }
    }

    function prefetchNext(pageNum) {
      var next = clampPage(pageNum) + 1;
      if (next <= TOTAL_PAGES && !memCache.has(next) && !inflight.has(next)) {
        loadPage(next).catch(function () {});
      }
    }

    return {
      loadPage: loadPage,
      prefetchNext: prefetchNext,
      hasCached: function (p) { return memCache.has(clampPage(p)); },
      clearMemoryCache: function () { memCache.clear(); }
    };
  }

  /* ids of the words between two words (inclusive) in reading order, whatever the drag direction; [] when either is not on the page */
  function spanBetween(lines, idA, idB) {
    var ids = [];
    (lines || []).forEach(function (l) { (l.words || []).forEach(function (w) { ids.push(w.id); }); });
    var a = ids.indexOf(idA), b = ids.indexOf(idB);
    if (a === -1 || b === -1) return [];
    return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
  }

  /* QCF lines are drawn edge to edge at one size; only a line wider than the page is made smaller (one ratio), as the print never stretches words. */
  function overflowScale(natural, available) {
    if (!(available > 0) || !(natural > available)) return 1;
    return Math.round(available * 0.99 / natural * 1000) / 1000;
  }
  function isOpeningPage(page) { return page === 1 || page === 2; }
  function isCenteredLine(page, line) {
    if (isOpeningPage(page)) return true;
    var c = CENTERED_LINES[page];
    return !!c && c.indexOf(line) !== -1;
  }

  function shortcutAction(e) {
    if (!e || e.altKey) return null;
    var k = String(e.key || ''), low = k.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (low === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' };
      if (low === 'y') return { type: 'redo' };
      return null;
    }
    if (k === '1') return { type: 'type', value: 'mistake' };
    if (k === '2') return { type: 'type', value: 'prompt' };
    if (low === 't') return { type: 'tool', value: 'tap' };
    if (low === 'h') return { type: 'tool', value: 'highlight' };
    if (low === 'e') return { type: 'tool', value: 'erase' };
    if (k === 'ArrowLeft') return { type: 'move', value: 'next' };
    if (k === 'ArrowRight') return { type: 'move', value: 'prev' };
    if (k === 'ArrowDown') return { type: 'move', value: 'down' };
    if (k === 'ArrowUp') return { type: 'move', value: 'up' };
    return null;
  }

  function createMushafSession(options) {
    var opts = options || {};
    var nowFn = typeof opts.now === 'function' ? opts.now : Date.now;
    var state = { page: clampPage(opts.initialPage || 1), studentId: opts.studentId || null, marks: [] };
    var past = [], future = [];

    function indexOfId(id) {
      for (var i = 0; i < state.marks.length; i++) if (state.marks[i].id === id) return i;
      return -1;
    }
    var spanSeq = 0;
    // Counting rules of the circle: a mistake is a phrase (one highlighted span, or words that sit next to each other in an ayah) = 1;
    // a prompt is one word, and every two harakat are one prompt.
    function tally(list) {
      var mist = list.filter(function (m) { return m.type === 'mistake'; }), parent = mist.map(function (_m, i) { return i; });
      function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
      function join(a, b) { parent[find(a)] = find(b); }
      var bySpan = {}, byKey = {}, loc = [];
      mist.forEach(function (m, i) {
        var pa = parseAyahKey(m.ayah_key); loc[i] = { s: pa ? pa.surah : 0, a: pa ? pa.ayah : 0 };
        if (m.span) (bySpan[m.span] = bySpan[m.span] || []).push(i);
        byKey[m.ayah_key + ':' + m.word] = i;
      });
      // a highlighted span is one phrase only while its words stay in a run: erasing a word in the middle splits it (the next ayah's first word continues the run)
      Object.keys(bySpan).forEach(function (k) {
        var idx = bySpan[k].sort(function (x, y) { return (loc[x].s - loc[y].s) || (loc[x].a - loc[y].a) || (mist[x].word - mist[y].word); });
        for (var q = 1; q < idx.length; q++) {
          var A = mist[idx[q - 1]], B = mist[idx[q]], la = loc[idx[q - 1]], lb = loc[idx[q]];
          if ((A.ayah_key === B.ayah_key && B.word === A.word + 1) || (B.word === 1 && ((lb.s === la.s && lb.a === la.a + 1) || (lb.s === la.s + 1 && lb.a === 1)))) join(idx[q - 1], idx[q]);
        }
      });
      mist.forEach(function (m, i) { var n = byKey[m.ayah_key + ':' + (m.word + 1)]; if (n !== undefined) join(i, n); });
      var roots = {}; mist.forEach(function (_m, i) { roots[find(i)] = 1; });
      var exact = 0;
      list.forEach(function (m) { if (m.type === 'prompt') exact += m.kind === 'harakah' ? 0.5 : 1; });
      return { mistakes: Object.keys(roots).length, prompts: Math.floor(exact), promptsExact: exact };
    }
    function setMark(id, mark) {
      var i = indexOfId(id);
      if (mark) { if (i === -1) state.marks.push(mark); else state.marks[i] = mark; }
      else if (i !== -1) state.marks.splice(i, 1);
    }
    // apply a list of {id, before, after}: going forward uses `after`, going back uses `before`; the delta is the change of the circle's counters
    function apply(changes, forward) {
      var t0 = tally(state.marks);
      changes.forEach(function (c) { setMark(c.id, forward ? c.after : c.before); });
      var t1 = tally(state.marks);
      return { mist: t1.mistakes - t0.mistakes, prompt: t1.prompts - t0.prompts };
    }
    function pageOf(changes) { var m = changes[0] && (changes[0].after || changes[0].before); return m && m.page ? m.page : null; }
    function commit(changes) {
      if (!changes.length) return { delta: { mist: 0, prompt: 0 }, changed: 0 };
      var delta = apply(changes, true);
      past.push(changes); future = [];
      return { delta: delta, changed: changes.length };
    }
    function checkType(type) { if (VALID_MARK_TYPES.indexOf(type) === -1) throw new Error('Invalid mark type: ' + type); }
    function checkKind(kind) { if (VALID_KINDS.indexOf(kind) === -1) throw new Error('Invalid kind: ' + kind); }
    function parsedOrThrow(id) { var w = parseWordId(id); if (!w) throw new Error('Invalid word id: ' + id); return w; }
    function build(id, w, type, kind, page, span) { var m = { id: id, ayah_key: w.ayah_key, word: w.pos, type: type, kind: kind, page: clampPage(page || state.page), at: nowFn() }; if (span) m.span = span; return m; }

    function markWord(id, type, o) {
      o = o || {}; checkType(type); if (o.kind) checkKind(o.kind);
      var w = parsedOrThrow(id), i = indexOfId(id), existing = i === -1 ? null : state.marks[i];
      var before = existing ? JSON.parse(JSON.stringify(existing)) : null;
      var removing = existing && existing.type === type && (!o.kind || o.kind === existing.kind);
      var after = removing ? null : build(id, w, type, o.kind || 'word', o.page);
      return commit([{ id: id, before: before, after: after }]);
    }
    function markSpan(ids, type, o) {
      o = o || {}; checkType(type); var kind = o.kind || 'word'; checkKind(kind);
      var seen = {}, changes = [], span = ++spanSeq;
      (ids || []).forEach(function (id) {
        if (seen[id]) return; seen[id] = true;
        var w = parsedOrThrow(id), i = indexOfId(id), existing = i === -1 ? null : state.marks[i];
        if (existing && existing.type === type && existing.kind === kind) return;
        changes.push({ id: id, before: existing ? JSON.parse(JSON.stringify(existing)) : null, after: build(id, w, type, kind, o.page, span) });
      });
      return commit(changes);
    }
    function eraseWords(ids) {
      var seen = {}, changes = [];
      (ids || []).forEach(function (id) {
        if (seen[id]) return; seen[id] = true;
        var i = indexOfId(id);
        if (i !== -1) changes.push({ id: id, before: JSON.parse(JSON.stringify(state.marks[i])), after: null });
      });
      return commit(changes);
    }
    function undo() {
      var changes = past.pop();
      if (!changes) return null;
      future.push(changes);
      return { delta: apply(changes, false), page: pageOf(changes) };
    }
    function redo() {
      var changes = future.pop();
      if (!changes) return null;
      past.push(changes);
      return { delta: apply(changes, true), page: pageOf(changes) };
    }
    function getMark(id) { var i = indexOfId(id); return i === -1 ? null : state.marks[i]; }
    function getCounts(pageNum) {
      var p = clampPage(pageNum || state.page);
      return { page: tally(state.marks.filter(function (m) { return m.page === p; })), total: tally(state.marks) };
    }
    function setPage(n) { state.page = clampPage(n); return state.page; }
    function exportPayload() {
      var c = getCounts(state.page).total;
      var list = state.marks.slice().sort(function (a, b) {
        var pa = parseAyahKey(a.ayah_key), pb = parseAyahKey(b.ayah_key);
        return (pa.surah - pb.surah) || (pa.ayah - pb.ayah) || (a.word - b.word);
      }).map(function (m) { return { ayah_key: m.ayah_key, word: m.word, type: m.type, kind: m.kind, at: m.at }; });
      return { version: 2, granularity: 'word', student_id: state.studentId, mistakes: c.mistakes, prompts: c.prompts, marks: list };
    }
    function reset() { state.marks = []; past = []; future = []; }

    return {
      getState: function () { return state; },
      setPage: setPage, markWord: markWord, markSpan: markSpan, eraseWords: eraseWords, undo: undo, redo: redo,
      canUndo: function () { return past.length > 0; }, canRedo: function () { return future.length > 0; },
      getMark: getMark, getCounts: getCounts, exportPayload: exportPayload, reset: reset
    };
  }

  var api = {
    TOTAL_PAGES: TOTAL_PAGES,
    VALID_MARK_TYPES: VALID_MARK_TYPES,
    VALID_KINDS: VALID_KINDS,
    parseWordId: parseWordId,
    buildPageLines: buildPageLines,
    spanBetween: spanBetween,
    overflowScale: overflowScale,
    isOpeningPage: isOpeningPage,
    isCenteredLine: isCenteredLine,
    createFontLoader: createFontLoader,
    PAGE_FONT_URL: PAGE_FONT_URL,
    shortcutAction: shortcutAction,
    QURAN_API_BASE: QURAN_API_BASE,
    CACHE_NAME: CACHE_NAME,
    SURAHS: SURAHS,
    escapeHtml: escapeHtml,
    clampPage: clampPage,
    getSurah: getSurah,
    globalAyahIndex: globalAyahIndex,
    resolvePageForAyah: resolvePageForAyah,
    parseAyahKey: parseAyahKey,
    isAyahInRange: isAyahInRange,
    isTapGesture: isTapGesture,
    normalizeApiPageResponse: normalizeApiPageResponse,
    createPageLoader: createPageLoader,
    createMushafSession: createMushafSession
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.HalaqatiMushafState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
