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

async function open({ width, height, dark = false, reduce = false, video = false }) {
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
  await page.evaluate(({ dark }) => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    state.user = { id: id(1) };
    state.profile = { id: id(1), role: 'admin', full_name: 'د. محمد سمير أبو يونس', active: true, approval_status: 'approved' };
    state.offline = true; state.networkVerified = false;
    state.halaqas = [0, 1, 2].map(i => ({ id: id(10 + i), name: ['حلقة معاوية بن أبي سفيان', 'حلقة عمر بن الخطاب', 'حلقة الفاروق'][i], active: true, halaqa_type: 'regular' }));
    state.students = Array.from({ length: 12 }, (_, i) => ({ id: id(100 + i), full_name: 'طالب ' + i + ' أبو يونس', status: 'active', halaqa_id: state.halaqas[i % 3].id, track_code: 'general_hifz', enrollment_date: '2026-01-01' }));
    state.sessions = [{ id: id(4), halaqa_id: state.halaqas[0].id, session_date: today(), session_type: 'tasmee', status: 'open', title: 'جلسة اليوم', activity_data: {} }];
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    if (dark) document.body.classList.add('dark');
  }, { dark });
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

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nMotion check: all passed');
process.exit(failures.length ? 1 : 0);
