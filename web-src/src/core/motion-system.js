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
  flipAnims.forEach(a => { try { a.cancel ? a.cancel() : a.progress(1).kill(); } catch (_e) { /* gone */ } }); flipAnims = [];
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

const lastRing = new Map(); /* "page|index" -> last ring fill length, so a refresh moves the ring from the old value */
/* Progress rings fill to their value and line charts are revealed in reading direction (the app is RTL: from the right) on page entry.
   A re-render with the same numbers plays nothing; a changed number moves the ring from its previous value. Final state is always the real markup. */
function runCharts(scope, page, pageChanged) {
  const play = !reduced() && !document.hidden;
  scope.querySelectorAll('svg circle[stroke-dasharray]').forEach((c, i) => {
    const parts = c.getAttribute('stroke-dasharray').trim().split(/[\s,]+/), to = parseFloat(parts[0]);
    if (!(to >= 0)) return;
    const key = page + '|' + i, prev = lastRing.get(key); lastRing.set(key, to);
    const from = pageChanged ? 0 : prev, rest = parts[1] || '200';
    if (!play || from === undefined || from === to) return;
    c.animate([{ strokeDasharray: `${from} ${rest}` }, { strokeDasharray: `${to} ${rest}` }], { duration: pageChanged ? 1000 : 600, delay: pageChanged ? 150 : 0, easing: 'cubic-bezier(0,.55,.45,1)', fill: 'backwards' }); /* ease-out-circ: a meter fills, it does not spring */
  });
  if (!pageChanged || !play) return;
  scope.querySelectorAll('svg polyline').forEach(l => {
    const svg = l.ownerSVGElement; if (!svg) return;
    svg.animate([{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 700, delay: 200, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
  });
}
function runCounters(scope, page, pageChanged) {
  runCharts(scope, page, pageChanged);
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

/* ---------- continuity on same-page re-renders: FLIP + loading->content settle ----------
   A re-render of the SAME page (filter, sort, expand a card, data refresh) must not replay the entrance. Instead:
   keyed blocks that persisted glide from where they were to where they are (transform only, position-only FLIP so text never
   stretches); a card that grew is revealed with a clip, its chevron turns instead of swapping images; blocks that are new fade in;
   a skeleton replaced by real content cross-fades instead of cutting. All of it runs in the same microtask as the DOM write, so
   the final layout is never painted before the animation starts. */
const KEYED = '[data-stcard],[id^="roster_"],[data-id],[data-sid],[data-key]';
const SKEL = '.nx-skel,.ops-skeleton,.dn-skel';
const CHEV = '.nr-chev>svg,.nst-card-head>.nx-iconbtn>svg,.d86-gh>svg';
const OPEN = '.open,[aria-expanded="true"]';
const keyOf = el => el.dataset.stcard || el.id || el.dataset.id || el.dataset.sid || el.dataset.key || '';
/* leaf-most keyed blocks only: a container that merely holds keyed cards must not move or clip them a second time */
const topKeyed = content => [...content.querySelectorAll(KEYED)].filter(el => !el.querySelector(KEYED));
let flipAnims = [];
/* the spring presets live in CSS (--hm-spring-soft|sheet|pop, damped-oscillator curves as linear()); JS reads the same strings */
const spring = name => getComputedStyle(root).getPropertyValue('--hm-spring-' + name).trim() || 'cubic-bezier(.16,1,.3,1)';
const EASE_IN_OUT = 'cubic-bezier(.4,0,.2,1)';

/* a "pop" state: an element inside a keyed block turned on/off (favourite star): the glyph springs instead of snapping */
const popOn = el => !!el.querySelector('.d86-fav.on');
const popTarget = el => el.querySelector('.d86-fav svg');

function snapshotChips(root0) {
  const out = new Map();
  root0.querySelectorAll('.nx-chips,.nt-eq').forEach((g, i) => {
    const chips = g.querySelectorAll(':scope>.nx-chip'); const on = g.querySelector(':scope>.nx-chip.on');
    if (chips.length < 2 || !on) return;
    const gr = g.getBoundingClientRect(), r = on.getBoundingClientRect();
    out.set(i + '|' + chips.length, { text: on.textContent.trim(), x: r.left - gr.left + g.scrollLeft, y: r.top - gr.top + g.scrollTop, w: r.width, h: r.height });
  });
  return out;
}
/* The selected-chip highlight travels from the old chip to the new one (one shared element) instead of vanishing and re-appearing. */
function playChips(root0, snap) {
  const T = tokens();
  root0.querySelectorAll('.nx-chips,.nt-eq').forEach((g, i) => {
    const chips = g.querySelectorAll(':scope>.nx-chip'); const on = g.querySelector(':scope>.nx-chip.on');
    const o = snap.get(i + '|' + chips.length); if (!o || !on || on.textContent.trim() === o.text) return;
    const gr = g.getBoundingClientRect(), r = on.getBoundingClientRect(), cs = getComputedStyle(on);
    const n = { x: r.left - gr.left + g.scrollLeft, y: r.top - gr.top + g.scrollTop, w: r.width, h: r.height };
    if (!n.w || !n.h || !o.w) return;
    if (getComputedStyle(g).position === 'static') g.style.position = 'relative';
    const ghost = document.createElement('i'); ghost.className = 'hm-chip-ghost'; ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px', height: n.h + 'px', background: cs.backgroundColor, boxShadow: cs.boxShadow, borderRadius: cs.borderRadius });
    g.prepend(ghost); on.classList.add('hm-hold');
    const done = () => { ghost.remove(); on.classList.remove('hm-hold'); };
    const a = ghost.animate([{ transform: `translate(${o.x - n.x}px,${o.y - n.y}px) scale(${o.w / n.w},${o.h / n.h})` }, { transform: 'none' }], { duration: T.base * 1000 + 80, easing: spring('sheet') });
    a.onfinish = a.oncancel = done; flipAnims.push(a);
  });
}

function snapshotKeyed(root0) {
  const vh = innerHeight, out = new Map();
  for (const el of topKeyed(root0)) {
    if (out.size >= 70) break;
    const key = keyOf(el); if (!key || out.has(key)) continue;
    const r = el.getBoundingClientRect();
    if (!r.height || r.bottom < -vh || r.top > vh * 2) continue;
    out.set(key, { top: r.top, left: r.left, h: r.height, open: el.matches(OPEN), pop: popOn(el) });
  }
  out.chips = snapshotChips(root0);
  out.notices = new Set([...root0.querySelectorAll('.nx-notice')].map(n => n.textContent.trim()));
  return out;
}

function playSameRender(root0, snap, hadSkel) {
  if (reduced() || document.hidden) return;
  const T = tokens();
  if (hadSkel && !root0.querySelector(SKEL)) {
    flipAnims.push(...[...root0.children].map(el => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.base * 1000, easing: 'cubic-bezier(.16,1,.3,1)' })));
    runCounters(root0, state.page, true);
    return;
  }
  if (snap && snap.chips && snap.chips.size) playChips(root0, snap.chips);
  /* a state message that was not on screen before (save failed / saved): a quick fade and one colour ring, no movement of the text */
  if (snap && snap.notices) root0.querySelectorAll('.nx-notice').forEach(n => {
    if (snap.notices.has(n.textContent.trim())) return;
    flipAnims.push(n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.fast * 1000 - 10, easing: 'cubic-bezier(.16,1,.3,1)' }));
    const kind = /nx-s-(error|danger|warn|success)/.exec(n.className);
    if (kind) { const col = { error: 'var(--danger,#c0392b)', danger: 'var(--danger,#c0392b)', warn: 'var(--gold,#b8861b)', success: 'var(--green,#0a7a5a)' }[kind[1]];
      const ring = (a, w) => `0 0 0 ${w}px color-mix(in srgb, ${col} ${a}%, transparent)`;
      flipAnims.push(n.animate([{ boxShadow: ring(45, 0) }, { boxShadow: ring(0, 9) }], { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)' })); }
  });
  if (!snap || !snap.size) return;
  const els = topKeyed(root0), reads = [];
  els.forEach(el => { const key = keyOf(el); if (!key) return; const r = el.getBoundingClientRect(); reads.push({ el, key, r }); });
  /* A real reorder (sort, reverse, filter that reshuffles) must not glide: rows travelling to each other's places all meet in the
     middle and collapse. If the old vertical order is not preserved, settle in place with a short fade instead. */
  const kept = reads.filter(x => snap.has(x.key)).sort((a, b) => snap.get(a.key).top - snap.get(b.key).top);
  let reordered = false;
  for (let i = 1; i < kept.length; i++) if (kept[i].r.top < kept[i - 1].r.top - 1) { reordered = true; break; }
  if (reordered) {
    kept.forEach(({ el, key, r }) => { const o = snap.get(key); if (Math.abs(o.top - r.top) > 1 || Math.abs(o.left - r.left) > 1) flipAnims.push(el.animate([{ opacity: .3 }, { opacity: 1 }], { duration: T.fast * 1000 + 60, easing: 'cubic-bezier(.16,1,.3,1)' })); });
    return;
  }
  reads.slice(0, 90).forEach(({ el, key, r }) => {
    const o = snap.get(key);
    if (!o) { if (r.top < innerHeight * 1.5 && r.bottom > 0) flipAnims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.fast * 1000 + 40, easing: 'cubic-bezier(.16,1,.3,1)' })); return; }
    const dx = o.left - r.left, dy = o.top - r.top, grow = r.height - o.h;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      if (Math.abs(dy) < innerHeight * 1.5) flipAnims.push(el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], dy > 0 /* moving up = something collapsed: leave faster, so the gap it leaves is short-lived */ ? { duration: T.base * 1000, easing: EASE_IN_OUT } : { duration: T.slow * 1000 + 60, easing: spring('sheet') }));
    }
    if (grow > 8) flipAnims.push(el.animate([{ clipPath: `inset(0 0 ${grow}px 0)` }, { clipPath: 'inset(0 0 0 0)' }], { duration: T.slow * 1000, easing: 'cubic-bezier(.16,1,.3,1)' }));
    const open = el.matches(OPEN);
    if (open !== o.open) { const ch = el.querySelector(CHEV) || (el.matches('.d86-gh') ? el.querySelector('svg') : null); if (ch) flipAnims.push(ch.animate([{ transform: `rotate(${open ? 0 : 180}deg)` }, { transform: `rotate(${open ? 180 : 0}deg)` }], { duration: T.base * 1000 + 40, easing: spring('sheet') })); }
    const pop = popOn(el);
    if (pop !== o.pop) { const g = popTarget(el); if (g) flipAnims.push(g.animate(pop ? [{ scale: .55 }, { scale: 1 }] : [{ scale: 1.18 }, { scale: 1 }], { duration: pop ? T.base * 1000 + 160 : T.fast * 1000, easing: pop ? spring('pop') : EASE_IN_OUT })); }
  });
}

/* ---------- Islamic geometric ornament in calm empty states (never over student data or forms) ---------- */
const STAR = '<svg class="hm-orn" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M32 4 38.5 17.5 53 11l-6.5 14.5L61 32l-14.500 6.500L53 53l-14.500-6.500L32 60l-6.500-13.500L11 53l6.500-14.500L3 32l14.500-6.500L11 11l14.500 6.500z"/><circle cx="32" cy="32" r="12"/></svg>';
function adornEmpty(content, animate) {
  content.querySelectorAll('.nx-empty').forEach(box => {
    if (box.querySelector('.hm-orn') || !box.querySelector('.nx-empty-ic')) return;
    box.insertAdjacentHTML('afterbegin', STAR);
    if (!animate || reduced() || document.hidden) return;
    const shapes = box.querySelectorAll('.hm-orn path,.hm-orn circle');
    flipAnims.push(gsap.from(shapes, { drawSVG: '0%', duration: 1.1, stagger: .18, ease: 'power2.inOut', delay: .15, clearProps: 'strokeDasharray,strokeDashoffset' }));
  });
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
  const step = Math.min(55, 420 / Math.max(1, targets.length)); /* unhurried: the whole cascade stays under ~0.45s */
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
    const content = document.getElementById('content');
    /* `state` is a top-level let of the classic runtime: reachable by name, not as window.state */
    const page = typeof state !== 'undefined' ? state.page : undefined;
    const pageChanged = page !== prevPage;
    /* same-page re-render: remember where the keyed blocks VISUALLY are right now (mid-animation included) before anything settles */
    const snap = !pageChanged && content && !reduced() && !document.hidden ? snapshotKeyed(content) : null;
    const hadSkel = !pageChanged && !!content && !!content.querySelector(SKEL);
    settle();
    prevPage = page;
    let mo = null;
    if (content && !reduced() && !document.hidden) {
      if (pageChanged) {
        /* hide the incoming blocks the moment they are written, so the new page never flashes before it animates */
        mo = new MutationObserver(() => { root.classList.add('hm-pre'); mo.disconnect(); });
      } else if (snap || hadSkel) {
        /* same microtask as the DOM write: the final layout is never painted before the FLIP starts */
        mo = new MutationObserver(() => { mo.disconnect(); try { playSameRender(content, snap, hadSkel); } catch (_e) { /* motion must never break a render */ } });
      }
      if (mo) mo.observe(content, { childList: true });
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
      if (content && content.isConnected) { enterPage(content, page, pageChanged); adornEmpty(content, pageChanged || hadSkel); }
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
  /* name each icon after its page (from the button's onclick) so CSS can give every icon its own gesture, whichever layer built the SVG */
  const tagIcons = () => c.querySelectorAll('button svg:not([data-ic])').forEach(s => { const oc = s.closest('button').getAttribute('onclick') || '', m = oc.match(/go\('([a-z_]+)'\)/); s.setAttribute('data-ic', m ? m[1] : /toggleDrawer/.test(oc) ? 'more' : 'none'); });
  new MutationObserver(() => {
    tagIcons();
    const active = c.querySelector('button.active');
    if (!active) return;
    if (!visibleNow(c)) { last = null; return; }
    const cur = measure(active);
    if (last && last.key !== cur.key && !reduced() && !document.hidden && cur.w && last.w) slidePill(c, active, last, cur);
    /* the arriving icon springs in. The bar is rebuilt by several layers after this callback, so the animation is bound to a class on the
       container (CSS), not to a node that may be replaced a few ms later. No node is ever inserted into the bar. */
    if (last && last.key !== cur.key && !reduced() && !document.hidden) { c.classList.add('hm-nav-pop'); clearTimeout(c.__hmPopT); c.__hmPopT = setTimeout(() => c.classList.remove('hm-nav-pop'), 900); }
    last = cur;
  }).observe(c, { childList: true });
}

/* The header bell rings when a NEW notification arrives (unread count rises), never when it falls or stays the same. */
function watchBell() {
  const cnt = document.getElementById('notificationBellCount'), svg = document.querySelector('#notificationBell svg');
  if (!cnt || !svg) return;
  let prev = parseInt(cnt.textContent, 10) || 0;
  new MutationObserver(() => {
    const now = parseInt(cnt.textContent, 10) || 0;
    if (now > prev && !reduced() && !document.hidden) {
      svg.classList.remove('hm-ring'); void svg.getBoundingClientRect(); svg.classList.add('hm-ring');
      clearTimeout(svg.__hmRingT); svg.__hmRingT = setTimeout(() => svg.classList.remove('hm-ring'), 950);
    }
    prev = now;
  }).observe(cnt, { childList: true, characterData: true, subtree: true });
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

/* ---------- side menu: follows the finger, reversible, never jumps ----------
   Direct manipulation: while a horizontal drag is in progress the drawer and its backdrop are driven by the pointer (no transition).
   On release the inline values are removed and the normal CSS transition continues FROM the dragged position to the open or closed
   state, chosen by distance and flick velocity. A drag that does not start horizontally is left to native vertical scrolling. */
function installDrawerDrag() {
  const d = document.getElementById('drawer'), b = document.getElementById('backdrop');
  if (!d || !b || d.__hmDrag) return;
  d.__hmDrag = true;
  let id = null, x0 = 0, y0 = 0, dx = 0, mode = 0, samples = [], w = 1;
  const clearInline = () => { d.style.transition = ''; d.style.transform = ''; b.style.transition = ''; b.style.opacity = ''; };
  d.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || !d.classList.contains('open') || id !== null) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; mode = 0; samples = [{ t: e.timeStamp, x: e.clientX }]; w = d.getBoundingClientRect().width || 1;
  });
  d.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (mode === 0) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { id = null; return; } /* vertical: native scroll */
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my) * 1.4) { mode = 1; try { d.setPointerCapture(id); } catch (_e) { /* released */ } d.style.transition = 'none'; b.style.transition = 'none'; } else return;
    }
    dx = Math.max(0, mx); /* the menu is anchored to the right edge: closing is +x; dragging the other way does nothing */
    d.style.transform = `translateX(${dx}px)`;
    b.style.opacity = String(Math.max(0, 1 - dx / w));
    samples.push({ t: e.timeStamp, x: e.clientX }); if (samples.length > 6) samples.shift();
  });
  const end = e => {
    if (e.pointerId !== id) return;
    const wasDrag = mode === 1; id = null; mode = 0;
    if (!wasDrag) return;
    d.__hmJustDragged = true; setTimeout(() => { d.__hmJustDragged = false; }, 80);
    const a = samples[0], z = samples[samples.length - 1];
    const v = z.t > a.t ? (z.x - a.x) / (z.t - a.t) : 0; /* px/ms, +x = towards closing */
    const close = e.type !== 'pointercancel' && (dx > w * .35 || v > .45) && v > -.3;
    void d.offsetWidth; /* commit the dragged position as the transition's starting point */
    clearInline();
    if (close) toggleDrawer(false);
  };
  d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end);
  /* a click right after a drag must not activate the item under the finger */
  d.addEventListener('click', e => { if (d.__hmJustDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
}

/* ---------- toasts: a drawn check on success, a short shake on failure ---------- */
const OK = /^(تم|تمت|حُفظ|حفظ|نجح|✓)|(تم|تمّ) (ال)?(حفظ|إرسال|حذف|تحديث|نسخ)/;
const FAIL = /(تعذر|تعذّر|فشل|خطأ|غير مكتمل)/;
const CHECK_SVG = '<svg class="hm-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>';
function decorateToast(message) {
  const t = document.getElementById('toast');
  if (FAIL.test(message)) failBusyButton();
  if (!t || reduced()) return;
  if (OK.test(message)) {
    confirmBusyButton();
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

/* ---------- button state machine: pressed -> busy -> success, on the very button the person pressed ----------
   The app already disables a button while it saves. We only LISTEN: when the pressed button becomes disabled right after the press
   it shows a calm busy sheen (aria-busy); when it is enabled again after a success toast it gives a short confirming pulse.
   Nothing here touches what the button does and nothing delays it. */
let lastPress = null, lastBusy = null;
function installButtonStates() {
  const press = e => { const b = e.target && e.target.closest && e.target.closest('button'); if (b) lastPress = { el: b, t: performance.now() }; };
  document.addEventListener('pointerdown', press, true);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.matches && document.activeElement.matches('button')) lastPress = { el: document.activeElement, t: performance.now() }; }, true);
  const endBusy = b => {
    b.el.classList.remove('hm-busy'); b.el.removeAttribute('aria-busy'); b.ended = performance.now();
    if (b.ok) flashOk(b.el); else if (b.err) flashErr(b.el);
  };
  new MutationObserver(list => {
    for (const m of list) {
      const el = m.target; if (!el || el.nodeType !== 1) continue;
      if (el.disabled && lastPress && el === lastPress.el && performance.now() - lastPress.t < 900 && !el.classList.contains('hm-busy')) {
        el.classList.add('hm-busy'); el.setAttribute('aria-busy', 'true'); lastBusy = { el, t0: performance.now(), ok: false, ended: 0 };
        /* a button the app disables for good ("sent") must not shimmer for ever */
        const mine = lastBusy; setTimeout(() => { if (lastBusy === mine && el.classList.contains('hm-busy')) { el.classList.remove('hm-busy'); el.removeAttribute('aria-busy'); } }, 6000);
      } else if (!el.disabled && lastBusy && el === lastBusy.el && el.classList.contains('hm-busy')) endBusy(lastBusy);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
}
function flashOk(el) {
  if (!el.isConnected || reduced() || document.hidden) return;
  el.classList.add('hm-ok');
  el.animate([{ scale: 1 }, { scale: 1.045 }, { scale: 1 }], { duration: 420, easing: spring('pop') });
  setTimeout(() => el.classList.remove('hm-ok'), 700);
}
/* a failed operation: the button that was just busy gets a red ring and one short shake (the ring stays under reduced motion, the shake does not) */
function flashErr(el) {
  if (!el.isConnected || document.hidden) return;
  el.classList.add('hm-err');
  if (!reduced()) el.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '-3px 0' }, { translate: '0 0' }], { duration: 360, easing: 'ease-in-out' });
  setTimeout(() => el.classList.remove('hm-err'), 900);
}
function failBusyButton() {
  const b = lastBusy; if (!b || performance.now() - b.t0 > 6000) return;
  if (b.ended && performance.now() - b.ended < 1500) { if (!b.errShown) { b.errShown = true; flashErr(b.el); } } else b.err = true;
}
/* called by the toast decoration: a success message confirms the button that was just busy */
function confirmBusyButton() {
  const b = lastBusy; if (!b || performance.now() - b.t0 > 6000) return;
  if (b.ended && performance.now() - b.ended < 1500) flashOk(b.el); else b.ok = true;
}

/* ---------- <details>: open and close with a height transition that can be reversed mid-way ---------- */
function installDetails() {
  document.addEventListener('click', e => {
    const sum = e.target && e.target.closest && e.target.closest('summary');
    if (!sum) return;
    if (e.target.closest('a,button,input,select,textarea,label') && e.target.closest('a,button,input,select,textarea,label') !== sum) return; /* a control inside <summary> keeps its own behaviour */
    const d = sum.parentElement;
    if (!(d instanceof HTMLDetailsElement) || reduced() || document.hidden || window.HalaqatiMotion?.off || motionOffInStorage()) return;
    e.preventDefault();
    const T = tokens();
    const cur = d.getBoundingClientRect().height; /* where it visually is right now (read BEFORE cancelling): the animation reverses from here, never jumps */
    if (d.__hmAnim) { d.__hmAnim.cancel(); d.__hmAnim = null; }
    const wantOpen = !(d.open && !d.__hmClosing);
    d.__hmClosing = !wantOpen;
    d.style.height = ''; d.style.overflow = '';
    const wasOpen = d.open; d.open = true; const full = d.getBoundingClientRect().height;
    d.open = false; const shut = d.getBoundingClientRect().height; d.open = wasOpen || wantOpen;
    const from = d.__hmAnimActive ? cur : (wantOpen ? shut : full), to = wantOpen ? full : shut;
    d.style.overflow = 'hidden'; d.__hmAnimActive = true;
    const a = d.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: T.base * 1000 + 60, easing: spring('soft') });
    d.__hmAnim = a;
    a.onfinish = () => { d.open = wantOpen; d.style.overflow = ''; d.style.height = ''; d.__hmAnim = null; d.__hmClosing = false; d.__hmAnimActive = false; };
    a.oncancel = () => { /* a newer click took over */ };
  }, true);
}

/* ---------- lifecycle ---------- */
function install() {
  installRender();
  installToast();
  watchNav('#mobileNav');
  watchNav('#nav');
  watchBell();
  installOrnament();
  installDrawerDrag();
  installButtonStates();
  installDetails();
}
mqReduce.addEventListener && mqReduce.addEventListener('change', settle);
document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
window.addEventListener('pagehide', settle);
if (window.__halaqatiMotionReady) install();
window.addEventListener('halaqati:ready', install, { once: true });

/* For features that update a part of the page in place (not through render()): HalaqatiMotion.flip(() => { ...mutate the DOM... })
   keeps the keyed blocks gliding from where they were. Falls back to a plain call when motion is off. */
function flip(mutate, root0) {
  root0 = root0 || document.getElementById('content');
  if (!root0 || reduced() || document.hidden || window.HalaqatiMotion?.off || motionOffInStorage()) return mutate();
  const snap = snapshotKeyed(root0);
  flipAnims.forEach(a => { try { a.cancel ? a.cancel() : a.progress(1).kill(); } catch (_e) { /* gone */ } }); flipAnims = [];
  const out = mutate();
  try { playSameRender(root0, snap, false); } catch (_e) { /* motion must never break an update */ }
  return out;
}

window.HalaqatiMotion = {
  gsap, tokens, reduced, settle, flip, spring,
  /* for features that add their own list later: stagger a set of elements with the shared tokens */
  stagger(els, { y = tokens().distSm } = {}) {
    const list = [...els];
    if (!list.length || document.hidden) return null;
    if (reduced()) return gsap.fromTo(list, { opacity: 0 }, { opacity: 1, duration: .14, clearProps: 'opacity' });
    return gsap.fromTo(list, { opacity: 0, y }, { opacity: 1, y: 0, duration: tokens().slow, ease: EASE_OUT, stagger: .03, clearProps: 'opacity,transform' });
  },
  countUp: (el, from, to, unit = '') => animateNumber(el, from, to, unit, .6, 0),
};
