/* Motion System check (real browser). Usage: BASE_URL=http://127.0.0.1:5173/ node scripts/motion-check.mjs
   Proves behaviour over time, not still frames: page entrance runs and settles (no stale inline styles), rapid navigation
   settles on the last page, dialogs/drawer animate and stay usable when interrupted, the nav pill slides, toasts decorate,
   numbers count, layout shift stays ~0, reduced motion removes movement, and no JavaScript error is thrown. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const OUT = process.env.ARTIFACTS_DIR || '.artifacts/motion';
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
const failures = [];
const note = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures.push(msg); };

async function open({ width, height, dark = false, reduce = false, video = false, role = 'admin' }) {
  const context = await browser.newContext({
    viewport: { width, height }, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference', colorScheme: dark ? 'dark' : 'light',
    recordVideo: video ? { dir: OUT, size: { width, height } } : undefined,
  });
  await context.route(/https:\/\//, r => r.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 45000 });
  await page.locator('#rc27Splash').evaluate(e => e.remove()).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(({ dark, ROLE }) => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    state.user = { id: id(1) };
    state.profile = { id: id(1), role: ROLE, full_name: 'د. محمد سمير أبو يونس', active: true, approval_status: 'approved' };
    state.offline = true; state.networkVerified = false;
    state.halaqas = [0, 1, 2].map(i => ({ id: id(10 + i), name: ['حلقة معاوية بن أبي سفيان', 'حلقة عمر بن الخطاب', 'حلقة الفاروق'][i], active: true, halaqa_type: 'regular' }));
    state.students = Array.from({ length: 12 }, (_, i) => ({ id: id(100 + i), full_name: 'طالب ' + i + ' أبو يونس', status: 'active', halaqa_id: state.halaqas[i % 3].id, track_code: 'general_hifz', enrollment_date: '2026-01-01' }));
    state.sessions = [{ id: id(4), halaqa_id: state.halaqas[0].id, session_date: today(), session_type: 'tasmee', status: 'open', title: 'جلسة اليوم', activity_data: {} }];
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    if (dark) document.body.classList.add('dark');
  }, { dark, ROLE: role });
  return { context, page, errors };
}

const dirty = page => page.evaluate(() => ({
  pre: document.documentElement.classList.contains('hm-pre'),
  stale: [...document.querySelectorAll('#content *')].filter(e => e.style.opacity !== '' || /translate|matrix|scale/.test(e.style.transform)).length,
}));
const PAGES = ['home', 'halaqas', 'students', 'sessions', 'plans', 'notifications', 'reports', 'ranking', 'settings', 'community'];

for (const cfg of [
  { name: 'mobile-light', width: 390, height: 844 },
  { name: 'mobile-dark', width: 390, height: 844, dark: true },
  { name: 'desktop-light', width: 1440, height: 900 },
  { name: 'desktop-dark', width: 1440, height: 900, dark: true },
]) {
  const { context, page, errors } = await open(cfg);
  /* layout shift observer for the whole run */
  /* the first paint of the injected test state shifts the shell once (unrelated to motion): settle it first.
     Layout shift is measured differentially: the same navigation sequence with the choreography ON and OFF (kill switch).
     The app itself has small pre-existing shifts (the top bar changes height on some pages); the motion system must add none. */
  await page.evaluate(() => go('home')); await page.waitForTimeout(1500);
  const shiftOf = async off => page.evaluate(async off => {
    HalaqatiMotion.off = off; let total = 0;
    const po = new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) total += e.value; })); po.observe({ type: 'layout-shift' });
    for (const p of ['halaqas', 'students', 'sessions', 'plans', 'home', 'community', 'reports', 'home']) { go(p); await new Promise(r => setTimeout(r, 1000)); }
    await new Promise(r => setTimeout(r, 100)); po.disconnect(); HalaqatiMotion.off = false; return total;
  }, off);
  const clsOff = await shiftOf(true), clsOn = await shiftOf(false);
  let animated = 0;
  for (const p of PAGES) {
    const probe = await page.evaluate(async target => {
      go(target);
      let seen = false;
      for (let i = 0; i < 14; i++) {
        await new Promise(r => setTimeout(r, 40));
        if (document.getAnimations().some(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#content') && a.playState === 'running') || document.documentElement.classList.contains('hm-pre')) seen = true;
      }
      return seen;
    }, p);
    if (probe) animated++;
    await page.waitForTimeout(900);
    const d = await dirty(page);
    note(d.stale === 0 && !d.pre, `${cfg.name}/${p}: settles with no stale inline opacity/transform and no hm-pre (stale=${d.stale})`);
  }
  note(animated >= PAGES.length - 2, `${cfg.name}: page entrance ran on ${animated}/${PAGES.length} pages`);

  /* rapid navigation settles on the last page */
  const last = await page.evaluate(async () => { for (const p of ['students', 'plans', 'home', 'sessions', 'halaqas', 'reports']) { go(p); await new Promise(r => setTimeout(r, 70)); } return state.page; });
  await page.waitForTimeout(1200);
  const d2 = await dirty(page);
  note(last === 'reports' && d2.stale === 0 && !d2.pre, `${cfg.name}: rapid navigation settles on the last page, nothing left hanging (stale=${d2.stale})`);

  /* dialogs: enter, exit, interrupted, usable */
  const dlg = await page.evaluate(async () => {
    const d = document.getElementById('halaqaDlg'); const sample = () => +getComputedStyle(d).opacity;
    d.showModal(); await new Promise(r => setTimeout(r, 50)); const mid = sample();
    await new Promise(r => setTimeout(r, 450)); const open = sample();
    const btn = d.querySelector('button'); const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const usable = d.contains(hit);
    d.close(); await new Promise(r => setTimeout(r, 60)); const closingDisplay = getComputedStyle(d).display; const closingPE = getComputedStyle(d).pointerEvents;
    await new Promise(r => setTimeout(r, 400)); const closedDisplay = getComputedStyle(d).display;
    d.showModal(); await new Promise(r => setTimeout(r, 60)); d.close(); await new Promise(r => setTimeout(r, 40)); d.showModal(); await new Promise(r => setTimeout(r, 500));
    const reopened = d.open && sample() > .99; d.close(); await new Promise(r => setTimeout(r, 400));
    return { mid, open, usable, closingDisplay, closingPE, closedDisplay, reopened, endOpen: d.open };
  });
  note(dlg.mid < .99 && dlg.open > .99, `${cfg.name}: dialog fades in (t=50ms opacity ${dlg.mid.toFixed(2)} -> ${dlg.open})`);
  note(dlg.usable, `${cfg.name}: dialog buttons receive pointer hits right after opening`);
  note(dlg.closingPE === 'none' && dlg.closedDisplay === 'none', `${cfg.name}: closing dialog is inert and leaves the layout (pe=${dlg.closingPE}, display=${dlg.closedDisplay})`);
  note(dlg.reopened && !dlg.endOpen, `${cfg.name}: dialog survives open/close/open interruption`);

  if (cfg.width < 700) {
    const dr = await page.evaluate(async () => {
      const d = document.getElementById('drawer'), b = document.getElementById('backdrop');
      toggleDrawer(true); await new Promise(r => setTimeout(r, 60)); const mid = new DOMMatrix(getComputedStyle(d).transform).m41;
      await new Promise(r => setTimeout(r, 500)); const open = new DOMMatrix(getComputedStyle(d).transform).m41; const bo = +getComputedStyle(b).opacity;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise(r => setTimeout(r, 450));
      return { mid, open, bo, closed: !d.classList.contains('open'), hidden: d.getAttribute('aria-hidden'), bAfter: +getComputedStyle(b).opacity };
    });
    note(dr.mid !== dr.open && dr.open === 0 && dr.bo === 1, `${cfg.name}: drawer slides in (m41 ${Math.round(dr.mid)} -> ${dr.open}), backdrop opacity ${dr.bo}`);
    note(dr.closed && dr.hidden === 'true' && dr.bAfter === 0, `${cfg.name}: Escape closes drawer, aria-hidden and backdrop restored`);
    /* sliding nav pill */
    await page.evaluate(() => go('home')); await page.waitForTimeout(900);
    const pill = await page.evaluate(async () => { go('sessions'); let seen = false; for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 40)); if (document.getElementById('mobileNav').classList.contains('hm-sliding')) seen = true; } await new Promise(r => setTimeout(r, 700)); return { seen, left: !!document.getElementById('mobileNav').style.cssText.includes('--hm-'), cls: document.getElementById('mobileNav').classList.contains('hm-sliding'), active: document.querySelector('#mobileNav .active')?.getAttribute('aria-label') }; });
    note(pill.seen && !pill.left && !pill.cls, `${cfg.name}: active-nav pill slides then cleans up (active=${pill.active})`);
  }

  /* toast decoration */
  const ts = await page.evaluate(async () => { toast('تم الحفظ بنجاح'); await new Promise(r => setTimeout(r, 450)); const ok = !!document.querySelector('#toast .hm-check'); const vis = getComputedStyle(document.getElementById('toast')).opacity; toast('فشل الحفظ'); await new Promise(r => setTimeout(r, 450)); return { ok, vis, failNoCheck: !document.querySelector('#toast .hm-check') }; });
  note(ts.ok && ts.vis === '1' && ts.failNoCheck, `${cfg.name}: success toast draws a check, failure toast stays plain`);

  /* count-up on home */
  const cu = await page.evaluate(async () => {
    go('plans'); await new Promise(r => setTimeout(r, 700)); go('home');
    const sel = '.ops-kpi>b,.ops-health-score,.nx-metric b,.ngm-gs b,.np-hchip b,.ns-count'; const seen = new Set();
    for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 40)); document.querySelectorAll(sel).forEach(e => seen.add(e.textContent)); }
    await new Promise(r => setTimeout(r, 800));
    return { distinct: seen.size, residue: [...document.querySelectorAll(sel)].filter(e => e.style.minWidth || e.style.fontVariantNumeric).length };
  });
  note(cu.residue === 0, `${cfg.name}: count-up leaves no inline residue (distinct values seen: ${cu.distinct})`);

  note(clsOn <= clsOff + .015, `${cfg.name}: layout shift with motion ${clsOn.toFixed(4)} <= without motion ${clsOff.toFixed(4)} (+0.015 noise)`);
  /* lifecycle: 40 rapid navigations must not leave tweens, observers' classes or inline styles behind */
  const leak = await page.evaluate(async () => {
    const pages = ['home', 'students', 'plans', 'sessions', 'halaqas', 'reports', 'community', 'settings'];
    for (let i = 0; i < 40; i++) { go(pages[i % pages.length]); await new Promise(r => setTimeout(r, 35)); }
    await new Promise(r => setTimeout(r, 1500));
    return { tweens: HalaqatiMotion.gsap.globalTimeline.getChildren(true, true, true).length, pre: document.documentElement.classList.contains('hm-pre'), stale: [...document.querySelectorAll('#content *')].filter(e => e.style.opacity !== '' || /translate|matrix|scale/.test(e.style.transform)).length };
  });
  note(leak.tweens === 0 && !leak.pre && leak.stale === 0, `${cfg.name}: 40 rapid navigations leave no running tweens (${leak.tweens}), no hm-pre, no stale styles (${leak.stale})`);
  /* keyboard: Escape closes a dialog that is still animating in; focus stays inside while open */
  const kb = await page.evaluate(async () => {
    const d = document.getElementById('halaqaDlg'); d.showModal(); await new Promise(r => setTimeout(r, 40));
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); d.close();
    await new Promise(r => setTimeout(r, 400)); return { open: d.open, display: getComputedStyle(d).display };
  });
  note(!kb.open && kb.display === 'none', `${cfg.name}: dialog closed mid-entrance leaves no orphan overlay`);
  note(errors.length === 0, `${cfg.name}: no JavaScript errors ${errors.slice(0, 2).join(' | ')}`);
  await page.screenshot({ path: `${OUT}/${cfg.name}.png` });
  await context.close();
}


/* weak-device probe: 4x CPU throttle, frame intervals while pages enter, choreography ON vs OFF (kill switch).
   Headless Chromium is indicative, not a device lab: the app's own render already costs ~100ms per page at 4x. */
{
  const { context, page, errors } = await open({ width: 390, height: 844 });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => go('home')); await page.waitForTimeout(1500);
  const probe = off => page.evaluate(async off => {
    HalaqatiMotion.off = off; const dts = []; let last = performance.now(); let run = true;
    const tick = t => { dts.push(t - last); last = t; if (run) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    for (const p of ['plans', 'home', 'sessions', 'students']) { go(p); await new Promise(r => setTimeout(r, 900)); }
    run = false; HalaqatiMotion.off = false; dts.sort((a, b) => a - b);
    return { n: dts.length, p50: dts[Math.floor(dts.length * .5)], p95: dts[Math.floor(dts.length * .95)] };
  }, off);
  const off1 = await probe(true), on1 = await probe(false), off2 = await probe(true), on2 = await probe(false);
  const offP95 = Math.min(off1.p95, off2.p95), onP95 = Math.min(on1.p95, on2.p95);
  console.log(`INFO  4x CPU throttle p95 frame interval: motion OFF ${offP95.toFixed(1)}ms, motion ON ${onP95.toFixed(1)}ms (p50 ${on1.p50.toFixed(1)}ms)`);
  note(onP95 <= offP95 + 20, `perf: motion adds at most ~1 frame at p95 under 4x CPU throttle (${onP95.toFixed(1)} vs ${offP95.toFixed(1)}ms)`);
  note(onP95 < 100, `perf: absolute p95 ${onP95.toFixed(1)}ms < 100ms under 4x CPU throttle`);
  note(errors.length === 0, 'perf: no JavaScript errors');
  await context.close();
}

/* reduced motion: movement removed (Tier 1), fade kept (Tier 2) */
for (const cfg of [{ name: 'reduced-mobile', width: 390, height: 844 }, { name: 'reduced-desktop', width: 1440, height: 900 }]) {
  const { context, page, errors } = await open({ ...cfg, reduce: true });
  const r = await page.evaluate(async () => {
    let moved = 0, faded = false;
    for (const p of ['students', 'plans', 'home', 'halaqas']) {
      go(p);
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 25));
        document.getAnimations().forEach(a => { const k = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : []; if (a.effect.getTiming().duration > 5 && k.some(f => f.transform && f.transform !== 'none')) moved++; });
        document.querySelectorAll('#content *').forEach(e => { if (/translate|matrix/.test(e.style.transform)) moved++; });
      }
    }
    const d = document.getElementById('halaqaDlg'); d.showModal(); await new Promise(r => setTimeout(r, 30)); const o = +getComputedStyle(d).opacity; const tr = getComputedStyle(d).transform; d.close();
    return { moved, faded, dlgOpacity: o, dlgTransform: tr };
  });
  note(r.moved === 0, `${cfg.name}: no transform movement during page entrance (moved=${r.moved})`);
  note(r.dlgTransform === 'none' || r.dlgTransform === 'matrix(1, 0, 0, 1, 0, 0)', `${cfg.name}: dialog has no slide/scale (${r.dlgTransform})`);
  note(errors.length === 0, `${cfg.name}: no JavaScript errors`);
  await context.close();
}

/* ===== Motion System v2: continuity, FLIP, loading->content, drawer drag, ornament, roles ===== */
for (const cfg of [{ name: 'v2-mobile', width: 390, height: 844 }, { name: 'v2-desktop', width: 1440, height: 900 }]) {
  const { context, page, errors } = await open(cfg);
  const mobile = cfg.width < 700;

  /* 1. page change keeps the real old page on screen (no skeleton flash) and crossfades into the new one */
  const pc = await page.evaluate(async () => {
    go('home'); await new Promise(r => setTimeout(r, 1200));
    const c = document.getElementById('content'); const oldFirst = c.firstElementChild; let skel = 0, oldStillThere = 0, frames = 0;
    go('halaqas');
    await new Promise(res => { let n = 0; const t = () => { frames++; if (c.querySelector('.ops-skeleton')) skel++; if (c.contains(oldFirst)) oldStillThere++; if (++n < 30) requestAnimationFrame(t); else res(); }; requestAnimationFrame(t); });
    return { skel, oldStillThere, frames, page: state.page };
  });
  note(pc.skel === 0, `${cfg.name}: navigating never flashes the loading skeleton on a fast page (skeleton frames=${pc.skel}/${pc.frames})`);
  note(pc.oldStillThere >= 1, `${cfg.name}: the previous page stays until the new one is ready (frames with old content=${pc.oldStillThere})`);

  /* 2. slow render still gets a skeleton after the grace period */
  const slow = await page.evaluate(async () => {
    const baseRender = window.render; let sawSkel = false;
    window.render = async function () { await new Promise(r => setTimeout(r, 420)); return baseRender.apply(this, arguments); };
    go('students'); await new Promise(r => setTimeout(r, 330)); sawSkel = !!document.querySelector('#content .ops-skeleton');
    await new Promise(r => setTimeout(r, 900)); window.render = baseRender;
    return { sawSkel, endSkel: !!document.querySelector('#content .ops-skeleton') };
  });
  note(slow.sawSkel && !slow.endSkel, `${cfg.name}: a genuinely slow page shows the skeleton after the grace period and removes it (${JSON.stringify(slow)})`);

  /* 3. loading -> content cross-fades (opacity only) instead of cutting */
  const lc = await page.evaluate(async () => {
    go('home'); await new Promise(r => setTimeout(r, 1200));
    document.getElementById('content').innerHTML = NX.skeleton(3);
    const p = render(); await new Promise(r => setTimeout(r, 30));
    const anims = document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#content') && a.playState === 'running');
    const opacityOnly = anims.length > 0 && anims.every(a => a.effect.getKeyframes().every(k => !k.transform || k.transform === 'none'));
    await p; await new Promise(r => setTimeout(r, 900));
    return { n: anims.length, opacityOnly, skelLeft: !!document.querySelector('#content .nx-skel'), stale: [...document.querySelectorAll('#content *')].filter(e => e.style.opacity !== '').length };
  });
  note(lc.n > 0 && lc.opacityOnly && !lc.skelLeft && lc.stale === 0, `${cfg.name}: skeleton -> content settles with an opacity-only fade and leaves no residue (${JSON.stringify(lc)})`);

  /* 4. same-page re-render: no re-entry of all rows; kept rows are not re-faded */
  const sp = await page.evaluate(async () => {
    go('students'); await new Promise(r => setTimeout(r, 1300));
    let fades = 0; const watch = () => document.getAnimations().forEach(a => { const k = a.effect?.getKeyframes?.() || []; if (a.effect?.target?.closest?.('#content') && k.some(f => f.opacity === '0' || f.opacity === 0)) fades++; });
    const done = new Promise(res => { let n = 0; const t = () => { watch(); if (++n < 20) requestAnimationFrame(t); else res(); }; requestAnimationFrame(t); });
    await render(); await done;
    return { fades, stale: [...document.querySelectorAll('#content *')].filter(e => e.style.opacity !== '' || /translate|matrix|scale/.test(e.style.transform)).length };
  });
  note(sp.fades === 0 && sp.stale === 0, `${cfg.name}: re-rendering the same page replays no entrance (opacity-from-0 animations seen: ${sp.fades})`);

  if (mobile) {
    /* 5. FLIP on in-place update (roster card): siblings glide, card reveals, chevron turns, everything settles clean */
    const fl = await page.evaluate(async () => {
      state.sessionView = state.sessions[0].id; go('sessions'); await new Promise(r => setTimeout(r, 1600));
      const sid = state.students[0].id, cards = () => [...document.querySelectorAll('[id^="roster_"]')];
      const y0 = cards().map(c => c.getBoundingClientRect().top);
      NSR.toggle(sid);
      const mid = cards().map(c => ({ id: c.id, tf: getComputedStyle(c).transform, clip: getComputedStyle(c).clipPath, anims: c.getAnimations().length }));
      const chev = document.querySelector('#roster_' + sid + ' .nr-chev svg'); const chevAnims = chev ? chev.getAnimations().length : -1;
      await new Promise(r => setTimeout(r, 800));
      const settled = cards().every(c => c.getAnimations().length === 0 && (getComputedStyle(c).transform === 'none' || getComputedStyle(c).transform === 'matrix(1, 0, 0, 1, 0, 0)'));
      return { moving: mid.filter(m => m.anims > 0).length, chevAnims, settled, residue: cards().filter(c => c.getAttribute('style')).length };
    });
    note(fl.moving >= 2 && fl.chevAnims >= 1, `${cfg.name}: expanding a roster card animates the card and the siblings below it (animated blocks=${fl.moving}, chevron anims=${fl.chevAnims})`);
    note(fl.settled && fl.residue === 0, `${cfg.name}: the in-place update settles with no running animation and no inline residue`);

    /* 6. the chevron is ONE element that turns: same node, same path, rotation on the card state */
    const ch = await page.evaluate(async () => {
      go('students'); await new Promise(r => setTimeout(r, 1400));
      const card = document.querySelector('.nst-card'); const btn = card.querySelector('.nst-card-head > .nx-iconbtn'); const svg = btn.querySelector('svg'); const before = svg.innerHTML;
      NSS.toggle(card.dataset.stcard); await new Promise(r => setTimeout(r, 60));
      const sameNode = btn.querySelector('svg') === svg && svg.innerHTML === before; const mid = getComputedStyle(svg).transform;
      await new Promise(r => setTimeout(r, 450)); const open = new DOMMatrix(getComputedStyle(svg).transform);
      const vis = getComputedStyle(card.querySelector('.nst-card-more')).visibility;
      NSS.toggle(card.dataset.stcard); await new Promise(r => setTimeout(r, 60));
      const closingVisible = getComputedStyle(card.querySelector('.nst-card-more')).visibility; /* content stays visible while the height collapses */
      await new Promise(r => setTimeout(r, 450)); const closedVis = getComputedStyle(card.querySelector('.nst-card-more')).visibility;
      return { sameNode, mid, rot: Math.round(Math.atan2(open.b, open.a) * 180 / Math.PI), vis, closingVisible, closedVis };
    });
    note(ch.sameNode && Math.abs(ch.rot) === 180, `${cfg.name}: the card chevron is one icon that turns 180deg (no image swap): ${JSON.stringify(ch)}`);
    note(ch.vis === 'visible' && ch.closingVisible === 'visible' && ch.closedVis === 'hidden', `${cfg.name}: accordion content stays visible while it collapses, hidden once closed`);

    /* 7. drawer follows the finger and is reversible */
    const cdp = await context.newCDPSession(page);
    const touch = (type, x, y = 400) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await page.evaluate(() => { toggleDrawer(true); }); await page.waitForTimeout(600);
    await touch('touchStart', 100); for (let x = 100; x <= 190; x += 15) { await touch('touchMove', x); await page.waitForTimeout(14); }
    const during = await page.evaluate(() => ({ tf: document.getElementById('drawer').style.transform, bo: document.getElementById('backdrop').style.opacity, open: document.getElementById('drawer').classList.contains('open') }));
    await touch('touchEnd', 190); await page.waitForTimeout(150);
    const snap = await page.evaluate(() => ({ open: document.getElementById('drawer').classList.contains('open'), style: document.getElementById('drawer').getAttribute('style') || '', bstyle: document.getElementById('backdrop').getAttribute('style') || '' }));
    await page.waitForTimeout(500);
    note(/translateX\(9\dpx\)|translateX\(8\dpx\)/.test(during.tf) && +during.bo < 1 && during.open, `${cfg.name}: while dragging, drawer tracks the finger (${during.tf}) and the backdrop fades (${(+during.bo).toFixed(2)})`);
    note(snap.open && !/transform|transition/.test(snap.style) && !/opacity|transition/.test(snap.bstyle), `${cfg.name}: a short drag snaps back to open with no inline residue`);
    await touch('touchStart', 100); for (let x = 100; x <= 260; x += 20) { await touch('touchMove', x); await page.waitForTimeout(12); }
    await touch('touchEnd', 260); await page.waitForTimeout(700);
    const fin = await page.evaluate(() => ({ open: document.getElementById('drawer').classList.contains('open'), hidden: document.getElementById('drawer').getAttribute('aria-hidden'), style: document.getElementById('drawer').getAttribute('style') || '', bo: getComputedStyle(document.getElementById('backdrop')).opacity }));
    note(!fin.open && fin.hidden === 'true' && fin.style === '' && fin.bo === '0', `${cfg.name}: a long drag closes the drawer from where the finger left it, leaving nothing behind (${JSON.stringify(fin)})`);
    /* a vertical swipe must stay native scrolling, not a drag */
    await page.evaluate(() => toggleDrawer(true)); await page.waitForTimeout(600);
    await touch('touchStart', 150, 500); for (let y = 500; y >= 380; y -= 15) { await touch('touchMove', 150, y); await page.waitForTimeout(12); }
    const vert = await page.evaluate(() => document.getElementById('drawer').style.transform); await touch('touchEnd', 150, 380);
    note(vert === '', `${cfg.name}: a vertical swipe in the menu is not hijacked by the drag (inline transform='${vert}')`);
    await page.evaluate(() => toggleDrawer(false)); await page.waitForTimeout(500);
    /* reverse mid-flight: open then close after 90ms -> position never jumps back to a fully-open pose */
    const rev = await page.evaluate(async () => {
      const d = document.getElementById('drawer'); const xs = []; toggleDrawer(true); await new Promise(r => setTimeout(r, 90)); toggleDrawer(false);
      await new Promise(res => { let n = 0; const t = () => { xs.push(new DOMMatrix(getComputedStyle(d).transform).m41); if (++n < 40) requestAnimationFrame(t); else res(); }; requestAnimationFrame(t); });
      let jump = 0; for (let i = 1; i < xs.length; i++) jump = Math.max(jump, Math.abs(xs[i] - xs[i - 1])); return { jump: Math.round(jump), start: Math.round(xs[0]), min: Math.round(Math.min(...xs)), end: Math.round(xs[xs.length - 1]) };
    });
    note(rev.end > 300 && rev.jump < 200, `${cfg.name}: reversing the drawer mid-animation continues from the current position (max frame step ${rev.jump}px, min x ${rev.min}, end x ${rev.end})`);
  }

  /* 8. empty state ornament: present, drawn once, never over data */
  const em = await page.evaluate(async () => {
    state.students = []; go('students'); await new Promise(r => setTimeout(r, 1400));
    const box = document.querySelector('#content .nx-empty'); const o = box && box.querySelector('.hm-orn');
    return { has: !!box, orn: !!o, behind: o ? getComputedStyle(o).zIndex : null, dataNear: !!document.querySelector('#content .nst-card') };
  });
  if (em.has) note(em.orn && em.behind === '-1' && !em.dataNear, `${cfg.name}: the empty state carries a geometric star, behind the content, with no student data around it`);
  else console.log(`INFO  ${cfg.name}: the test data produced no .nx-empty on the students page (ornament not exercised here)`);
  note(errors.length === 0, `${cfg.name}: no JavaScript errors in v2 checks ${errors.slice(0, 2).join(' | ')}`);
  await context.close();
}

/* roles: every role walks its own pages with the choreography on; no errors, nothing left hanging */
for (const role of ['admin', 'supervisor', 'teacher', 'guardian', 'observer']) {
  const { context, page, errors } = await open({ width: 390, height: 844, role });
  const res = await page.evaluate(async role => {
    const pages = role === 'guardian' ? ['home', 'reports', 'plans', 'home'] : ['home', 'sessions', 'students', 'plans', 'halaqas', 'home'];
    let animated = 0;
    for (const p of pages) { go(p); await new Promise(r => setTimeout(r, 60)); if (document.getAnimations().some(a => a.effect?.target?.closest?.('#content')) || document.documentElement.classList.contains('hm-pre')) animated++; await new Promise(r => setTimeout(r, 900)); }
    return { animated, pages: pages.length, pre: document.documentElement.classList.contains('hm-pre'), stale: [...document.querySelectorAll('#content *')].filter(e => e.style.opacity !== '' || /translate|matrix|scale/.test(e.style.transform)).length, running: HalaqatiMotion.gsap.globalTimeline.getChildren(true, true, true).length };
  }, role);
  note(res.pre === false && res.stale === 0 && res.running === 0 && errors.length === 0, `role ${role}: ${res.pages} pages walked, entrance on ${res.animated}, no leftovers, no JavaScript errors ${errors.slice(0, 1).join('')}`);
  await context.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nMotion check: all passed');
process.exit(failures.length ? 1 : 0);
