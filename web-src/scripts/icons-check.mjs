/* Living icons: every navigation icon plays its OWN meaningful animation when its page becomes active,
 * leaves nothing behind, is silent under reduced motion, and the bell rings only when the unread count rises.
 * Real Chromium; network mocked. Usage: BASE_URL=http://127.0.0.1:4173/ node scripts/icons-check.mjs */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function open(role = 'admin', width = 1280, height = 800, reduced = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: reduced });
  await context.route(/https:\/\//, r => /supabase\.co/.test(new URL(r.request().url()).host)
    ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-allow-origin': '*' }, body: '[]' }) : r.abort());
  const page = await context.newPage(); page.on('pageerror', () => {});
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 45000 });
  await page.locator('#rc27Splash').evaluate(e => e.remove()).catch(() => {});
  await page.evaluate(ROLE => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    state.user = { id: id(1) }; state.profile = { id: id(1), role: ROLE, full_name: 'د. محمد', active: true, approval_status: 'approved' };
    state.offline = false; state.networkVerified = true;
    state.halaqas = [{ id: id(10), name: 'حلقة', active: true, halaqa_type: 'regular' }];
    state.students = Array.from({ length: 6 }, (_, i) => ({ id: id(100 + i), full_name: 'طالب ' + i, status: 'active', halaqa_id: id(10), track_code: 'general_hifz', enrollment_date: '2026-01-01' }));
    state.sessions = []; state.page = 'home';
    document.getElementById('auth').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); render();
  }, role);
  await page.waitForTimeout(900);
  return { context, page };
}
/* names of the icon-specific animations running on the ACTIVE nav icon right after activation */
const sample = (page, id) => page.evaluate(async id => {
  await go(id); await new Promise(r => setTimeout(r, 90));
  const svg = document.querySelector('#nav button.active svg'); if (!svg) return null;
  return { names: svg.getAnimations({ subtree: true }).map(a => a.animationName).filter(Boolean), ic: svg.getAttribute('data-ic') };
}, id);
const residue = page => page.evaluate(async () => {
  await new Promise(r => setTimeout(r, 1300));
  const svg = document.querySelector('#nav button.active svg');
  return { running: svg.getAnimations({ subtree: true }).length, dirty: [...svg.querySelectorAll('*')].filter(e => getComputedStyle(e).transform !== 'none' || e.getAttribute('style')).length };
});

const PAGES = ['notifications', 'halaqas', 'community', 'sessions', 'students', 'plans', 'certificates', 'reports', 'quran', 'ranking', 'supervision', 'users', 'data', 'settings', 'home'];
{
  const { context, page } = await open();
  const byIcon = {};
  for (const id of PAGES) {
    const s = await sample(page, id);
    byIcon[id] = (s?.names || []).filter(n => n.startsWith('hm-ic-'));
    ok(s && s.ic === id && byIcon[id].length > 0, `icon "${id}" plays its own animation on activation (${byIcon[id].join(', ') || 'none'})`);
    const r = await residue(page);
    ok(r.running === 0 && r.dirty === 0, `icon "${id}" leaves nothing behind (running ${r.running}, dirty nodes ${r.dirty})`);
  }
  const distinct = new Set(Object.values(byIcon).map(a => a.join('+')));
  ok(distinct.size >= 12, `icons do not all move the same way (${distinct.size} distinct animations for ${PAGES.length} icons)`);

  /* quick navigation (a new page every 120ms, well inside the 900ms pop window): the LAST icon still plays its gesture and nothing sticks */
  const fast = await page.evaluate(async () => {
    for (const id of ['sessions', 'students', 'plans']) { await go(id); await new Promise(r => setTimeout(r, 120)); }
    const sv = document.querySelector('#nav button.active svg');
    const names = sv.getAnimations({ subtree: true }).map(a => a.animationName).filter(n => n.startsWith('hm-ic-'));
    await new Promise(r => setTimeout(r, 1400));
    return { ic: sv.getAttribute('data-ic'), names, left: document.querySelector('#nav button.active svg').getAnimations({ subtree: true }).length, cls: document.querySelector('#nav').classList.contains('hm-nav-pop') };
  });
  ok(fast.ic === 'plans' && fast.names.length > 0 && fast.left === 0 && !fast.cls, `rapid navigation: the last icon ("${fast.ic}") still animates (${fast.names.join(', ')}), then nothing is left (running ${fast.left}, pop class gone ${!fast.cls})`);

  /* bell: rings when the unread count RISES, not otherwise */
  const ring = await page.evaluate(async () => {
    const cnt = document.getElementById('notificationBellCount'), bell = document.querySelector('#notificationBell svg');
    const rung = () => bell.getAnimations({ subtree: true }).some(a => (a.animationName || '').startsWith('hm-ic-ring'));
    const set = async v => { cnt.textContent = v; await new Promise(r => setTimeout(r, 90)); return rung(); };
    const up = await set('1'); await new Promise(r => setTimeout(r, 1300));
    const same = await set('1'); const down = await set('0'); await new Promise(r => setTimeout(r, 1300));
    const up2 = await set('3');
    return { up, same, down, up2 };
  });
  ok(ring.up && ring.up2 && !ring.same && !ring.down, `bell rings only when the unread count rises (up ${ring.up}, same ${ring.same}, down ${ring.down}, up again ${ring.up2})`);
  await context.close();
}
{ /* reduced motion: no icon movement at all, state still readable (active class) */
  const { context, page } = await open('admin', 1280, 800, 'reduce');
  let moved = 0; for (const id of ['notifications', 'sessions', 'settings']) { const s = await sample(page, id); moved += (s?.names || []).filter(n => n.startsWith('hm-ic-')).length; }
  ok(moved === 0, `reduced motion: no icon animation (${moved})`);
  await context.close();
}
{ /* phone: the bottom bar icons move too (390px), and a bell ring is ONE animation, never stacked by repeated installs */
  const { context, page } = await open('admin', 390, 844);
  /* the admin phone bar is: home, sessions, (+), community, more. Pages that live under "more" activate the "more" icon. */
  for (const [id, want] of [['sessions', 'sessions'], ['home', 'home'], ['community', 'community'], ['students', 'more'], ['settings', 'more']]) {
    const r = await page.evaluate(async id => { await go(id); await new Promise(r => setTimeout(r, 90)); const sv = document.querySelector('#mobileNav button.active svg'); return sv ? { ic: sv.getAttribute('data-ic'), names: sv.getAnimations({ subtree: true }).map(a => a.animationName).filter(n => n.startsWith('hm-ic-')) } : null; }, id);
    ok(r && r.ic === want && r.names.length > 0, `phone bar: page "${id}" activates the "${want}" icon and it animates (${r ? r.ic + ': ' + r.names.join(', ') : 'none'})`);
  }
  const rings = await page.evaluate(async () => {
    const cnt = document.getElementById('notificationBellCount'), bell = document.querySelector('#notificationBell svg');
    cnt.textContent = '5'; cnt.textContent = '6'; await new Promise(r => setTimeout(r, 90));
    return bell.getAnimations().filter(a => (a.animationName || '').startsWith('hm-ic-ring')).length;
  });
  ok(rings === 1, `two quick increments still give exactly one ring animation (${rings})`);
  await context.close();
}
await browser.close();
console.log(fails ? `\n${fails} icon check(s) FAILED` : '\nIcon checks: all passed');
process.exit(fails ? 1 : 0);
