/* Halaqati Interactive Mushaf — Pure State, Data & Gesture Engine (Phase 1: Ayah-level)
 * Classic-script compatible (attaches to window.HalaqatiMushafState) and Node/CommonJS testable.
 * Zero external dependencies, no Supabase calls, nothing written to storage. The Quran text is never typed in this repo: it comes only from the Quran.com API (or its Cache API copy).
 */
(function (root) {
  'use strict';

  var TOTAL_PAGES = 604;
  var VALID_MARK_TYPES = ['mistake', 'prompt', 'tajweed'];
  var QURAN_API_BASE = 'https://api.quran.com/api/v4/verses/by_page/';
  var CACHE_NAME = 'halaqati-mushaf-pages-v1';

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

  function normalizeApiPageResponse(page, payload) {
    var versesRaw = payload && Array.isArray(payload.verses) ? payload.verses : [];
    var verses = versesRaw.map(function (v) {
      var parsed = parseAyahKey(v.verse_key || v.ayah_key);
      var words = Array.isArray(v.words) ? v.words : [];
      var text = v.text_uthmani || words
        .filter(function (w) { return w && w.char_type_name !== 'end'; })
        .map(function (w) { return w.text_uthmani || w.text || ''; })
        .join(' ')
        .trim();
      var lines = words.map(function (w) { return Number(w.line_number) || 0; }).filter(Boolean);
      return {
        ayah_key: v.verse_key || v.ayah_key || (parsed ? parsed.surah + ':' + parsed.ayah : ''),
        surah: parsed ? parsed.surah : 0,
        ayah: parsed ? parsed.ayah : 0,
        text: text,
        line_start: lines.length ? Math.min.apply(null, lines) : (v.line_start || 1),
        line_end: lines.length ? Math.max.apply(null, lines) : (v.line_end || 1)
      };
    }).filter(function (v) { return v.ayah_key && v.text; });
    var juz = versesRaw[0] && versesRaw[0].juz_number ? versesRaw[0].juz_number : null;
    return {
      page: clampPage(page),
      juz: juz,
      source: 'quran-api-v4',
      verses: verses
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
        return await match.json();
      } catch (_e) {
        return null;
      }
    }

    async function writeToCacheApi(url, responseClone) {
      if (!cachesImpl || typeof cachesImpl.open !== 'function' || !responseClone) return;
      try {
        var cache = await cachesImpl.open(CACHE_NAME);
        await cache.put(url, responseClone);
      } catch (_e) {
        // Ignore quota/private-mode cache errors
      }
    }

    async function loadPage(pageNum) {
      var p = clampPage(pageNum);
      if (memCache.has(p)) {
        return { ok: true, data: memCache.get(p), fromCache: true };
      }
      if (inflight.has(p)) return inflight.get(p);

      var promise = (async function () {
        var url = getUrl(p);
        // 1) Try Cache API first if offline or previously opened
        var cachedJson = await readFromCacheApi(url);
        if (cachedJson) {
          var cachedData = normalizeApiPageResponse(p, cachedJson);
          if (cachedData.verses.length) {
            memCache.set(p, cachedData);
            return { ok: true, data: cachedData, fromCache: true };
          }
        }
        // 2) Fetch single page from Quran.com API v4 (never substitute text typed in this repo: the Quran text only ever comes from the API or its cache)
        if (!fetchImpl) return { ok: false, error: 'لا يتوفر اتصال بالشبكة لتحميل الصفحة', page: p };
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_e) {} }, timeoutMs) : null;
        try {
          var res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined });
          if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'ERR'));
          var clone = typeof res.clone === 'function' ? res.clone() : null;
          var json = await res.json();
          var normalized = normalizeApiPageResponse(p, json);
          if (!normalized.verses.length) throw new Error('EMPTY_PAGE_DATA');
          memCache.set(p, normalized);
          if (clone) await writeToCacheApi(url, clone);
          return { ok: true, data: normalized, fromCache: false };
        } catch (err) {
          var aborted = err && err.name === 'AbortError';
          return { ok: false, error: aborted ? 'انتهت مهلة تحميل الصفحة' : 'تعذر تحميل بيانات الصفحة', page: p };
        } finally {
          if (timer) clearTimeout(timer);
        }
      })();

      inflight.set(p, promise);
      try {
        return await promise;
      } finally {
        inflight.delete(p);
      }
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

  function createMushafSession(options) {
    var opts = options || {};
    var studentId = opts.studentId || null;
    var sessionId = opts.sessionId || null;
    var rowId = opts.rowId || null;
    var nowFn = typeof opts.now === 'function' ? opts.now : Date.now;

    var state = {
      page: clampPage(opts.initialPage || 1),
      readingMode: !studentId,
      studentId: studentId,
      interactionMode: 'recitation', // 'recitation' | 'range'
      marks: [], // { ayah_key, word: null|n, type, page, at }
      rangeDraft: { start: null, end: null }
    };

    function findMarkIndex(ayahKey, word) {
      var targetWord = word == null ? null : Number(word);
      for (var i = 0; i < state.marks.length; i++) {
        if (state.marks[i].ayah_key === ayahKey && state.marks[i].word === targetWord) {
          return i;
        }
      }
      return -1;
    }

    function deltaFor(prevType, nextType) {
      var d = { mist: 0, prompt: 0, tajweed: 0 };
      if (prevType === 'mistake') d.mist -= 1;
      else if (prevType === 'prompt') d.prompt -= 1;
      else if (prevType === 'tajweed') d.tajweed -= 1;

      if (nextType === 'mistake') d.mist += 1;
      else if (nextType === 'prompt') d.prompt += 1;
      else if (nextType === 'tajweed') d.tajweed += 1;
      return d;
    }

    function toggleMark(ayahKey, type, page, word) {
      if (!parseAyahKey(ayahKey)) {
        throw new Error('Invalid ayah_key: ' + ayahKey);
      }
      if (VALID_MARK_TYPES.indexOf(type) === -1) {
        throw new Error('Invalid mark type: ' + type);
      }
      var targetWord = word == null ? null : Number(word);
      var idx = findMarkIndex(ayahKey, targetWord);
      var p = clampPage(page || state.page);

      if (idx !== -1) {
        var existing = state.marks[idx];
        if (existing.type === type) {
          state.marks.splice(idx, 1);
          return { action: 'removed', mark: existing, delta: deltaFor(existing.type, null) };
        }
        var prevType = existing.type;
        var updated = {
          ayah_key: ayahKey,
          word: targetWord,
          type: type,
          page: p,
          at: nowFn()
        };
        state.marks[idx] = updated;
        return { action: 'replaced', mark: updated, prevType: prevType, delta: deltaFor(prevType, type) };
      }

      var created = {
        ayah_key: ayahKey,
        word: targetWord,
        type: type,
        page: p,
        at: nowFn()
      };
      state.marks.push(created);
      return { action: 'added', mark: created, delta: deltaFor(null, type) };
    }

    function clearMark(ayahKey, word) {
      var targetWord = word == null ? null : Number(word);
      var idx = findMarkIndex(ayahKey, targetWord);
      if (idx === -1) {
        return { action: 'noop', mark: null, delta: { mist: 0, prompt: 0, tajweed: 0 } };
      }
      var removed = state.marks.splice(idx, 1)[0];
      return { action: 'removed', mark: removed, delta: deltaFor(removed.type, null) };
    }

    function getMark(ayahKey, word) {
      var idx = findMarkIndex(ayahKey, word);
      return idx === -1 ? null : state.marks[idx];
    }

    function getCounts(pageNum) {
      var p = clampPage(pageNum || state.page);
      var pageCounts = { mistakes: 0, prompts: 0, tajweed: 0 };
      var totalCounts = { mistakes: 0, prompts: 0, tajweed: 0 };
      for (var i = 0; i < state.marks.length; i++) {
        var m = state.marks[i];
        var bucket = m.type === 'mistake' ? 'mistakes' : m.type === 'prompt' ? 'prompts' : 'tajweed';
        totalCounts[bucket] += 1;
        if (m.page === p) pageCounts[bucket] += 1;
      }
      return { page: pageCounts, total: totalCounts };
    }

    function setStudent(nextStudentId) {
      state.studentId = nextStudentId || null;
      state.readingMode = !state.studentId;
        return { studentId: state.studentId, readingMode: state.readingMode };
    }

    function setPage(nextPage) {
      state.page = clampPage(nextPage);
      return state.page;
    }

    function setInteractionMode(mode) {
      state.interactionMode = mode === 'range' ? 'range' : 'recitation';
      if (state.interactionMode === 'recitation') {
        state.rangeDraft = { start: null, end: null };
      }
      return state.interactionMode;
    }

    // keepSurahOrder: a reverse-direction memorisation range (e.g. An-Nas down to Al-Naba) keeps the order of the two taps when the surahs differ
    function selectRangeAyah(surah, ayah, opts) {
      var ref = { surah: parseInt(surah, 10), ayah: parseInt(ayah, 10) };
      if (!Number.isFinite(ref.surah) || !Number.isFinite(ref.ayah)) return null;
      if (!state.rangeDraft.start || state.rangeDraft.end) {
        state.rangeDraft = { start: ref, end: null };
        return { complete: false, start: ref, end: null };
      }
      var start = state.rangeDraft.start;
      var end = ref;
      var keep = !!(opts && opts.keepSurahOrder) && start.surah > end.surah;
      if (!keep && compareAyahRef(start, end) > 0) {
        var tmp = start; start = end; end = tmp;
      }
      state.rangeDraft = { start: start, end: end };
      return {
        complete: true,
        startSurah: start.surah,
        startAyah: start.ayah,
        endSurah: end.surah,
        endAyah: end.ayah
      };
    }

    function exportPayload() {
      var counts = getCounts(state.page);
      return {
        version: 1,
        granularity: 'ayah',
        student_id: state.studentId,
        session_id: sessionId,
        reading_mode: state.readingMode,
        mistakes: counts.total.mistakes,
        prompts: counts.total.prompts,
        tajweed: counts.total.tajweed,
        marks: state.marks.map(function (m) {
          return {
            ayah_key: m.ayah_key,
            word: m.word,
            type: m.type,
            at: m.at
          };
        })
      };
    }

    function reset() {
      state.marks = [];
      state.interactionMode = 'recitation';
      state.rangeDraft = { start: null, end: null };
    }

    return {
      getState: function () { return state; },
      setPage: setPage,
      setStudent: setStudent,
      setInteractionMode: setInteractionMode,
      selectRangeAyah: selectRangeAyah,
      toggleMark: toggleMark,
      clearMark: clearMark,
      getMark: getMark,
      getCounts: getCounts,
      exportPayload: exportPayload,
      reset: reset
    };
  }

  var api = {
    TOTAL_PAGES: TOTAL_PAGES,
    VALID_MARK_TYPES: VALID_MARK_TYPES,
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
