/* Halaqati Motion System — the single runtime for choreographed motion.
   CSS (styles/motion.css) owns simple state motion (dialogs, drawer, toast, press); this file owns what CSS cannot do:
   staggered page entrance (Web Animations), number count-up, the sliding active-nav pill, the drawn success check and the auth ornament.
   One library (GSAP core + DrawSVG, both free). No scroll hijack, no ScrollTrigger: reading and scrolling stay native.
   Lifecycle: every animation is tracked; a new page render, a hidden tab or a reduced-motion change settles the previous
   one to its end state (never leaves transforms or opacity behind). Reduced motion is tiered: movement removed, short fade kept. */
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin);

const root = document.documentElement;
const mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
const reduced = () => mqReduce.matches || root.classList.contains('rc27-reduce-motion');

/* tokens come from the CSS custom properties, so CSS and JS can never drift apart */
const sec = (name, fallback) => {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith('ms') ? n / 1000 : n) : fallback;
};
const tokens = () => ({
  fast: sec('--hm-dur-fast', .16), base: sec('--hm-dur-base', .24), slow: sec('--hm-dur-slow', .38), hero: sec('--hm-dur-hero', .64),
  stagger: sec('--hm-stagger', .04), dist: sec('--hm-dist-md', 14), distSm: sec('--hm-dist-sm', 8),
});
const EASE_OUT = 'expo.out'; /* = --hm-ease-out */

let enterAnims = []; /* Web Animations of the running page entrance: compositor-driven, no inline styles to clean up */
const counters = new Set();
const slides = new WeakMap(); /* container -> running pill tween (each bar has its own) */

/* finish whatever is running at its end state and release inline styles (no stale transform/opacity) */
function settle() {
  enterAnims.forEach(a => { try { a.finish(); } catch (_e) { /* already finished */ } });
  enterAnims = [];
  counters.forEach(c => c.progress(1).kill());
  counters.clear();
  root.classList.remove('hm-pre');
}

const visibleNow = el => !!el && el.getClientRects().length > 0;

/* ---------- number count-up ---------- */
const COUNT_SELECTORS = '.ops-kpi>b,.ops-health-score,.nx-metric b,.ngm-gs b,.np-hchip b,.ns-count,.nx-stat b,.stat b,.kpi b,.mini-stat b,.dn-num,.ops-health-parts b';
const NUM = /^(\d+(?:\.\d+)?)(%?)$/;
const lastValue = new Map(); /* "page|index" -> last numeric value, so a refresh counts from the old number */

function countTargets(scope) {
  return [...scope.querySelectorAll(COUNT_SELECTORS)].filter(el => el.children.length === 0 && NUM.test(el.textContent.trim()));
}

function animateNumber(el, from, to, unit, dur, delay, width) {
  const decimals = (String(to).split('.')[1] || '').length;
  const finalText = el.textContent;
  let written = finalText;
  const state = { v: from };
  /* keep the box width stable: tabular figures and a minimum width measured BEFORE any write (callers batch the reads) */
  el.style.fontVariantNumeric = 'tabular-nums';
  if (width) el.style.minWidth = width + 'px';
  const tw = gsap.to(state, {
    v: to, duration: dur, delay, ease: 'power3.out',
    onUpdate() { written = state.v.toFixed(decimals) + unit; el.textContent = written; },
    onComplete() {
      if (el.textContent === written) el.textContent = finalText; /* only restore if the app has not rewritten it meanwhile */
      el.style.minWidth = ''; el.style.fontVariantNumeric = '';
      counters.delete(tw);
    },
  });
  counters.add(tw);
  el.textContent = from.toFixed(decimals) + unit;
}

function runCounters(scope, page, pageChanged) {
  const fold = innerHeight + 60;
  const els = countTargets(scope);
  const plan = [];
  els.forEach((el, i) => {
    const m = NUM.exec(el.textContent.trim());
    const to = parseFloat(m[1]), unit = m[2], key = page + '|' + i;
    const prev = lastValue.get(key);
    lastValue.set(key, to);
    if (reduced() || document.hidden) return;
    const from = pageChanged ? (to > 0 ? 0 : null) : (prev !== undefined && prev !== to ? prev : null);
    if (from === null) return;
    plan.push({ el, from, to, unit, dur: pageChanged ? Math.min(.9, .45 + to / 400) : .5, delay: pageChanged ? .12 : 0 });
  });
  /* all reads first (width + on-screen test), then all writes: no layout thrash */
  const reads = plan.map(p => { const r = p.el.getBoundingClientRect(); return { w: r.width, on: r.top < fold && r.bottom > 0 }; });
  plan.slice(0, 12).forEach((p, i) => { if (reads[i].on) animateNumber(p.el, p.from, p.to, p.unit, p.dur, p.delay, reads[i].w); });
}

/* ---------- page entrance ---------- */
/* Pick block-sized elements in reading order: a tall container with several children is a wrapper, so descend into it
   (cards, heroes and buttons are never split).
   Below the fold stays static (nothing animates off-screen). Reads only: no writes happen in this pass. */
function collectBlocks(content, limit = 16) {
  const vh = innerHeight, fold = vh + 120, out = [];
  const queue = [...content.children];
  while (queue.length && out.length < limit) {
    const el = queue.shift();
    const r = el.getBoundingClientRect();
    if (!r.height || !r.width || r.top >= fold) continue;
    const atomic = /(^|[\s-])(card|hero|notice|metric|kpi|stat)/.test(el.className) || el.tagName === 'BUTTON';
    const wrapper = el.children.length >= 2 && (r.height > vh * .8 || (r.height > vh * .45 && !atomic));
    if (wrapper) queue.unshift(...el.children); else out.push(el);
  }
  return out;
}

/* The entrance uses the Web Animations API (transform + opacity run on the compositor thread, so a busy main thread
   cannot make them stutter on weak devices) and leaves nothing behind: fill is 'backwards' only, no inline styles. */
function enterPage(content, page, pageChanged) {
  const T = tokens();
  if (!pageChanged) { root.classList.remove('hm-pre'); runCounters(content, page, false); return; }
  if (reduced() || document.hidden) {
    /* Tier 2: a short fade, no movement */
    root.classList.remove('hm-pre');
    if (!document.hidden) enterAnims = [...content.children].map(el => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'linear', fill: 'backwards' }));
    runCounters(content, page, true);
    return;
  }
  const targets = collectBlocks(content);
  const step = Math.min(50, 420 / Math.max(1, targets.length));
  enterAnims = targets.map((el, i) => el.animate(
    [{ opacity: 0, transform: `translateY(${T.dist}px)` }, { opacity: 1, transform: 'none' }],
    { duration: T.slow * 1000, delay: i * step, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' },
  ));
  root.classList.remove('hm-pre'); /* the animations' backwards fill now holds the hidden state */
  runCounters(content, page, true);
}

const frames = n => new Promise(res => { const step = () => (--n <= 0 ? res() : requestAnimationFrame(step)); requestAnimationFrame(step); });

const motionOffInStorage = () => { try { return localStorage.getItem('halaqati_motion_off') === '1'; } catch (_e) { return false; } };

function installRender() {
  if (typeof window.render !== 'function' || window.__hmRender) return;
  window.__hmRender = true;
  const base = window.render;
  let prevPage = null;
  window.render = async function () {
    /* kill switch: HalaqatiMotion.off = true (or localStorage halaqati_motion_off=1) bypasses the choreography entirely */
    if (window.HalaqatiMotion?.off || motionOffInStorage()) return base.apply(this, arguments);
    settle();
    /* `state` is a top-level let of the classic runtime: reachable by name, not as window.state */
    const page = typeof state !== 'undefined' ? state.page : undefined;
    const pageChanged = page !== prevPage;
    prevPage = page;
    const content = document.getElementById('content');
    let mo = null;
    /* hide the incoming blocks the moment they are written, so the new page never flashes before it animates */
    if (pageChanged && content && !reduced() && !document.hidden) {
      mo = new MutationObserver(() => { root.classList.add('hm-pre'); mo.disconnect(); });
      mo.observe(content, { childList: true });
    }
    const safety = setTimeout(() => root.classList.remove('hm-pre'), 1200);
    let result;
    try {
      result = await base.apply(this, arguments);
    } finally {
      if (mo) mo.disconnect();
    }
    try {
      await frames(2); /* let the layers that decorate the page after render finish first */
      if (content && content.isConnected) enterPage(content, page, pageChanged);
    } finally {
      clearTimeout(safety);
      root.classList.remove('hm-pre');
    }
    return result;
  };
}

/* ---------- sliding active pill for #mobileNav and the desktop #nav ---------- */
function watchNav(selector) {
  const c = document.querySelector(selector);
  if (!c) return;
  let last = null;
  const measure = btn => {
    const r = btn.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height, key: btn.getAttribute('aria-label') || btn.textContent.trim() };
  };
  const reset = () => { last = null; };
  window.addEventListener('resize', reset);
  window.addEventListener('halaqati:viewchange', reset);
  new MutationObserver(() => {
    const active = c.querySelector('button.active');
    if (!active) return;
    if (!visibleNow(c)) { last = null; return; }
    const cur = measure(active);
    if (last && last.key !== cur.key && !reduced() && !document.hidden && cur.w && last.w) slidePill(c, active, last, cur);
    last = cur;
  }).observe(c, { childList: true });
}

/* The pill is the container's ::before (see motion.css), driven by custom properties. No node is inserted into the bar:
   other layers rebuild and police its children, and an inserted node made them fight each other in a loop. */
function slidePill(container, active, from, to) {
  const running = slides.get(container);
  if (running) running.progress(1).kill();
  const cs = getComputedStyle(active);
  const bg = cs.backgroundColor;
  if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return;
  const st = container.style;
  const wasStatic = getComputedStyle(container).position === 'static'; /* only a static bar needs a containing block for the pill */
  if (wasStatic) st.position = 'relative';
  const set = o => { st.setProperty('--hm-x', o.x + 'px'); st.setProperty('--hm-y', o.y + 'px'); st.setProperty('--hm-sx', o.sx); st.setProperty('--hm-sy', o.sy); };
  st.setProperty('--hm-w', to.w + 'px'); st.setProperty('--hm-h', to.h + 'px'); st.setProperty('--hm-bg', bg); st.setProperty('--hm-r', cs.borderRadius);
  const o = { x: from.x, y: from.y, sx: from.w / to.w, sy: from.h / to.h };
  set(o);
  container.classList.add('hm-sliding');
  const done = () => { container.classList.remove('hm-sliding'); ['--hm-x', '--hm-y', '--hm-sx', '--hm-sy', '--hm-w', '--hm-h', '--hm-bg', '--hm-r'].forEach(k => st.removeProperty(k)); if (wasStatic) st.position = ''; slides.delete(container); };
  slides.set(container, gsap.to(o, { x: to.x, y: to.y, sx: 1, sy: 1, duration: tokens().base + .1, ease: 'expo.out', onUpdate: () => set(o), onComplete: done, onInterrupt: done }));
}

/* ---------- toasts: a drawn check on success, a short shake on failure ---------- */
const OK = /^(تم|تمت|حُفظ|حفظ|نجح|✓)|(تم|تمّ) (ال)?(حفظ|إرسال|حذف|تحديث|نسخ)/;
const FAIL = /(تعذر|تعذّر|فشل|خطأ|غير مكتمل)/;
const CHECK_SVG = '<svg class="hm-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>';
function decorateToast(message) {
  const t = document.getElementById('toast');
  if (!t || reduced()) return;
  if (OK.test(message)) {
    t.insertAdjacentHTML('afterbegin', CHECK_SVG);
    const paths = t.querySelectorAll('.hm-check circle,.hm-check path');
    gsap.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: .4, stagger: .12, ease: 'power2.out' });
  } else if (FAIL.test(message)) {
    gsap.fromTo(t, { x: 0 }, { keyframes: { x: [0, -7, 7, -4, 4, 0] }, duration: .36, ease: 'power1.inOut', clearProps: 'transform' });
  }
}
function installToast() {
  if (typeof window.toast !== 'function' || window.__hmToast) return;
  window.__hmToast = true;
  const base = window.toast;
  window.toast = function (m) {
    const r = base.apply(this, arguments);
    try { decorateToast(String(m ?? '')); } catch (_e) { /* decoration must never break a toast */ }
    return r;
  };
}

/* ---------- Islamic geometric ornament: the auth screen's existing geometric star-work draws itself once, then rests ----------
   We animate the identity that is already there (#ntAuthAmb) instead of adding new decoration. Shown only on the auth screen,
   once per page load, never while a form is being filled in afterwards. */
let ornamentDone = false;
function drawAuthOrnament() {
  if (ornamentDone || reduced()) return ornamentDone = reduced() || ornamentDone;
  const svg = document.querySelector('#ntAuthAmb svg');
  const shapes = svg && svg.querySelectorAll('path,polygon,polyline,line,circle,rect');
  if (!shapes || !shapes.length || !visibleNow(svg)) return false;
  ornamentDone = true;
  gsap.from(shapes, { drawSVG: '0%', duration: 1.6, stagger: .07, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' });
  return true;
}
function installOrnament() {
  if (drawAuthOrnament() || ornamentDone) return;
  let tries = 0;
  const timer = setInterval(() => { if (drawAuthOrnament() || ornamentDone || ++tries > 30) clearInterval(timer); }, 200);
}

/* ---------- lifecycle ---------- */
function install() {
  installRender();
  installToast();
  watchNav('#mobileNav');
  watchNav('#nav');
  installOrnament();
}
mqReduce.addEventListener && mqReduce.addEventListener('change', settle);
document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
window.addEventListener('pagehide', settle);
if (window.__halaqatiMotionReady) install();
window.addEventListener('halaqati:ready', install, { once: true });

window.HalaqatiMotion = {
  gsap, tokens, reduced, settle,
  /* for features that add their own list later: stagger a set of elements with the shared tokens */
  stagger(els, { y = tokens().distSm } = {}) {
    const list = [...els];
    if (!list.length || document.hidden) return null;
    if (reduced()) return gsap.fromTo(list, { opacity: 0 }, { opacity: 1, duration: .14, clearProps: 'opacity' });
    return gsap.fromTo(list, { opacity: 0, y }, { opacity: 1, y: 0, duration: tokens().slow, ease: EASE_OUT, stagger: .03, clearProps: 'opacity,transform' });
  },
  countUp: (el, from, to, unit = '') => animateNumber(el, from, to, unit, .6, 0),
};
