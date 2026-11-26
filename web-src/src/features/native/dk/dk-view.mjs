/* Halaqati web RC114: the DigitalKhatt page inside the interactive mushaf. Owns the page stage, the pinch/wheel zoom, the swipe page turn and the turn
   animation; the marking tools, marks, keyboard and jump dialog stay in native/mushaf.js and work on the same .hm-word elements.
   Motion: transform and opacity only, short, direction follows RTL, reduced motion swaps the page without movement. Nothing here blocks input. */
import { buildStage, readPalette } from './dk-engine.mjs';
import * as Z from './dk-zoom.mjs';
import * as T from './dk-turn.mjs';

/** env: { pack, container, rootEl, linesEl, wrapEl, S (mushaf state: getSurah), digits(n), hooks }
    hooks: { getTool(), cancelGesture(), setLines(lines), onTurn(dir), canTurn(dir), onZoom(bool) } */
export function createDkController(env) {
  const { pack, linesEl, wrapEl, rootEl, hooks } = env;
  const win = linesEl.ownerDocument.defaultView;
  const reduced = () => (win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches) || linesEl.ownerDocument.documentElement.classList.contains('rc27-reduce-motion');
  const rtl = () => win.getComputedStyle(rootEl).direction === 'rtl';
  const tok = (n, d) => (win.getComputedStyle(rootEl).getPropertyValue(n) || '').trim() || d;
  let stage = null, current = null, zoom = 1, pan = { x: 0, y: 0 }, quality = 0, qTimer = 0, dead = false, seq = 0;

  const hostSize = () => { const r = linesEl.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top }; };
  const dpr = () => Math.min(3, win.devicePixelRatio || 1);
  const css = (s) => ({ opacity: s.opacity, transform: T.toCss(s) });
  const durations = () => { const base = parseFloat(tok('--hm-dur-fast', '220')) || 220; return { out: Math.round(base * 0.5), in: base }; };

  function paintTransform() {
    if (!stage) return;
    const el = stage.el;
    el.style.transform = zoom > 1.001 ? `translate3d(${pan.x}px,${pan.y}px,0) scale(${zoom})` : '';
    el.style.willChange = zoom > 1.001 ? 'transform' : '';
    wrapEl.classList.toggle('is-zoomed', zoom > 1.02);
  }
  function scheduleQuality() {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      if (!stage || dead) return;
      const want = dpr() * Math.max(1, Math.ceil(zoom - 0.001));
      if (want !== quality) { quality = want; stage.redrawText(want); }
    }, 180);
  }
  function setZoomState(z, p) {
    const was = zoom > 1.02;
    zoom = z; pan = p; paintTransform(); scheduleQuality();
    if ((zoom > 1.02) !== was && hooks.onZoom) hooks.onZoom(zoom > 1.02);
  }
  function resetZoom() { setZoomState(1, { x: 0, y: 0 }); }

  function render(data, glyphs, keepView) {
    const { w, h } = hostSize();
    linesEl.classList.add('is-dk');
    linesEl.textContent = '';
    stage = buildStage({
      host: linesEl, data, glyphs, palette: readPalette(rootEl), areaW: w, areaH: h, dpr: dpr(),
      surahName: (id) => { const s = env.S.getSurah(id); return s ? s.name : ''; }, digits: env.digits || String,
    });
    linesEl.appendChild(stage.el);
    quality = dpr();
    if (keepView && zoom > 1.001) { paintTransform(); scheduleQuality(); } else { zoom = 1; pan = { x: 0, y: 0 }; if (hooks.onZoom) hooks.onZoom(false); }
    hooks.setLines(stage.lines);
    if (hooks.onStage) hooks.onStage(); // headers and the page's existing marks appear with the new stage, not after the turn animation
    return stage;
  }

  const style = (el, s) => { el.style.opacity = String(s.opacity); el.style.transform = T.toCss(s); };
  /** Where the element is right now (a swipe may have moved it): opacity, translateX, scale. */
  const nowStyle = (el) => {
    const cs = win.getComputedStyle(el);
    let m = { m41: 0, a: 1 };
    try { if (cs.transform && cs.transform !== 'none') m = new win.DOMMatrix(cs.transform); } catch (_e) { /* identity */ }
    return { opacity: parseFloat(cs.opacity) || 0, translateX: m.m41, scale: m.a };
  };
  /** transform + opacity animation; the end state is written inline and the animation cancelled, so nothing keeps overriding later styles (zoom). */
  const anim = (el, from, to, ms, easing) => {
    if (!el.animate || ms <= 0) { style(el, to); return Promise.resolve(); }
    const a = el.animate([css(from), css(to)], { duration: ms, easing, fill: 'forwards' });
    return a.finished.catch(() => {}).then(() => { style(el, to); try { a.cancel(); } catch (_e) { /* already gone */ } });
  };

  /** Shows page p. Resolves true when the DK page is on screen (or superseded), false when the pack cannot serve it (caller falls back to QCF). */
  async function show(p, { dir = 0, isStale = () => false } = {}) {
    const my = ++seq;
    let data, glyphs;
    try { [data, glyphs] = await Promise.all([pack.page(p), pack.glyphs()]); } catch (_e) { return false; }
    if (dead || my !== seq || isStale()) return true;
    const w = hostSize().w, rm = reduced(), d = durations(), isRtl = rtl();
    const old = stage && stage.el.isConnected ? stage.el : null;
    if (old && dir && !rm) {
      old.style.pointerEvents = 'none'; // the page that is leaving must not take touches
      const k = T.turnKeyframes(dir, w, isRtl, false);
      await anim(old, nowStyle(old), k.out[1], d.out, tok('--hm-ease-in', 'cubic-bezier(.4,0,1,1)'));
      if (dead || my !== seq || isStale()) return true;
    }
    current = { p, data, glyphs };
    let st;
    try { st = render(data, glyphs); } catch (_e) { return false; } // e.g. a canvas feature this browser lacks: the caller falls back to the QCF page
    if (dir && !rm) {
      const k = T.turnKeyframes(dir, w, isRtl, false);
      style(st.el, k.in[0]);
      await anim(st.el, k.in[0], k.in[1], d.in, tok('--hm-ease-out', 'cubic-bezier(.16,1,.3,1)'));
      if (st.el.isConnected) { st.el.style.opacity = ''; st.el.style.transform = ''; paintTransform(); }
    }
    for (const n of [p + 1, p - 1]) pack.prefetch(n);
    return true;
  }

  function relayout() {
    if (!stage || !current || dead) return;
    const keep = current, active = linesEl.contains(linesEl.ownerDocument.activeElement) ? linesEl.ownerDocument.activeElement.getAttribute('data-wid') : null;
    try { render(keep.data, keep.glyphs, true); } catch (_e) { return; }   // a resize keeps the zoom and the word that had the keyboard focus
    if (active) {
      const w = linesEl.querySelector('.hm-word[data-wid="' + active + '"]'), first = linesEl.querySelector('.hm-word[tabindex="0"]');
      if (w) { if (first && first !== w) first.setAttribute('tabindex', '-1'); w.setAttribute('tabindex', '0'); w.focus({ preventScroll: true }); }
    }
  }
  function clear() {
    const was = zoom > 1.02;
    stage = null; current = null; linesEl.classList.remove('is-dk'); zoom = 1; pan = { x: 0, y: 0 }; wrapEl.classList.remove('is-zoomed');
    if (was && hooks.onZoom) hooks.onZoom(false);
  }

  // ---------- gestures: pinch / wheel zoom, one-finger pan while zoomed (tap tool only), swipe to turn the page ----------
  const ptrs = new Map();
  let pinchPrev = null, panning = false, travelled = 0, swipe = null;
  const rel = (x, y) => { const h = hostSize(); return { x: x - h.left, y: y - h.top }; };
  const size = () => { const h = hostSize(); return { w: h.w, h: h.h }; };
  const apply = (factor, centroid, delta) => { const r = Z.pinch({ zoom, pan, size: size(), factor, centroid, delta }); setZoomState(r.zoom, r.pan); };
  const copy = (pts) => pts.map((q) => ({ x: q.x, y: q.y }));
  const liveTurn = (dx) => { const w = hostSize().w || 1; style(stage.el, T.turnStyle(rtl() ? -dx / w : dx / w, w, rtl(), reduced())); };

  wrapEl.addEventListener('pointerdown', (e) => {
    if (!stage) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { pinchPrev = copy([...ptrs.values()]); panning = false; swipe = null; hooks.cancelGesture(); e.stopPropagation(); }
    else if (ptrs.size === 1) { travelled = 0; swipe = { x: e.clientX, y: e.clientY, active: false }; }
  }, true);

  wrapEl.addEventListener('pointermove', (e) => {
    const q = ptrs.get(e.pointerId);
    if (!q || !stage) return;
    const px = q.x, py = q.y; q.x = e.clientX; q.y = e.clientY;
    if (ptrs.size >= 2 && pinchPrev) {
      const now = copy([...ptrs.values()].slice(0, 2)), t = Z.twoFingers(pinchPrev, now);
      pinchPrev = now;
      const c = rel(t.centroid.x, t.centroid.y);
      apply(t.factor, c, t.delta);
      e.stopPropagation(); e.preventDefault();
      return;
    }
    if (ptrs.size !== 1) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    travelled += Math.hypot(dx, dy);
    const tapTool = hooks.getTool() === 'tap';
    if (panning || Z.shouldPan({ zoom, tapToolOnly: tapTool, travelled, slop: 8, fingers: 1 })) {
      if (!panning) { panning = true; hooks.cancelGesture(); }
      apply(1, null, { x: dx, y: dy });
      e.stopPropagation(); e.preventDefault();
      return;
    }
    if (swipe && zoom <= 1.02 && tapTool) {
      const sx = e.clientX - swipe.x, sy = e.clientY - swipe.y;
      if (!swipe.active && Math.abs(sx) > 10 && Math.abs(sx) > 1.5 * Math.abs(sy)) { swipe.active = true; hooks.cancelGesture(); }
      if (swipe.active) { liveTurn(sx); e.stopPropagation(); e.preventDefault(); }
    }
  }, true);

  const release = (e, cancelled) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (pinchPrev && ptrs.size < 2) { pinchPrev = null; }
    if (swipe && swipe.active && ptrs.size === 0) {
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y, w = hostSize().w;
      const dir = cancelled ? 0 : T.swipeDirection(dx, dy, Math.max(48, w * 0.15), rtl());
      swipe = null;
      if (dir && hooks.canTurn(dir)) hooks.onTurn(dir);
      else if (stage) { // not far enough: the page returns to its place
        const el = stage.el;
        anim(el, nowStyle(el), { opacity: 1, translateX: 0, scale: 1 }, reduced() ? 0 : durations().out, tok('--hm-ease-out', 'ease-out')).then(() => { el.style.opacity = ''; el.style.transform = ''; if (stage && stage.el === el) paintTransform(); });
      }
      e.stopPropagation();
    }
    if (ptrs.size === 0) { panning = false; swipe = null; }
  };
  wrapEl.addEventListener('pointerup', (e) => release(e, false), true);
  wrapEl.addEventListener('pointercancel', (e) => release(e, true), true);

  wrapEl.addEventListener('wheel', (e) => {
    if (!stage || !e.ctrlKey) return;
    e.preventDefault();
    apply(Z.wheelFactor(e), rel(e.clientX, e.clientY), { x: 0, y: 0 });
  }, { passive: false });

  return {
    show, relayout, resetZoom, clear,
    get active() { return !!stage; },
    get zoom() { return zoom; },
    destroy() { dead = true; clearTimeout(qTimer); stage = null; },
  };
}
