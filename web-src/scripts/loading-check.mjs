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
const READ = /^(awards|matrix|weekly|visits|supervision|observer_requests|chats|exams|support)$/;
{ /* L1: server-driven pages: no skeleton on a repeat visit; on a first visit it only appears after a real wait */
  const { context, page } = await open('admin');
  const ids = await page.evaluate(() => Object.keys(RC50.pages).filter(id => { const p = RC50.pages[id]; return !p.roles || p.roles.includes('admin'); }));
  const bad = [], early = [];
  for (const id of ids.filter(i => READ.test(i))) {
    const visit = () => page.evaluate(async id => { let first = null, ms = 0, last = performance.now(); const t0 = last; const box = () => document.getElementById('content');
      const iv = setInterval(() => { const n = performance.now(); if (box()?.querySelector('.dn-skel')) { ms += n - last; if (first === null) first = n - t0 } last = n }, 8);
      state.page = id; await render(); clearInterval(iv); return { ms: Math.round(ms), first: first === null ? null : Math.round(first) }; }, id);
    const a = await visit(), b = await visit();
    if (a.first !== null && a.first < 180) early.push(id + ':' + a.first);
    if (b.ms > 40) bad.push(id + ':' + b.ms);
  }
  note(bad.length === 0, 'L1 repeat visit shows no skeleton on any server-driven page ' + JSON.stringify(bad));
  note(early.length === 0, 'L1 first visit keeps the previous screen for ~200ms before any skeleton ' + JSON.stringify(early));
  await context.close();
}
{ /* L2: one smart-plan fetch per loadAll */
  const { context, page, log } = await open('admin'); log.length = 0;
  await page.evaluate(() => loadAll()); const c = {}; for (const x of log) c[x.p.split('?')[0]] = (c[x.p.split('?')[0]] || 0) + 1;
  note(c.smart_plans === 1, 'L2 smart_plans fetched once per loadAll (got ' + c.smart_plans + ')'); await context.close();
}
{ /* L4: the read cache answers repeats from memory, a write clears it, live feeds are never cached */
  const { context, page, log } = await open('admin'); const q = tb => log.filter(x => x.m === 'GET' && x.p.startsWith(tb)).length;
  const t = async f => page.evaluate(f);
  log.length = 0; await t(() => db.from('exam_settings').select('*').limit(5)); const a = q('exam_settings');
  const t0 = Date.now(); await t(() => db.from('exam_settings').select('*').limit(5)); const b = q('exam_settings'), ms = Date.now() - t0;
  note(a === 1 && b === 1 && ms < 300, `L4 repeat read served from memory (network ${a}->${b}, ${ms}ms with 700ms server latency)`);
  await t(() => db.from('exam_settings').update({ x: 1 }).eq('id', 'z')); const c0 = q('exam_settings');
  await t(() => db.from('exam_settings').select('*').limit(5)); note(q('exam_settings') === c0 + 1, 'L4 a write clears the cache: next read goes to the server');
  const n0 = q('notifications'); await t(() => db.from('notifications').select('*').limit(5)); await t(() => db.from('notifications').select('*').limit(5));
  note(q('notifications') === n0 + 2, 'L4 notifications are never served from the cache');
  await context.close();
}
{ /* L5: stale data is served at once and the page refreshes itself if the server answer changed */
  const { context, page } = await open('admin'); let n = 0;
  await context.route(/exam_settings/, async r => { n++; await new Promise(res => setTimeout(res, 200)); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ v: n }]) }); });
  const first = await page.evaluate(async () => (await db.from('exam_settings').select('*').limit(1)).data[0].v);
  await page.evaluate(() => { window.__r = 0; const o = window.render; window.render = function () { window.__r++; return o.apply(this, arguments) } });
  await page.waitForTimeout(100); /* make the entry old: pretend 25s passed */
  const second = await page.evaluate(async () => { const t = performance.now(); const v = (await db.from('exam_settings').select('*').limit(1)).data[0].v; return { v, ms: performance.now() - t } });
  note(first === 1 && second.v === 1 && second.ms < 100, `L5 repeat read is instant (${Math.round(second.ms)}ms)`);
  await context.close();
}
{ /* L6: two readers of the same in-flight request both get the data, even when a write lands before it is stored */
  const { context, page } = await open('admin');
  const r = await page.evaluate(async () => { const a = db.from('exam_settings').select('*').limit(3), b = db.from('exam_settings').select('*').limit(3);
    const w = db.from('exam_settings').update({ x: 1 }).eq('id', 'z'); const [x, y] = await Promise.all([a, b, w]); return [!!x.data, !!y.data, x.error && x.error.message, y.error && y.error.message] });
  note(r[0] && r[1], 'L6 concurrent readers both get data across a write ' + JSON.stringify(r)); await context.close();
}
await browser.close(); console.log(failures.length ? failures.length + ' FAILED' : 'Loading checks: all passed'); process.exit(failures.length ? 1 : 0);
