/* Measurements behind the loading / motion report. Mocks only the network (every https request is counted and answered with [] after a delay). */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/', DELAY = +(process.env.DELAY || 700);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });

async function open(role = 'admin', width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  const log = [];
  await context.route(/https:\/\//, async r => {
    const u = new URL(r.request().url());
    if (!/supabase\.co/.test(u.host)) return r.abort();
    log.push({ t: Date.now(), m: r.request().method(), p: u.pathname.replace('/rest/v1/', '') });
    await new Promise(res => setTimeout(res, DELAY));
    if (/\/storage\//.test(u.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"signedURL":"/object/sign/student-photos/x?token=t"}' });
    const rpc = /\/rpc\//.test(u.pathname);
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-allow-origin': '*' }, body: u.pathname.endsWith('/smart_plans') && r.request().method() === 'GET' ? '[{"id":"p1","category_id":null,"title":"x","status":"active"}]' : /single|object/.test(r.request().headers().accept || '') ? '{}' : (rpc ? '[]' : '[]') });
  });
  const page = await context.newPage();
  page.on('pageerror', () => {});
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 45000 });
  await page.locator('#rc27Splash').evaluate(e => e.remove()).catch(() => {});
  await page.evaluate(ROLE => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    state.user = { id: id(1) };
    state.profile = { id: id(1), role: ROLE, full_name: 'د. محمد', active: true, approval_status: 'approved' };
    state.offline = false; state.networkVerified = true;
    state.halaqas = [0, 1, 2].map(i => ({ id: id(10 + i), name: 'حلقة ' + i, active: true, halaqa_type: 'regular' }));
    state.students = Array.from({ length: 12 }, (_, i) => ({ id: id(100 + i), full_name: 'طالب ' + i, status: 'active', halaqa_id: state.halaqas[i % 3].id, track_code: 'general_hifz', enrollment_date: '2026-01-01' }));
    state.sessions = [{ id: id(4), halaqa_id: state.halaqas[0].id, session_date: today(), session_type: 'tasmee', status: 'open', title: 'جلسة اليوم', activity_data: {} }];
    document.getElementById('auth').classList.add('hidden'); document.getElementById('app').classList.remove('hidden');
  }, role);
  return { context, page, log };
}
const tally = log => { const c = {}; for (const x of log) { const k = x.p.split('?')[0]; c[k] = (c[k] || 0) + 1; } return c; };


const failures = []; const note = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures.push(msg); };

const GROUPS = [['home', ['.notification-bell', '.h86-more', '#mobileNav button']], ['students', ['.nst-card-main']], ['support', ['.dn-btn', '.dn-seg button']]];
const DRAWER = ['.dtile', '.d86-fav', '.nav-section.d86-gh', '.drawer-logout'];
const { context, page } = await open('admin');
const press = async sel => {
  const loc = page.locator(sel); const n = await loc.count(); let el = null;
  for (let i = 0; i < Math.min(n, 12); i++) { const b = await loc.nth(i).boundingBox(); if (b && b.width > 4 && b.height > 4 && b.y > 0 && b.y < 800) { el = loc.nth(i); break; } }
  if (!el) return null;
  const read = () => el.evaluate(e => { const s = getComputedStyle(e); return (s.scale === 'none' ? 1 : parseFloat(s.scale)) * (s.transform === 'none' ? 1 : new DOMMatrix(s.transform).a) });
  const b = await el.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(250);
  const rest = await read(); await page.mouse.down(); await page.waitForTimeout(220); const down = await read(); if (process.env.DBG) console.log('  dbg', sel, await el.evaluate(e => ({ active: e.matches(':active'), cls: e.className, sc: getComputedStyle(e).scale, open: document.getElementById('drawer')?.className }))); await page.mouse.up(); await page.keyboard.press('Escape');
  const peaks = []; for (let i = 0; i < 30; i++) { peaks.push(await read()); await page.waitForTimeout(16) } await page.waitForTimeout(500); const end = await read();
  return { rest, down, max: Math.max(...peaks), end };
};
for (const [pg, sels] of GROUPS) { await page.evaluate(async p => { state.page = p; await render(); }, pg); await page.waitForTimeout(1500);
  for (const sel of sels) { await page.evaluate(async p => { toggleDrawer(false); state.page = p; await render(); }, pg); await page.waitForTimeout(1300); const r = await press(sel); note(!!r && r.down < r.rest - 0.012 && r.down > 0.85 && Math.abs(r.end - 1) < 0.003, `press ${pg} ${sel}: rest ${r && r.rest.toFixed(3)} pressed ${r && r.down.toFixed(3)} settles ${r && r.end.toFixed(3)}`) } }
await page.evaluate(() => toggleDrawer(true)); await page.waitForTimeout(700);
for (const sel of DRAWER) { await page.evaluate(async () => { state.page = 'support'; await render(); toggleDrawer(true) }); await page.waitForTimeout(1500); const r = await press(sel); note(!!r && r.down < r.rest - 0.012 && r.down > 0.85 && Math.abs(r.end - 1) < 0.003, `press drawer ${sel}: rest ${r && r.rest.toFixed(3)} pressed ${r && r.down.toFixed(3)} settles ${r && r.end.toFixed(3)}`) }
await context.close(); await browser.close(); console.log(failures.length ? failures.length + ' FAILED' : 'Press checks: all passed'); process.exit(failures.length ? 1 : 0);
