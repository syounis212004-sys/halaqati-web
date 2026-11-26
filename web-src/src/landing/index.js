/* Hydrates the static landing markup (see markup.js). Lazy chunk: never loaded for signed-in users.
   GSAP + ScrollTrigger are imported on demand, only when motion is allowed; without them every section is already in its final state. */
import { createDemo, recite, summary, DEMO_STUDENTS, TOTAL_PAGES } from './demo.js';

/* lifecycle: one controller for listeners, a list for observers, one gsap context for motion */
const life = new AbortController();
const cleanup = [];
let motionCtx = null, motionTimer = 0, destroyed = false;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toString();

function setupTabs(list, onSelect) {
  const tabs = $$('[role="tab"]', list);
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = document.getElementById(t.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    if (focus) tab.focus();
    onSelect && onSelect(tab);
  };
  tabs.forEach((t) => t.addEventListener('click', () => select(t)));
  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const rtl = getComputedStyle(list).direction === 'rtl';
    let n = -1;
    if (e.key === 'ArrowLeft') n = rtl ? i + 1 : i - 1;
    else if (e.key === 'ArrowRight') n = rtl ? i - 1 : i + 1;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    select(tabs[(n + tabs.length) % tabs.length], true);
  });
}

function setupNav(root, openApp) {
  const nav = $('#hl-nav', root), links = $('#hl-links', root), burger = $('#hl-burger', root);
  const setOpen = (o) => { links.classList.toggle('open', o); burger.setAttribute('aria-expanded', String(o)); burger.setAttribute('aria-label', o ? 'إغلاق القائمة' : 'فتح القائمة'); };
  burger.addEventListener('click', () => setOpen(!links.classList.contains('open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && links.classList.contains('open')) { setOpen(false); burger.focus(); } }, { signal: life.signal });
  const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true, signal: life.signal }); onScroll();
  $$('[data-hl-login]', root).forEach((b) => b.addEventListener('click', () => openApp('login')));
  $$('[data-hl-signup]', root).forEach((b) => b.addEventListener('click', () => openApp('signup')));
  /* scroll spy */
  const map = new Map($$('[data-spy]', links).map((a) => [a.dataset.spy, a]));
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) map.forEach((a, id) => { if (id === en.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); a.classList.toggle('on', id === en.target.id); }); }), { rootMargin: '-40% 0px -55% 0px' });
  map.forEach((_a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  cleanup.push(() => io.disconnect());
  /* pause looping decorative motion */
  const pbtn = $('#hl-pause', root);
  pbtn.addEventListener('click', () => {
    const on = !document.documentElement.hasAttribute('data-hl-paused');
    document.documentElement.toggleAttribute('data-hl-paused', on);
    pbtn.setAttribute('aria-pressed', String(on));
    pbtn.setAttribute('aria-label', on ? 'تشغيل الحركة الزخرفية' : 'إيقاف الحركة الزخرفية');
  });
  /* theme */
  const tbtn = $('#hl-theme', root), html = document.documentElement;
  const sync = () => tbtn.setAttribute('aria-pressed', String(html.getAttribute('data-hl-theme') === 'dark'));
  sync();
  tbtn.addEventListener('click', () => {
    const next = html.getAttribute('data-hl-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-hl-theme', next); sync();
    try { localStorage.setItem('hl_theme', next); } catch (_e) { /* storage unavailable */ }
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', next === 'dark' ? '#08201D' : '#0B5D4F');
  });
}

function setupFaq(root) {
  $$('.hl-q', root).forEach((d) => {
    const sum = $('summary', d), body = $('.hl-a', d);
    sum.addEventListener('click', (e) => {
      if (reduced() || !body.animate) return;
      e.preventDefault();
      if (d.dataset.busy) return; /* ignore taps while the open/close animation runs */
      const opening = !d.open;
      if (opening) d.open = true;
      d.dataset.busy = '1';
      const h = body.scrollHeight;
      const anim = body.animate({ height: opening ? ['0px', h + 'px'] : [h + 'px', '0px'] }, { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
      anim.onfinish = () => { if (!opening) d.open = false; delete d.dataset.busy; };
      anim.oncancel = () => { delete d.dataset.busy; };
    });
  });
}

/* ---- interactive product demo (isolated, fictional state) ---- */
let motionRef = null;
function setupDemo(root) {
  const demo = createDemo();
  const sel = $('#hl-d-student', root), list = $('#hl-d-list', root), out = $('#hl-d-result', root);
  const byId = Object.fromEntries(DEMO_STUDENTS.map((s) => [s.id, s]));
  DEMO_STUDENTS.forEach((s) => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
  const days = [['السبت', 3], ['الأحد', 5], ['الاثنين', 4], ['الثلاثاء', 6]];
  const render = (bumpId) => {
    list.innerHTML = DEMO_STUDENTS.map((s) => {
      const st = demo.students[s.id];
      return `<div class="hl-sc${bumpId === s.id ? ' bump' : ''}"><b>${esc(s.name)}</b><div class="hl-meter" aria-hidden="true"><i style="--v:${st.pages / TOTAL_PAGES}"></i></div><small>${fmt(st.pages)} من ${TOTAL_PAGES} صفحة · ${st.points} نقطة</small></div>`;
    }).join('');
    const s = summary(demo);
    const today = demo.log.filter((e) => e.passed).reduce((a, e) => a + e.pages, 0);
    $('#hl-rep-kpis', root).innerHTML = `<div><b>${s.recitations}</b><span>تسميعات اليوم</span></div><div><b>${s.passed}</b><span>اجتاز</span></div><div><b>${s.needRepeat}</b><span>يحتاج إعادة</span></div>`;
    const bars = [...days, ['اليوم', today]];
    const max = Math.max(8, ...bars.map((b) => b[1]));
    $('#hl-rep-chart', root).innerHTML = bars.map(([d, v]) => `<div><span>${fmt(v)}</span><i style="--h:${Math.max(4, (v / max) * 100)}%"></i><span>${d}</span></div>`).join('');
  };
  $('#hl-recform', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const mist = Math.min(20, Math.max(0, parseInt($('#hl-d-mist', root).value, 10) || 0));
    $('#hl-d-mist', root).value = mist;
    const id = sel.value;
    const r = recite(demo, { studentId: id, pages: $('#hl-d-pages', root).value, mistakes: mist });
    out.className = 'hl-result ' + (r.passed ? 'pass' : 'fail');
    out.textContent = r.passed
      ? `${byId[id].name}: التقييم ${r.label} (+${r.points} نقطة). أُضيف ${fmt(r.pages)} إلى المحفوظ.`
      : `${byId[id].name}: التقييم ${r.label}. لا يتقدّم الطالب قبل إعادة التسميع.`;
    render(id);
    if (motionRef && !reduced()) motionRef.gsap.fromTo(out, { y: 8, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity' });
  });
  render();
  /* tiny mushaf: 15 structural lines, no text */
  const page = $('#hl-mus-page', root), range = $('#hl-mus-range', root), num = $('#hl-mus-num', root), info = $('#hl-mus-info', root);
  page.innerHTML = '<i></i>'.repeat(15);
  let cur = 41; const marks = new Map();
  const get = () => (marks.has(cur) ? marks.get(cur) : (cur * 7) % 16);
  const draw = () => {
    const n = get();
    $$('i', page).forEach((l, i) => l.classList.toggle('m', i < n));
    range.value = n; num.textContent = `صفحة ${cur}`;
    info.textContent = `المحفوظ ${n} من 15 سطرًا في هذه الصفحة. بيانات توضيحية.`;
  };
  range.addEventListener('input', () => { marks.set(cur, parseInt(range.value, 10)); draw(); });
  $('#hl-mus-prev', root).addEventListener('click', () => { cur = Math.max(1, cur - 1); draw(); });
  $('#hl-mus-next', root).addEventListener('click', () => { cur = Math.min(TOTAL_PAGES, cur + 1); draw(); });
  draw();
  setupTabs($('.hl-dtabs', root));
}

/* ---- gallery: per role, platform switch + screen chips + hotspots. Figures are all in the markup (images load lazily only when their panel is shown) ---- */
function setupGallery(root) {
  $$('.hl-gal', root).forEach((gal) => {
    const figs = $$('.hl-shot', gal), chips = $$('.hl-chip2', gal), segs = $$('.hl-seg button', gal);
    const show = (id) => {
      figs.forEach((f) => { f.hidden = f.dataset.screen !== id; });
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.screen === id)));
    };
    const setPlatform = (p) => {
      segs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.platform === p)));
      chips.forEach((c) => { c.hidden = c.dataset.platform !== p; });
      const first = chips.find((c) => c.dataset.platform === p);
      if (first) show(first.dataset.screen);
    };
    chips.forEach((c) => c.addEventListener('click', () => show(c.dataset.screen)));
    segs.forEach((b) => b.addEventListener('click', () => setPlatform(b.dataset.platform)));
    /* hotspots: a pin and its list entry highlight each other, a second press clears */
    figs.forEach((fig) => {
      const pins = $$('.hl-pin', fig), items = $$('.hl-pinlist li', fig);
      const mark = (i) => { pins.forEach((p, k) => p.setAttribute('aria-pressed', String(k === i))); items.forEach((li, k) => li.classList.toggle('on', k === i)); };
      pins.forEach((p, i) => p.addEventListener('click', () => { const on = p.getAttribute('aria-pressed') === 'true'; mark(on ? -1 : i); if (!on && items[i]) items[i].scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); }));
      items.forEach((li, i) => li.addEventListener('click', () => mark(i)));
    });
  });
  /* "see my screens" links on the three paths open the matching role tab */
  $$('[data-role-jump]', root).forEach((a) => a.addEventListener('click', () => { const t = document.getElementById('hl-tab-' + a.dataset.roleJump); if (t) t.click(); }));
}

async function loadMotion() {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}

function setupMotion(root, { gsap, ScrollTrigger }) {
  /* everything below is created inside one gsap context so destroyLanding() can revert it in one call */
  motionCtx = gsap.context(() => buildMotion(root, gsap, ScrollTrigger));
}

function buildMotion(root, gsap, ScrollTrigger) {
  /* reveal: only items still below the fold are hidden, then revealed in batches */
  const vh = window.innerHeight;
  const items = $$('[data-hl-reveal]', root).filter((el) => el.getBoundingClientRect().top > vh);
  items.forEach((el) => el.classList.add('hl-pre'));
  ScrollTrigger.batch(items, {
    start: 'top 90%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity', onComplete: () => els.forEach((e) => e.classList.remove('hl-pre')) }),
  });
  /* hero stage drifts slower than the page */
  gsap.to($('.hl-stage', root), { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '#hl-home', start: 'top top', end: 'bottom top', scrub: true } });
  /* how-it-works connector lines draw with scroll */
  const steps = $$('.hl-step', root);
  steps.forEach((s) => s.style.setProperty('--hl-line-p', '0'));
  gsap.to(steps, { '--hl-line-p': 1, ease: 'none', stagger: 0.25, scrollTrigger: { trigger: '#hl-steps', start: 'top 75%', end: 'bottom 70%', scrub: true } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  /* role switch choreography */
  const panels = $('#hl-rpanels', root);
  const mo = new MutationObserver((muts) => muts.forEach((m) => { const p = m.target; if (m.attributeName === 'hidden' && !p.hidden && p.classList.contains('hl-panel')) motionCtx.add(() => gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } }).fromTo($('.hl-lead', p), { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 }).fromTo($$('.hl-needs li', p), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.07 }, '<0.08')); }));
  mo.observe(panels, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  cleanup.push(() => mo.disconnect());
}

/* called when the visitor moves on to the login screen: stop listeners, observers and every tween the landing created (the app keeps its own) */
export function destroyLanding() {
  destroyed = true;
  clearTimeout(motionTimer);
  life.abort();
  cleanup.forEach((f) => f());
  if (motionCtx) motionCtx.revert();
  document.documentElement.removeAttribute('data-hl-paused');
}

export async function mountLanding({ openApp }) {
  const root = document.getElementById('hlRoot');
  setupNav(root, openApp);
  setupTabs($('#hl-rtabs', root));
  setupFaq(root);
  setupGallery(root);
  setupDemo(root);
  /* GSAP is fetched on the first sign of interaction (or after 6s), keeping the initial load and main thread free */
  let started = false;
  const start = async () => {
    if (started || destroyed) return; started = true;
    if (reduced()) return;
    try {
      const m = await loadMotion();
      if (destroyed) return; /* the visitor already moved on to the login screen */
      motionRef = m; setupMotion(root, m);
    } catch (e) { console.warn('landing motion unavailable', e); }
  };
  ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, start, { passive: true, once: true, signal: life.signal }));
  motionTimer = setTimeout(start, 6000);
  document.documentElement.setAttribute('data-landing-ready', '');
}
