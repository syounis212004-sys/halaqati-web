/* Supabase request budget per role and page, in real Chromium against ./dist (run `npm run build` first). Supabase is answered locally
 * (synthetic rows, no real data), so only the app's own request behaviour is measured: full load, first visit of every page, and an
 * immediate revisit. Prints a table and fails when a budget is exceeded.
 * Usage: node scripts/data-usage-check.mjs [role]      JSON copy: --json out.json */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serveDist } from './_static-server.mjs';

const { base: BASE, close } = serveDist(+(process.env.USAGE_PORT || 4195));
const ROLES = {
  admin: ['home', 'notifications', 'halaqas', 'community', 'sessions', 'students', 'plans', 'certificates', 'exams', 'awards', 'support', 'chats', 'observer_requests', 'reports', 'quran', 'ranking', 'insights', 'data', 'supervision', 'visits', 'approvals', 'org', 'staff', 'users', 'settings', 'matrix', 'weekly', 'team'],
  supervisor: ['home', 'notifications', 'halaqas', 'programs', 'supervision', 'visits', 'sessions', 'students', 'exams', 'reports', 'ranking', 'insights', 'community', 'approvals', 'org', 'staff', 'settings', 'matrix', 'weekly', 'team'],
  teacher: ['home', 'notifications', 'community', 'halaqas', 'sessions', 'students', 'plans', 'certificates', 'exams', 'reports', 'quran', 'ranking', 'insights', 'data', 'approvals', 'settings', 'matrix', 'weekly'],
  guardian: ['home', 'notifications', 'community', 'plans', 'exams', 'reports', 'competition', 'ranking', 'profile', 'settings'],
  observer: ['home', 'donor_awards', 'donor_support', 'donor_impact', 'donor_stats', 'notifications', 'settings'],
};
/* budgets: ceilings measured on the fixed build with the synthetic data below (a regression must be a conscious decision) */
const BUDGET = { loadAll: 25, firstLoadExtra: 1 /* one lazy photo request on the very first load */, guardianLoadAll: 32 /* 22 + 5 per child (2 children): the per-child fan-out is a known cost */, revisitRatio: 0.85 };
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const STUDENTS = Array.from({ length: 65 }, (_, i) => ({ id: id(100 + i), full_name: 'طالب ' + i, status: 'active', halaqa_id: id(10), track_code: 'general_hifz', enrollment_date: '2026-01-01' }));
const only = process.argv[2] && ROLES[process.argv[2]] ? [process.argv[2]] : Object.keys(ROLES);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const out = {};

for (const role of only) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const log = [], selects = [], mine = role === 'guardian' ? STUDENTS.slice(0, 2) : STUDENTS; /* a guardian only ever sees their own children (RLS) */
  await ctx.route(/https:\/\//, r => {
    const u = new URL(r.request().url());
    if (!/supabase\.co/.test(u.host)) return r.abort();
    log.push(`${r.request().method()} ${u.pathname}`); if (/\/students$/.test(u.pathname)) selects.push(u.searchParams.get('select') || '');
    const rows = /\/students$/.test(u.pathname) ? mine : /\/halaqas$/.test(u.pathname) ? [{ id: id(10), name: 'حلقة', active: true, halaqa_type: 'regular' }] : [];
    const range = r.request().headers().range; let body = rows;
    if (range) { const [a, b] = range.split('-').map(Number); body = rows.slice(a, b + 1); }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`, 'access-control-allow-origin': '*' }, body: u.pathname.includes('/auth/') ? '{}' : JSON.stringify(body) });
  });
  const page = await ctx.newPage(); page.on('pageerror', () => {});
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 60000 });
  await page.locator('#rc27Splash').evaluate(e => e.remove()).catch(() => {});
  await page.evaluate(ROLE => {
    const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    state.user = { id: id(1) }; state.profile = { id: id(1), role: ROLE, full_name: 'اختبار', active: true, approval_status: 'approved' };
    state.offline = false; state.networkVerified = true; state.halaqas = [{ id: id(10), name: 'حلقة', active: true, halaqa_type: 'regular' }]; state.students = []; state.sessions = []; state.page = 'home';
    document.getElementById('auth').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); render();
  }, role);
  await page.waitForTimeout(1500);
  log.length = 0;
  await page.evaluate(() => loadAll(true)).catch(() => {}); await page.waitForTimeout(800);
  const loadAll = log.length, studentCalls = selects.filter(x => x !== 'id,photo_path').length;
  log.length = 0; await page.evaluate(() => loadAll(true)).catch(() => {}); await page.waitForTimeout(800); const secondLoad = log.length; log.length = 0;
  const res = { loadAll, secondLoad, studentCalls, pass1: 0, pass2: 0 };
  for (const pass of ['pass1', 'pass2']) for (const pid of ROLES[role]) {
    log.length = 0; await page.evaluate(p => go(p), pid).catch(() => {}); await page.waitForTimeout(700); res[pass] += log.length;
  }
  res.photoRequests = selects.filter(x => x === 'id,photo_path').length;
  out[role] = res; await ctx.close();
  if (role === 'admin') { const list = selects.find(x => x !== 'id,photo_path'); ok(!!list && list !== '*' && !list.split(',').includes('photo_path'), `admin: the student list does not ask for the inline photo column (select=${(list || '').slice(0, 40)}...)`); ok(res.photoRequests >= 1, `admin: photos are fetched separately (${res.photoRequests} request)`); }
  if (role !== 'observer') { const cap = role === 'guardian' ? BUDGET.guardianLoadAll : BUDGET.loadAll; ok(loadAll <= cap + BUDGET.firstLoadExtra, `${role}: first full load ${loadAll} requests (budget ${cap + BUDGET.firstLoadExtra})`); ok(secondLoad <= cap, `${role}: repeat full load ${secondLoad} requests, no photo request (budget ${cap})`); ok(studentCalls === 1, `${role}: ${mine.length} students need one request, not one plus an empty page (${studentCalls})`); }
  ok(res.pass2 <= Math.ceil(res.pass1 * BUDGET.revisitRatio), `${role}: immediate revisits ${res.pass2} <= ${Math.ceil(res.pass1 * BUDGET.revisitRatio)} (first visits ${res.pass1})`);
}
console.table(out);
const jp = process.argv.indexOf('--json'); if (jp > -1) fs.writeFileSync(process.argv[jp + 1], JSON.stringify(out, null, 1));
await browser.close(); close();
console.log(fails ? `\n${fails} data-usage check(s) FAILED` : '\nData-usage checks: all passed');
process.exit(fails ? 1 : 0);
