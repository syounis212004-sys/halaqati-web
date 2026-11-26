/* Halaqati interactive mushaf v2: a full 15-line page with marking tools (tap a word, drag to highlight, eraser, undo/redo).
 * The component owns only its DOM. Marks and history live in the HalaqatiMushafState session the caller keeps; mark deltas are reported through
 * opts.onMark({mist, prompt}) and the caller turns them into the recitation counters. No storage, no Supabase, no Quran text typed in this repo.
 * opts: { session, loader?, getRange():range|null, getCounters():{mistakes,prompts}, getV6():{safety,label}|null (the official score), onMark(delta) } */
(function (root) {
  'use strict';

  var S = root.HalaqatiMushafState;
  if (!S) return;
  var H = function (v) { return S.escapeHtml(v); };
  var sharedLoader = S.createPageLoader(), fontLoader = S.createFontLoader(), basmalaCache = null;
    var KINDS = [['word', 'كلمة'], ['harakah', 'حركة'], ['ayah_start', 'بداية آية']];
  var ICONS = {
    tap: 'M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26a1 1 0 0 0-.44-.1h-.67V7.5a1.5 1.5 0 0 0-3 0v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z',
    highlight: 'M6 14l3 3v5h6v-5l3-3V9H6zm5-12h2v3h-2zM3.5 5.88l1.41-1.41 2.12 2.12L5.62 8zm13.46.71 2.12-2.12 1.41 1.41L18.38 8z',
    erase: 'M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z',
    undo: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z'
  };
  var icon = function (name, flip) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (flip ? ' style="transform:scaleX(-1)"' : '') + '><path d="' + ICONS[name] + '"/></svg>'; };
  function digits(n) { return String(n == null ? '' : n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[+d]; }); }

  function mount(container, opts) {
    if (!container || !opts || !opts.session) return null;
    var session = opts.session, loader = opts.loader || sharedLoader;
    var ui = { tool: 'tap', type: 'mistake', data: null, lines: null, loading: false, error: null, token: 0, drag: null, pressTimer: 0, focusId: null, dead: false, raf: 0 };

    container.innerHTML =
      '<div class="hm-mushaf-root" dir="rtl">' +
        '<div class="hm-nav">' +
          '<button type="button" class="hm-pagebtn" data-act="prev" aria-label="الصفحة السابقة">السابقة</button>' +
          '<input class="hm-pageinput" type="number" min="1" max="604" inputmode="numeric" data-act="page" aria-label="رقم الصفحة">' +
          '<span class="hm-pagetotal">/ ٦٠٤</span>' +
          '<button type="button" class="hm-pagebtn" data-act="next" aria-label="الصفحة التالية">التالية</button>' +
          '<button type="button" class="hm-pagebtn hm-jump" data-act="range" hidden>إلى المقرر</button>' +
          '<button type="button" class="hm-pagebtn" data-act="jumpdlg" aria-haspopup="dialog" hidden>الانتقال</button>' +
          '<button type="button" class="hm-pagebtn" data-act="bookmark" aria-pressed="false" hidden>☆ علامة</button>' +
        '</div>' +
        '<div class="hm-score" data-score></div>' +
        '<div class="hm-pagewrap"><div class="hm-page" role="group" aria-label="صفحة المصحف">' +
          '<div class="hm-page-head"><span data-surah></span><span class="hm-inrange" data-inrange></span><span data-juz></span></div>' +
          '<div class="hm-lines" data-lines></div>' +
          '<div class="hm-page-foot" data-foot></div>' +
        '</div></div>' +
        '<div class="hm-credit">خطوط المصحف: مجمع الملك فهد لطباعة المصحف الشريف · عبر Quran Foundation</div>' +
        '<div class="hm-bottom">' +
        '<div class="hm-types" role="group" aria-label="نوع العلامة">' +
          '<button type="button" class="hm-type is-mistake" data-type="mistake" aria-pressed="true"><span class="hm-swatch" aria-hidden="true"></span><span>خطأ</span><b data-count="mistakes">٠</b></button>' +
          '<button type="button" class="hm-type is-prompt" data-type="prompt" aria-pressed="false"><span class="hm-swatch" aria-hidden="true"></span><span>تلقين</span><b data-count="prompts">٠</b></button>' +
        '</div>' +
        '<div class="hm-dock" role="toolbar" aria-label="أدوات التعليم">' +
          '<button type="button" class="hm-tool" data-tool="tap" aria-pressed="true" title="لمس كلمة (T)">' + icon('tap') + '<span>لمس</span></button>' +
          '<button type="button" class="hm-tool" data-tool="highlight" aria-pressed="false" title="تظليل بالسحب (H)">' + icon('highlight') + '<span>تظليل</span></button>' +
          '<button type="button" class="hm-tool" data-tool="erase" aria-pressed="false" title="ممحاة (E)">' + icon('erase') + '<span>ممحاة</span></button>' +
          '<button type="button" class="hm-tool" data-act="undo" title="تراجع (Ctrl+Z)" aria-label="تراجع">' + icon('undo') + '</button>' +
          '<button type="button" class="hm-tool" data-act="redo" title="إعادة (Ctrl+Shift+Z)" aria-label="إعادة">' + icon('undo', true) + '</button>' +
        '</div>' +
        '</div>' +
        '<div class="hm-live" aria-live="polite" data-live></div>' +
      '</div>';

    var $ = function (sel) { return container.querySelector(sel); };
    var linesEl = $('[data-lines]'), pageEl = $('.hm-page'), liveEl = $('[data-live]'), inputEl = $('[data-act="page"]');

    function curRange() { try { return (opts.getRange && opts.getRange()) || null; } catch (_e) { return null; } }
    function rangeStartPage() { var r = curRange(); if (!r) return null; if (r.startSurah) return S.resolvePageForAyah(r.startSurah, r.startAyah || 1); return r.startPage ? S.clampPage(Math.min(+r.startPage, +(r.endPage || r.startPage))) : null; }
    function counters() {
      var c = session.getCounts().total, ext = opts.getCounters ? opts.getCounters() : null;
      return ext ? { mistakes: ext.mistakes, prompts: ext.prompts, marked: c } : { mistakes: c.mistakes, prompts: c.prompts, marked: c };
    }

    // ---- hud: counts on the type buttons, score preview, undo/redo state, page number
    function updateHud() {
      var c = counters(), page = session.getState().page, start = rangeStartPage();
      container.querySelector('[data-count="mistakes"]').textContent = digits(c.mistakes);
      container.querySelector('[data-count="prompts"]').textContent = digits(c.prompts);
      container.querySelectorAll('[data-type]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-type') === ui.type)); });
      container.querySelectorAll('[data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tool') === ui.tool)); });
      $('[data-act="undo"]').disabled = !session.canUndo(); $('[data-act="redo"]').disabled = !session.canRedo();
      $('[data-act="prev"]').disabled = page <= 1; $('[data-act="next"]').disabled = page >= 604;
      var jump = $('[data-act="range"]'); jump.hidden = !(start && start !== page);
      if (document.activeElement !== inputEl) inputEl.value = page;
      if (J) { var bm = $('[data-act="bookmark"]'), on = marks.indexOf(page) >= 0; bm.setAttribute('aria-pressed', String(on)); bm.textContent = (on ? '★ علامة محفوظة' : '☆ علامة'); }
      var v = opts.getV6 ? opts.getV6() : null, html;
      if (v) {
        var over = session.overLimitPages();
        html = '<span>التقدير: <b>' + digits(v.safety) + '٪ ' + H(v.label || '') + '</b></span>' +
          '<small>' + (v.pages ? 'محسوب على ' + digits(Math.round(v.pages * 100) / 100) + ' صفحة: ' + digits(c.mistakes) + ' أخطاء و' + digits(c.prompts) + ' تلقينات. ' : '') + 'الحد الأعلى للصفحة: خطأ (جملة) وتلقينان</small>' +
          (over.length ? '<small class="hm-over" role="status">تنبيه: ' + over.map(function (o) { return 'صفحة ' + digits(o.page) + ' فيها ' + digits(o.mistakes) + ' أخطاء و' + digits(o.prompts) + ' تلقينات'; }).join('، ') + ' (فوق الحد، فالنتيجة إعادة)</small>' : '');
      } else html = '<small>اختر المقرر أولاً ليظهر التقدير.</small>';
      $('[data-score]').innerHTML = html;
    }

    function undoRedo(kind) {
      var r = kind === 'undo' ? session.undo() : session.redo(); if (!r) return;
      applyResult({ delta: r.delta, changed: 1 }, kind === 'undo' ? 'تراجع' : 'إعادة');
      if (r.page && r.page !== session.getState().page) { loadPage(r.page); liveEl.textContent += '. انتقلنا إلى صفحة ' + r.page; }
    }
    function announce(r, what) { if (r && r.changed) { var c = counters(); liveEl.textContent = what + '. أخطاء ' + c.mistakes + '، تلقين ' + c.prompts; } }
    function applyResult(r, what) {
      if (r && r.delta && (r.delta.mist || r.delta.prompt) && typeof opts.onMark === 'function') opts.onMark({ mist: r.delta.mist, prompt: r.delta.prompt });
      paintMarks(); announce(r, what);
    }

    // ---- page rendering
    function pageWords() { return ui.lines ? [].concat.apply([], ui.lines.map(function (l) { return l.words; })) : []; }
    function renderPage() {
      var st = session.getState(), surahId = ui.lines && pageWords()[0] ? pageWords()[0].surah : null, info = surahId ? S.getSurah(surahId) : null;
      $('[data-surah]').textContent = info ? 'سورة ' + info.name : '';
      $('[data-juz]').textContent = ui.data && ui.data.juz ? 'الجزء ' + digits(ui.data.juz) : '';
      $('[data-foot]').textContent = digits(st.page);
      if (ui.loading) { linesEl.innerHTML = '<div class="hm-status" role="status" style="grid-row:1 / -1">جارٍ تحميل صفحة ' + H(digits(st.page)) + '…</div>'; return; }
      if (ui.error || !ui.lines) {
        linesEl.innerHTML = '<div class="hm-error" role="alert" style="grid-row:1 / -1"><p>تعذّر عرض صفحة ' + H(digits(st.page)) + '.</p><p>' + H(ui.error || 'تأكد من الاتصال بالإنترنت.') + ' يمكنك متابعة التسميع بالعدّادات اليدوية دون المصحف.</p><button type="button" class="hm-pagebtn" data-act="retry">إعادة المحاولة</button></div>';
        return;
      }
      var first = true, page = st.page, opening = S.isOpeningPage(page), shown = ui.lines;
      if (opening) shown = shown.filter(function (l) { return l.kind !== 'empty'; });
      linesEl.classList.toggle('is-opening', opening);
      linesEl.innerHTML = shown.map(function (l) {
        if (l.kind === 'banner') return '<div class="hm-line is-banner"><span class="hm-frame" role="img" aria-label="سورة ' + H((S.getSurah(l.surah) || {}).name || '') + '"><span class="hm-sname" aria-hidden="true">surah</span><span class="hm-sname" aria-hidden="true">' + H(String(l.surah).padStart(3, '0')) + '</span></span></div>';
        if (l.kind === 'basmala') return '<div class="hm-line is-basmala" role="img" aria-label="بسم الله الرحمن الرحيم" style="font-family:qcf-v2-p1">' + (basmalaCache || []).map(function (g) { return '<span aria-hidden="true">' + H(g) + '</span>'; }).join('') + '</div>';
        if (l.kind === 'empty') return '<div class="hm-line"></div>';
        return '<div class="hm-line' + (S.isCenteredLine(page, l.n) ? ' is-center' : '') + '">' + l.items.map(function (w) {
          var fam = 'style="font-family:qcf-v2-p' + (+w.fontPage || page) + '"';
          if (w.end) return '<span class="hm-end" aria-hidden="true" ' + fam + '>' + H(w.glyph) + '</span>';
          var tab = first ? 0 : -1; first = false;
          return '<span class="hm-word" lang="ar" role="button" tabindex="' + tab + '" aria-label="' + H(w.text) + '" data-wid="' + H(w.id) + '" ' + fam + '>' + H(w.glyph) + '</span>';
        }).join('') + '</div>';
      }).join('');
      ui.focusId = pageWords()[0] ? pageWords()[0].id : null;
      fit(); paintMarks();
    }

    // one size for the whole page (CSS); only a line wider than the text block is made smaller, by one ratio
    function fit() {
      linesEl.querySelectorAll('.hm-line').forEach(function (row) {
        row.style.fontSize = '';
        if (!row.querySelector('.hm-word')) return;
        var natural = 0, gap = parseFloat(getComputedStyle(row).columnGap) || 0;
        for (var i = 0; i < row.children.length; i++) natural += row.children[i].getBoundingClientRect().width;
        natural += gap * Math.max(0, row.children.length - 1);
        var k = S.overflowScale(natural, row.getBoundingClientRect().width);
        if (k < 1) row.style.fontSize = 'calc(1em * ' + k + ')';
      });
    }

    function paintMarks() {
      var range = curRange(), byId = {}, total = 0, inside = 0;
      pageWords().forEach(function (w) { byId[w.id] = w; });
      linesEl.querySelectorAll('.hm-word').forEach(function (el) {
        var id = el.getAttribute('data-wid'), m = session.getMark(id), w = byId[id];
        el.classList.toggle('is-mistake', !!m && m.type === 'mistake');
        el.classList.toggle('is-prompt', !!m && m.type === 'prompt');
        el.classList.toggle('is-harakah', !!m && m.kind === 'harakah');
        if (range && w) { total++; if (S.isAyahInRange(w.surah, w.ayah, range.startSurah || (range.selectedSurahs && range.selectedSurahs.length) ? range : Object.assign({}, range, { page: session.getState().page }))) inside++; }
        if (m) el.setAttribute('aria-label', (w ? w.text : '') + ' — ' + (m.type === 'mistake' ? 'خطأ' : 'تلقين') + (m.kind === 'harakah' ? ' في الحركة' : m.kind === 'ayah_start' ? ' في بداية الآية' : ''));
        else if (w) el.setAttribute('aria-label', w.text);
      });
      var chip = $('[data-inrange]'); if (chip) chip.textContent = !total || !inside ? '' : inside === total ? 'ضمن المقرر' : 'جزء من المقرر';
      updateHud();
    }

    // the glyph fonts (page font, surah names, page-1 font for the basmala) must be ready before the page is drawn
    function prepareGlyphs(data, p) {
      var fams = {}; (data.items || []).forEach(function (w) { fams[+w.fontPage || p] = 1; });
      var needsBasmala = S.isOpeningPage(p) ? false : S.buildPageLines(data).lines.some(function (l) { return l.kind === 'basmala'; });
      var jobs = Object.keys(fams).map(function (n) { return fontLoader.loadPageFont(+n); });
      jobs.push(fontLoader.loadSurahNames());
      if (needsBasmala || S.buildPageLines(data).lines.some(function (l) { return l.kind === 'basmala'; })) {
        jobs.push(fontLoader.loadPageFont(1));
        if (!basmalaCache) jobs.push(Promise.resolve(loader.loadPage(1)).then(function (r) {
          if (r && r.ok) basmalaCache = (r.data.words || []).filter(function (w) { return w.ayah_key === '1:1'; }).slice(0, 4).map(function (w) { return w.glyph; });
        }));
      }
      return Promise.all(jobs).then(function (r) {
        var bad = r.filter(function (x) { return x && x.ok === false && /qcf-v2-p/.test(x.family || ''); });
        if (bad.length) return 'تعذر تحميل خط الصفحة. تأكد من الاتصال بالإنترنت (تُحفظ الخطوط بعد أول تحميل).';
        return null;
      }).catch(function () { return 'تعذر تحميل خط الصفحة'; });
    }

    function loadPage(n) {
      var token = ++ui.token, p = session.setPage(n);
      ui.loading = true; ui.error = null; closeKinds(); renderPage(); updateHud();
      return Promise.resolve().then(function () { return loader.loadPage(p); }).catch(function () { return { ok: false, error: 'تعذر تحميل بيانات الصفحة' }; }).then(function (res) {
        if (ui.dead || token !== ui.token) return res;
        if (res && res.ok) {
          return prepareGlyphs(res.data, p).then(function (fe) {
            if (ui.dead || token !== ui.token) return res;
            ui.loading = false;
            if (fe) { ui.data = null; ui.lines = null; ui.error = fe; }
            else { ui.data = res.data; ui.lines = S.buildPageLines(res.data).lines; ui.error = null; loader.prefetchNext(p); }
            renderPage(); updateHud(); return res;
          });
        }
        else { ui.loading = false; ui.data = null; ui.lines = null; ui.error = (res && res.error) || 'تعذر تحميل بيانات الصفحة'; }
        renderPage(); updateHud();
        return res;
      });
    }

    // ---- tools
    function wordEl(id) { return linesEl.querySelector('.hm-word[data-wid="' + id + '"]'); }
    function wordAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.hm-word') : null; }
    function previewSpan(ids) { linesEl.querySelectorAll('.is-preview').forEach(function (e) { e.classList.remove('is-preview'); }); (ids || []).forEach(function (id) { var e = wordEl(id); if (e) e.classList.add('is-preview'); }); }
    function setTool(t) { ui.tool = t; linesEl.classList.toggle('is-drag', t !== 'tap'); updateHud(); }
    function setType(t) { ui.type = t; updateHud(); }
    var NAME = { mistake: 'خطأ', prompt: 'تلقين' };
    function actOnWord(id) {
      if (ui.tool === 'erase') return applyResult(session.eraseWords([id]), 'مُسحت العلامة');
      if (ui.tool === 'highlight') return applyResult(session.markSpan([id], ui.type, { page: session.getState().page }), 'تم وضع علامة ' + NAME[ui.type]);
      return applyResult(session.markWord(id, ui.type, { page: session.getState().page }), 'تم تبديل علامة ' + NAME[ui.type]);
    }

    function closeKinds() { var k = pageEl.querySelector('.hm-kinds'); if (k) k.remove(); }
    function openKinds(el) {
      closeKinds();
      var id = el.getAttribute('data-wid'), r = el.getBoundingClientRect(), p = pageEl.getBoundingClientRect(), box = document.createElement('div');
      box.className = 'hm-kinds'; box.setAttribute('role', 'menu');
      box.innerHTML = KINDS.map(function (k) { return '<button type="button" role="menuitem" data-kind="' + k[0] + '">' + k[1] + '</button>'; }).join('');
      box.style.top = Math.max(0, r.top - p.top - 56) + 'px';
      box.style.insetInlineStart = Math.min(Math.max(0, p.right - r.right), p.width - 230) + 'px';
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-kind]'); if (!b) return;
        applyResult(session.markWord(id, ui.type, { page: session.getState().page, kind: b.getAttribute('data-kind') }), 'تم وضع علامة ' + NAME[ui.type]);
        closeKinds();
      });
      pageEl.appendChild(box);
      var f = box.querySelector('button'); if (f) f.focus();
    }

    // ---- pointer: tap, long press, drag span
    linesEl.addEventListener('pointerdown', function (e) {
      var w = e.target.closest && e.target.closest('.hm-word'); if (!w) return;
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      clearTimeout(ui.pressTimer); closeKinds();
      var id = w.getAttribute('data-wid');
      ui.drag = { x: e.clientX, y: e.clientY, t: Date.now(), anchor: id, current: id, moved: false, long: false };
      if (ui.tool === 'tap') ui.pressTimer = setTimeout(function () { if (ui.drag && !ui.drag.moved) { ui.drag.long = true; openKinds(w); } }, 450);
      else { try { linesEl.setPointerCapture(e.pointerId); } catch (_e) {} previewSpan([id]); }
    });
    linesEl.addEventListener('pointermove', function (e) {
      var d = ui.drag; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) { d.moved = true; clearTimeout(ui.pressTimer); }
      if (ui.tool !== 'tap' && d.moved) { var w = wordAt(e.clientX, e.clientY); if (w) { d.current = w.getAttribute('data-wid'); previewSpan(S.spanBetween(ui.lines, d.anchor, d.current)); } }
    });
    function endPointer(e, cancelled) {
      var d = ui.drag; ui.drag = null; clearTimeout(ui.pressTimer);
      if (!d || cancelled) { previewSpan([]); return; }
      if (d.long) return;
      if (ui.tool === 'tap') { if (S.isTapGesture(d, { x: e.clientX, y: e.clientY, t: Date.now(), cancelled: false })) actOnWord(d.anchor); return; }
      var ids = S.spanBetween(ui.lines, d.anchor, d.current); previewSpan([]);
      if (!ids.length) return;
      if (ui.tool === 'erase') applyResult(session.eraseWords(ids), 'مُسحت العلامات');
      else applyResult(session.markSpan(ids, ui.type, { page: session.getState().page }), 'تم تظليل ' + ids.length + ' كلمة');
    }
    linesEl.addEventListener('pointerup', function (e) { endPointer(e, false); });
    linesEl.addEventListener('pointercancel', function (e) { endPointer(e, true); });
    linesEl.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('.hm-word')) e.preventDefault(); });

    linesEl.addEventListener('focusin', function (e) {
      var w = e.target.closest && e.target.closest('.hm-word'); if (!w || w.getAttribute('data-wid') === ui.focusId) return;
      var cur = wordEl(ui.focusId); if (cur) cur.setAttribute('tabindex', '-1');
      w.setAttribute('tabindex', '0'); ui.focusId = w.getAttribute('data-wid');
    });
    // ---- buttons, page input, keyboard
    container.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tool],[data-type],[data-act]'); if (!t) return;
      if (t.hasAttribute('data-tool')) return setTool(t.getAttribute('data-tool'));
      if (t.hasAttribute('data-type')) return setType(t.getAttribute('data-type'));
      var a = t.getAttribute('data-act'), page = session.getState().page;
      if (a === 'prev') loadPage(page - 1); else if (a === 'next') loadPage(page + 1); else if (a === 'retry') loadPage(page);
      else if (a === 'range') loadPage(rangeStartPage() || page);
      else if (a === 'jumpdlg') openJump();
      else if (a === 'bookmark') { marks = J.toggleBookmark(marks, page); J.saveBookmarks(undefined, marks); updateHud(); liveEl.textContent = marks.indexOf(page) >= 0 ? 'أُضيفت علامة مرجعية للصفحة ' + digits(page) : 'أُزيلت العلامة المرجعية'; }
      else if (a === 'undo' || a === 'redo') undoRedo(a);
    });
    inputEl.addEventListener('change', function () { if (ui.dead || inputEl.value === '') { inputEl.value = session.getState().page; return; } loadPage(inputEl.value).then(function () { inputEl.value = session.getState().page; }); });
    function focusWord(id) {
      var el = id && wordEl(id); if (!el) return;
      var cur = wordEl(ui.focusId); if (cur) cur.setAttribute('tabindex', '-1');
      el.setAttribute('tabindex', '0'); ui.focusId = id; el.focus();
    }
    function moveFocus(dir) {
      var words = pageWords(), i = words.findIndex(function (w) { return w.id === ui.focusId; });
      if (i === -1) return;
      if (dir === 'next') return focusWord((words[i + 1] || words[i]).id);
      if (dir === 'prev') return focusWord((words[i - 1] || words[i]).id);
      var line = ui.lines.findIndex(function (l) { return l.words.some(function (w) { return w.id === ui.focusId; }); }), step = dir === 'down' ? 1 : -1;
      for (var j = line + step; j >= 0 && j < ui.lines.length; j += step) if (ui.lines[j].words.length) {
        var idx = Math.min(ui.lines[line].words.findIndex(function (w) { return w.id === ui.focusId; }), ui.lines[j].words.length - 1);
        return focusWord(ui.lines[j].words[idx].id);
      }
    }
    container.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && t.tagName === 'INPUT') { if (e.key === 'Enter') { e.preventDefault(); t.blur(); } return; }
      if (e.key === 'Escape' && pageEl.querySelector('.hm-kinds')) { e.preventDefault(); e.stopPropagation(); closeKinds(); var f = wordEl(ui.focusId); if (f) f.focus(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('hm-word')) { e.preventDefault(); if (e.repeat) return; actOnWord(t.getAttribute('data-wid')); return; }
      var a = S.shortcutAction(e); if (!a) return;
      e.preventDefault();
      if (a.type === 'type') setType(a.value); else if (a.type === 'tool') setTool(a.value);
      else if (a.type === 'undo' || a.type === 'redo') undoRedo(a.type);
      else if (a.type === 'move' && t && t.classList && t.classList.contains('hm-word')) moveFocus(a.value);
    });

    // ---- jump dialog (RC114, port of Android MushafJump): page / surahs / juz tabs, the assigned range as a card, bookmarks, jump to an ayah
    var J = root.HalaqatiMushafJump || null, marks = [], jump = { tab: 'page', picked: null, q: '' };
    if (J) { marks = J.loadBookmarks(); ['jumpdlg', 'bookmark'].forEach(function (a) { $('[data-act="' + a + '"]').hidden = false; }); }
    function layoutObj() { return root.HALAQATI_QURAN_LAYOUT || null; }
    function openJump() {
      if (!J || ui.dead) return;
      var d = document.getElementById('hmJump');
      if (!d) { d = document.createElement('dialog'); d.id = 'hmJump'; d.className = 'hm-jump-dlg'; d.setAttribute('aria-labelledby', 'hmJumpT'); document.body.appendChild(d); d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); }
      jump.tab = 'page'; jump.picked = null; jump.q = '';
      var go = function (p) { if (d.open) d.close(); if (!ui.dead && p) loadPage(p); };
      function paint() {
        var page = session.getState().page, lay = layoutObj(), info = S.getSurah((pageWords()[0] || {}).surah), rp = J.rangePages(rangeStartPage(), (function () { var r = curRange(); return r ? (r.endSurah ? S.resolvePageForAyah(r.endSurah, r.endAyah || 1) : r.endPage) : null; })());
        var tabs = [['page', 'الصفحة'], ['surahs', 'السور'], ['juz', 'الأجزاء']];
        var range = rp.length ? '<section class="hm-jump-range" aria-label="ضمن المقرر"><div class="hm-jump-rhead"><b>ضمن المقرر</b><span>' + (rp.length === 1 ? 'صفحة ' + digits(rp[0]) : 'ص ' + digits(rp[0]) + ' ← ' + digits(rp[rp.length - 1]) + ' (' + digits(rp.length) + ' صفحة)') + '</span></div><div class="hm-jump-chips">' +
          (rp.length <= 12 ? rp.map(function (p) { return '<button type="button" class="hm-chip' + (p === page ? ' on' : '') + '" data-go="' + p + '"' + (p === page ? ' aria-current="true"' : '') + '>' + digits(p) + '</button>'; }).join('') : '<button type="button" class="hm-chip" data-go="' + rp[0] + '">أول المقرر</button><button type="button" class="hm-chip" data-go="' + rp[rp.length - 1] + '">آخر المقرر</button>') + '</div></section>' : '';
        var pane;
        if (jump.tab === 'page') {
          pane = '<div class="hm-jump-row"><label for="hmJumpPage">رقم الصفحة (١–٦٠٤)</label><input id="hmJumpPage" class="hm-pageinput" type="text" inputmode="numeric" dir="ltr" value="' + page + '" aria-describedby="hmJumpPageE"><button type="button" class="hm-pagebtn" data-act2="gopage">انتقال</button></div><div id="hmJumpPageE" class="hm-jump-err" role="alert"></div>' +
            '<input id="hmJumpSlider" class="hm-jump-slider" type="range" min="1" max="604" value="' + page + '" aria-label="تحديد الصفحة بالشريط">' +
            (marks.length ? '<h4>العلامات المرجعية</h4><div class="hm-jump-chips">' + marks.map(function (p) { return '<button type="button" class="hm-chip' + (p === page ? ' on' : '') + '" data-go="' + p + '">ص ' + digits(p) + '</button>'; }).join('') + '</div>' : '<p class="hm-jump-hint">لا علامات مرجعية بعد. استعمل زر «☆ علامة» لحفظ الصفحة.</p>');
        } else if (jump.tab === 'surahs') {
          var list = J.filterSurahs(S.SURAHS, jump.q);
          pane = '<label for="hmJumpQ">ابحث عن سورة</label><input id="hmJumpQ" class="hm-jump-q" type="search" value="' + H(jump.q) + '" autocomplete="off"><ul class="hm-jump-list">' + (list.length ? list.map(function (sn) {
            var open = jump.picked === sn.id;
            return '<li><button type="button" class="hm-surah' + (open ? ' on' : '') + '" data-surah="' + sn.id + '" aria-expanded="' + open + '"><span class="hm-snum" aria-hidden="true">' + digits(sn.id) + '</span><b>' + H(sn.name) + '</b><small>' + digits(sn.ayahs) + ' آية · ص ' + digits(S.resolvePageForAyah(sn.id, 1)) + '</small></button>' +
              (open ? '<div class="hm-jump-ayah"><label for="hmJumpAyah">رقم الآية (١–' + digits(sn.ayahs) + ')</label><div class="hm-jump-row"><input id="hmJumpAyah" class="hm-pageinput" type="text" inputmode="numeric" dir="ltr" aria-describedby="hmJumpAyahE"><button type="button" class="hm-pagebtn" data-act2="goayah">اذهب إلى الآية</button><button type="button" class="hm-pagebtn" data-go="' + S.resolvePageForAyah(sn.id, 1) + '">بداية السورة</button></div><div id="hmJumpAyahE" class="hm-jump-err" role="alert"></div></div>' : '') + '</li>';
          }).join('') : '<li class="hm-jump-hint">لا توجد سورة بهذا الاسم.</li>') + '</ul>';
        } else {
          var cur = J.juzOfPage(page, lay);
          pane = '<div class="hm-juz-grid">' + Array.apply(null, Array(30)).map(function (_x, i) { var j = i + 1, p = J.juzStartPage(j, lay); return '<button type="button" class="hm-juz' + (j === cur ? ' on' : '') + '" data-go="' + p + '"' + (j === cur ? ' aria-current="true"' : '') + '><b>' + digits(j) + '</b><small>ص ' + digits(p) + '</small></button>'; }).join('') + '</div><p class="hm-jump-hint">اضغط الجزء للانتقال إلى أول صفحة فيه.</p>';
        }
        d.innerHTML = '<div class="hm-jump-body" dir="rtl"><header><div><h3 id="hmJumpT">الانتقال</h3><small>' + H(J.hereLabel(page, info ? info.name : '', lay)) + '</small></div><button type="button" class="hm-pagebtn" data-act2="close">إغلاق</button></header>' + range +
          '<div class="hm-jump-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" id="hmJumpTab-' + t[0] + '" aria-selected="' + (jump.tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div class="hm-jump-pane" role="tabpanel" aria-labelledby="hmJumpTab-' + jump.tab + '">' + pane + '</div></div>';
      }
      d.onclick = function (e) {
        if (e.target === d) return d.close();
        var t = e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-go')) return go(+t.getAttribute('data-go'));
        if (t.hasAttribute('data-tab')) { jump.tab = t.getAttribute('data-tab'); paint(); var tb = d.querySelector('[data-tab="' + jump.tab + '"]'); if (tb) tb.focus(); return; }
        if (t.hasAttribute('data-surah')) { var id = +t.getAttribute('data-surah'); jump.picked = jump.picked === id ? null : id; paint(); var a = d.querySelector('#hmJumpAyah') || d.querySelector('[data-surah="' + id + '"]'); if (a) a.focus(); return; }
        var act = t.getAttribute('data-act2');
        if (act === 'close') return d.close();
        if (act === 'gopage') { var p = J.parsePage(d.querySelector('#hmJumpPage').value), er = d.querySelector('#hmJumpPageE'); if (!p) { er.textContent = 'اكتب رقم صفحة بين ١ و٦٠٤'; return; } return go(p); }
        if (act === 'goayah') { var sn = S.getSurah(jump.picked), ay = sn && J.parseAyah(d.querySelector('#hmJumpAyah').value, sn.ayahs), ee = d.querySelector('#hmJumpAyahE'); if (!ay) { ee.textContent = 'اكتب رقم آية بين ١ و' + digits(sn ? sn.ayahs : 0); return; } return go(S.resolvePageForAyah(sn.id, ay)); }
      };
      d.oninput = function (e) {
        if (e.target.id === 'hmJumpSlider') { var f = d.querySelector('#hmJumpPage'); if (f) f.value = e.target.value; }
        else if (e.target.id === 'hmJumpQ') { jump.q = e.target.value; var pos = e.target.selectionStart; paint(); var q = d.querySelector('#hmJumpQ'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (_e) {} } }
      };
      d.onkeydown = function (e) { if (e.key === 'Enter' && e.target.id === 'hmJumpPage') { e.preventDefault(); var b = d.querySelector('[data-act2="gopage"]'); if (b) b.click(); } else if (e.key === 'Enter' && e.target.id === 'hmJumpAyah') { e.preventDefault(); var g = d.querySelector('[data-act2="goayah"]'); if (g) g.click(); } };
      paint(); if (!d.open) d.showModal();
    }

    var ro = typeof ResizeObserver === 'function' ? new ResizeObserver(function () { cancelAnimationFrame(ui.raf); ui.raf = requestAnimationFrame(function () { if (!ui.dead && ui.lines) fit(); }); }) : null;
    if (ro) ro.observe(pageEl);

    var inst = {
      loadPage: loadPage, refresh: paintMarks,
      destroy: function () { ui.dead = true; clearTimeout(ui.pressTimer); if (ro) ro.disconnect(); var jd = document.getElementById('hmJump'); if (jd && jd.open) jd.close(); }
    };
    updateHud();
    loadPage(session.getState().page || rangeStartPage() || 1);
    return inst;
  }

  var api = { mount: mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HalaqatiMushaf = api;
})(typeof window !== 'undefined' ? window : globalThis);
