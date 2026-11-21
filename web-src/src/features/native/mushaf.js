/* Halaqati Interactive Mushaf — page view with ayah marks (Phase 1: ayah level).
 * Embedded by native/roster.js as the «المصحف» tab of the Quran-range picker (NSR.openPicker). The component owns only its DOM; every piece of
 * state (marks, page) lives in the HalaqatiMushafState session object that the caller keeps, so a re-render of the picker never loses marks.
 * It never touches the recitation counters itself: it reports {mist, prompt} deltas through opts.onMark and the caller applies them.
 * No storage, no Supabase, no text typed in this repo (the Quran text comes from HalaqatiMushafState's loader only).
 */
(function (root) {
  'use strict';

  var State = root.HalaqatiMushafState;
  if (!State) return;

  var H = function (val) { return State.escapeHtml(val); };
  var sharedLoader = State.createPageLoader();
  var MARK_LABELS = { mistake: 'خطأ', prompt: 'تلقين' };

  function toArabicIndicDigits(n) {
    var map = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(n == null ? '' : n).replace(/\d/g, function (d) { return map[Number(d)]; });
  }

  function surahOptionsHtml(selected) {
    return State.SURAHS.map(function (s) {
      return '<option value="' + H(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' + H(s.id + '. ' + s.name) + '</option>';
    }).join('');
  }

  /* opts: { session, getRange():{startSurah,startAyah,endSurah,endAyah,selectedSurahs,startPage,endPage}|null, recitation:boolean,
   *         onMark(delta), onRange(range{startSurah,startAyah,endSurah,endAyah}), keepSurahOrder():boolean, loader, startPage } */
  function mount(container, opts) {
    if (!container || !opts || !opts.session) return null;
    var session = opts.session;
    var loader = opts.loader || sharedLoader;
    var recitation = opts.recitation !== false;
    var ui = { rendering: false, loading: false, error: null, pageData: null, popover: null, indexOpen: false, indexFilter: '', pointer: null, dead: false, token: 0 };

    function curRange() { try { return (opts.getRange && opts.getRange()) || null; } catch (_e) { return null; } }
    function rangeStartPage() {
      var r = curRange();
      if (!r) return null;
      if (r.startSurah) return State.resolvePageForAyah(r.startSurah, r.startAyah || 1);
      if (r.startPage) return State.clampPage(r.startPage);
      return null;
    }
    function currentSurahId() {
      if (ui.pageData && ui.pageData.verses.length) return ui.pageData.verses[0].surah;
      var p = session.getState().page, id = 1;
      for (var i = 0; i < State.SURAHS.length; i++) { if (State.SURAHS[i].startPage <= p) id = State.SURAHS[i].id; else break; }
      return id;
    }

    function popoverHtml(key) {
      var mark = session.getMark(key), cur = mark ? mark.type : null;
      return '<div class="hm-mushaf-popover" role="dialog" aria-label="تعليم الآية ' + H(key) + '">' +
        '<div class="hm-mushaf-popover-head"><span>آية ' + H(key) + '</span>' +
        '<button type="button" class="hm-mushaf-pop-close" data-action="close-popover" aria-label="إغلاق">×</button></div>' +
        '<div class="hm-mushaf-popover-actions">' +
        '<button type="button" class="hm-mushaf-mark-btn is-mistake' + (cur === 'mistake' ? ' is-selected' : '') + '" data-action="mark" data-mark-type="mistake" data-ayah-key="' + H(key) + '">خطأ</button>' +
        '<button type="button" class="hm-mushaf-mark-btn is-prompt' + (cur === 'prompt' ? ' is-selected' : '') + '" data-action="mark" data-mark-type="prompt" data-ayah-key="' + H(key) + '">تلقين</button>' +
        (cur ? '<button type="button" class="hm-mushaf-mark-btn is-clear" data-action="clear-mark" data-ayah-key="' + H(key) + '">إلغاء</button>' : '') +
        '</div></div>';
    }

    function versesHtml() {
      var st = session.getState();
      if (ui.loading) return '<div class="hm-mushaf-status" role="status">جارٍ تحميل صفحة ' + H(toArabicIndicDigits(st.page)) + '…</div>';
      if (ui.error || !ui.pageData || !ui.pageData.verses.length) {
        return '<div class="hm-mushaf-error" role="alert"><p class="hm-mushaf-error-title">تعذّر عرض صفحة ' + H(toArabicIndicDigits(st.page)) + '</p>' +
          '<p class="hm-mushaf-error-desc">' + H(ui.error || 'تأكد من الاتصال بالإنترنت.') + ' يمكنك متابعة التسميع بالعدّادات اليدوية دون المصحف.</p>' +
          '<div class="hm-mushaf-error-actions"><button type="button" class="hm-mushaf-btn hm-mushaf-btn-primary" data-action="retry">إعادة المحاولة</button></div></div>';
      }
      var range = curRange(), draft = st.rangeDraft, lastSurah = 0, html = '', verses = ui.pageData.verses;
      if (range && range.startSurah && !range.endSurah) range = null;
      for (var i = 0; i < verses.length; i++) {
        var v = verses[i];
        if (v.surah && v.surah !== lastSurah) {
          var info = State.getSurah(v.surah);
          if (v.ayah === 1 && info) {
            html += '<div class="hm-mushaf-surah-banner">سورة ' + H(info.name) + '</div>';
          }
          lastSurah = v.surah;
        }
        var mark = recitation ? session.getMark(v.ayah_key) : null;
        var cls = 'hm-mushaf-ayah';
        if (range && State.isAyahInRange(v.surah, v.ayah, range)) cls += ' is-in-curriculum';
        if (draft.start && draft.start.surah === v.surah && draft.start.ayah === v.ayah) cls += ' is-range-anchor';
        if (mark) cls += ' is-marked is-mark-' + mark.type;
        if (ui.popover === v.ayah_key) cls += ' is-focused';
        html += '<span class="' + cls + '" role="button" tabindex="0" data-ayah-key="' + H(v.ayah_key) + '" data-surah="' + H(v.surah) + '" data-ayah="' + H(v.ayah) + '"' +
          ' aria-label="الآية ' + H(v.ayah) + (mark ? ' — ' + H(MARK_LABELS[mark.type]) : '') + '">' +
          '<span class="hm-mushaf-ayah-text">' + H(v.text) + '</span>' +
          '<span class="hm-mushaf-ayah-num" aria-hidden="true">﴿' + H(toArabicIndicDigits(v.ayah)) + '﴾</span>' +
          (mark ? '<span class="hm-mushaf-ayah-badge is-' + H(mark.type) + '">' + H(MARK_LABELS[mark.type]) + '</span>' : '') + '</span> ';
      }
      if (ui.popover && st.interactionMode === 'recitation' && recitation) html += popoverHtml(ui.popover);
      return html;
    }

    function indexHtml() {
      if (!ui.indexOpen) return '';
      var q = ui.indexFilter.trim();
      var items = State.SURAHS.filter(function (s) { return !q || s.name.indexOf(q) !== -1 || String(s.id) === q; });
      return '<div class="hm-mushaf-index" role="region" aria-label="فهرس السور"><div class="hm-mushaf-index-head">' +
        '<input type="search" class="hm-mushaf-input" data-action="filter-index" placeholder="ابحث باسم السورة أو رقمها…" value="' + H(ui.indexFilter) + '">' +
        '<button type="button" class="hm-mushaf-btn hm-mushaf-btn-ghost" data-action="toggle-index">إغلاق</button></div><div class="hm-mushaf-index-grid">' +
        items.map(function (s) {
          return '<button type="button" class="hm-mushaf-surah-chip" data-action="jump-surah-chip" data-surah-id="' + H(s.id) + '"><span class="hm-mushaf-surah-chip-num">' + H(s.id) +
            '</span><span class="hm-mushaf-surah-chip-name">' + H(s.name) + '</span><span class="hm-mushaf-surah-chip-pg">ص ' + H(s.startPage) + '</span></button>';
        }).join('') + '</div></div>';
    }

    function render() {
      if (ui.dead) return;
      var st = session.getState(), counts = session.getCounts(st.page), target = rangeStartPage();
      var pageBox = container.querySelector('.hm-mushaf-page'), scrollTop = pageBox ? pageBox.scrollTop : 0, samePage = pageBox && pageBox.getAttribute('data-page') === String(st.page);
      var surah = State.getSurah(currentSurahId());
      ui.rendering = true; // removing a focused input fires blur/change synchronously: ignore those while the DOM is being replaced
      try { container.innerHTML = '<div class="hm-mushaf-root" dir="rtl">' +
        (recitation
          ? '<div class="hm-mushaf-topbar"><div class="hm-mushaf-mode-switch" role="group" aria-label="وضع التفاعل">' +
            '<button type="button" class="hm-mushaf-seg-btn' + (st.interactionMode === 'recitation' ? ' is-active' : '') + '" data-action="set-mode" data-mode="recitation">تعليم الأخطاء</button>' +
            '<button type="button" class="hm-mushaf-seg-btn' + (st.interactionMode === 'range' ? ' is-active' : '') + '" data-action="set-mode" data-mode="range">تحديد المقرر</button></div></div>'
          : '<div class="hm-mushaf-hint" role="status">اختر المقرر بلمس آية البداية ثم آية النهاية.</div>') +
        ((st.interactionMode === 'range' || !recitation)
          ? '<div class="hm-mushaf-hint" role="status">' + (st.rangeDraft.start
            ? 'البداية ' + H(toArabicIndicDigits(st.rangeDraft.start.surah + ':' + st.rangeDraft.start.ayah)) + ' — المس آية النهاية.'
            : 'المس آية البداية ثم آية النهاية لتحديد المقرر.') + '</div>' : '') +
        ((target && target !== st.page) ? '<div class="hm-mushaf-curriculum-bar"><span>المقرر المختار يبدأ في صفحة ' + H(toArabicIndicDigits(target)) + '</span>' +
          '<button type="button" class="hm-mushaf-btn hm-mushaf-btn-soft" data-action="jump-curriculum">الانتقال للمقرر</button></div>' : '') +
        '<div class="hm-mushaf-nav">' +
        '<button type="button" class="hm-mushaf-btn hm-mushaf-btn-nav" data-action="prev-page"' + (st.page <= 1 ? ' disabled' : '') + ' aria-label="الصفحة السابقة">السابقة</button>' +
        '<label class="hm-mushaf-page-jump"><span class="sr-only">رقم الصفحة</span><input type="number" min="1" max="604" inputmode="numeric" class="hm-mushaf-page-input" data-action="page-input" value="' + H(st.page) + '" aria-label="رقم الصفحة"><span class="hm-mushaf-page-total">/ 604</span></label>' +
        '<button type="button" class="hm-mushaf-btn hm-mushaf-btn-nav" data-action="next-page"' + (st.page >= 604 ? ' disabled' : '') + ' aria-label="الصفحة التالية">التالية</button>' +
        '<select class="hm-mushaf-select" data-action="jump-surah" aria-label="الانتقال إلى سورة">' + surahOptionsHtml(currentSurahId()) + '</select>' +
        '<button type="button" class="hm-mushaf-btn hm-mushaf-btn-ghost" data-action="toggle-index">فهرس السور</button></div>' +
        indexHtml() +
        (recitation
          ? '<div class="hm-mushaf-counters" aria-live="polite"><div class="hm-mushaf-counter-group"><span class="hm-mushaf-counter-label">هذه الصفحة:</span>' +
            '<span class="hm-mushaf-chip is-mistake">أخطاء <b>' + H(counts.page.mistakes) + '</b></span><span class="hm-mushaf-chip is-prompt">تلقين <b>' + H(counts.page.prompts) + '</b></span></div>' +
            '<div class="hm-mushaf-counter-group"><span class="hm-mushaf-counter-label">كل العلامات:</span>' +
            '<span class="hm-mushaf-chip is-mistake">أخطاء <b>' + H(counts.total.mistakes) + '</b></span><span class="hm-mushaf-chip is-prompt">تلقين <b>' + H(counts.total.prompts) + '</b></span></div></div>' : '') +
        '<div class="hm-mushaf-sheet"><div class="hm-mushaf-sheet-meta"><span>' + H(surah ? 'سورة ' + surah.name : '') + '</span><span>صفحة ' + H(toArabicIndicDigits(st.page)) +
        (ui.pageData && ui.pageData.juz ? ' · الجزء ' + H(toArabicIndicDigits(ui.pageData.juz)) : '') + '</span></div>' +
        '<div class="hm-mushaf-page" tabindex="0" data-page="' + H(st.page) + '" aria-label="صفحة المصحف ' + H(st.page) + '">' + versesHtml() + '</div></div></div>'; } finally { ui.rendering = false; }
      var nb = container.querySelector('.hm-mushaf-page');
      if (nb && samePage) nb.scrollTop = scrollTop;
    }

    function loadPage(n) {
      var token = ++ui.token, p = session.setPage(n);
      ui.loading = true; ui.error = null; ui.popover = null; render();
      return loader.loadPage(p).then(function (res) {
        if (ui.dead || token !== ui.token) return res;
        ui.loading = false;
        if (res && res.ok) { ui.pageData = res.data; ui.error = null; loader.prefetchNext(p); } else { ui.pageData = null; ui.error = (res && res.error) || 'تعذر تحميل بيانات الصفحة'; }
        render();
        return res;
      });
    }

    function applyDelta(res) {
      if (res && res.delta && (res.delta.mist || res.delta.prompt) && typeof opts.onMark === 'function') opts.onMark({ mist: res.delta.mist, prompt: res.delta.prompt });
    }

    function activate(el) {
      var key = el && el.getAttribute('data-ayah-key');
      if (!key) return;
      var st = session.getState();
      if (st.interactionMode === 'range' || !recitation) {
        var r = session.selectRangeAyah(Number(el.getAttribute('data-surah')), Number(el.getAttribute('data-ayah')), { keepSurahOrder: !!(opts.keepSurahOrder && opts.keepSurahOrder()) });
        if (r && r.complete && typeof opts.onRange === 'function') {
          opts.onRange({ startSurah: r.startSurah, startAyah: r.startAyah, endSurah: r.endSurah, endAyah: r.endAyah });
          session.setInteractionMode('recitation');
        }
        render();
        return;
      }
      ui.popover = ui.popover === key ? null : key;
      render();
    }

    function onClick(e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (!t) return;
      var a = t.getAttribute('data-action'), st = session.getState();
      if (a === 'prev-page') loadPage(st.page - 1);
      else if (a === 'next-page') loadPage(st.page + 1);
      else if (a === 'retry') loadPage(st.page);
      else if (a === 'toggle-index') { ui.indexOpen = !ui.indexOpen; render(); }
      else if (a === 'jump-surah-chip') { ui.indexOpen = false; loadPage(State.resolvePageForAyah(Number(t.getAttribute('data-surah-id')), 1)); }
      else if (a === 'jump-curriculum') loadPage(rangeStartPage() || st.page);
      else if (a === 'set-mode') { session.setInteractionMode(t.getAttribute('data-mode')); ui.popover = null; render(); }
      else if (a === 'close-popover') { ui.popover = null; render(); }
      else if (a === 'mark' && recitation) { applyDelta(session.toggleMark(t.getAttribute('data-ayah-key'), t.getAttribute('data-mark-type'), st.page)); ui.popover = null; render(); }
      else if (a === 'clear-mark' && recitation) { applyDelta(session.clearMark(t.getAttribute('data-ayah-key'))); ui.popover = null; render(); }
    }
    function onChange(e) {
      if (ui.rendering) return;
      var t = e.target, a = t && t.getAttribute && t.getAttribute('data-action');
      if (a === 'page-input') loadPage(t.value);
      else if (a === 'jump-surah') loadPage(State.resolvePageForAyah(Number(t.value), 1));
    }
    function onInput(e) {
      if (ui.rendering) return;
      var t = e.target;
      if (!t || !t.getAttribute || t.getAttribute('data-action') !== 'filter-index') return;
      ui.indexFilter = t.value || '';
      render();
      var inp = container.querySelector('[data-action="filter-index"]');
      if (inp) { inp.focus(); inp.setSelectionRange(ui.indexFilter.length, ui.indexFilter.length); }
    }
    function onPointerDown(e) {
      var el = e.target && e.target.closest ? e.target.closest('.hm-mushaf-ayah') : null;
      ui.pointer = el ? { x: e.clientX, y: e.clientY, t: Date.now(), key: el.getAttribute('data-ayah-key') } : null;
    }
    function onPointerUp(e) {
      var s = ui.pointer; ui.pointer = null;
      var el = e.target && e.target.closest ? e.target.closest('.hm-mushaf-ayah') : null;
      if (!s || !el || el.getAttribute('data-ayah-key') !== s.key) return;
      if (State.isTapGesture(s, { x: e.clientX, y: e.clientY, t: Date.now(), cancelled: false })) activate(el);
    }
    function onKey(e) {
      var t = e.target;
      // Enter inside the page-number box / index search must never reach a surrounding form or dialog default action
      if (e.key === 'Enter' && t && t.tagName === 'INPUT') {
        e.preventDefault();
        if (t.getAttribute('data-action') === 'page-input') loadPage(t.value);
        return;
      }
      if (e.key === 'Escape' && ui.popover) { e.stopPropagation(); e.preventDefault(); ui.popover = null; render(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('hm-mushaf-ayah')) { e.preventDefault(); activate(t); }
    }
    function onPointerCancel() { ui.pointer = null; }

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('input', onInput);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerCancel);
    container.addEventListener('keydown', onKey);

    var inst = {
      loadPage: loadPage,
      destroy: function () {
        ui.dead = true;
        ['click', 'change', 'input', 'pointerdown', 'pointerup', 'pointercancel', 'keydown'].forEach(function (ev) {
          container.removeEventListener(ev, { click: onClick, change: onChange, input: onInput, pointerdown: onPointerDown, pointerup: onPointerUp, pointercancel: onPointerCancel, keydown: onKey }[ev]);
        });
      }
    };
    var first = session.getState().page || 1;
    loadPage(first);
    return inst;
  }

  var api = { mount: mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HalaqatiMushaf = api;
})(typeof window !== 'undefined' ? window : globalThis);
