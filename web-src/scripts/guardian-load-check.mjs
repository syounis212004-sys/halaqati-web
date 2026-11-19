/* Guardian home loads each child's month/day rank: those requests must go out TOGETHER (N children = one round trip), and the data must land per child.
 * Real Chromium, Supabase mocked with 300 ms latency. Usage: BASE_URL=http://127.0.0.1:4173/ node scripts/guardian-load-check.mjs */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
let inflight = 0, peak = 0, total = 0;
await ctx.route(/https:\/\//, async r => {
  const u = new URL(r.request().url()); if (!/supabase\.co/.test(u.host)) return r.abort();
  const isRank = /student_rank_snapshot/.test(u.pathname);
  if (isRank) { total++; inflight++; peak = Math.max(peak, inflight); }
  await new Promise(res => setTimeout(res, 300));
  const body = isRank ? JSON.stringify([{ student_id: 'x', rank: 1, score: 9 }]) : '[]';
  if (isRank) inflight--;
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-allow-origin': '*' }, body }).catch(() => {});
});
const page = await ctx.newPage(); page.on('pageerror', () => {});
await page.goto(BASE);
await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 60000 });
const res = await page.evaluate(async () => {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  state.user = { id: id(1) }; state.profile = { id: id(1), role: 'guardian', full_name: 'ولي', active: true, approval_status: 'approved' };
  state.networkVerified = true; state.offline = false;
  state.students = Array.from({ length: 5 }, (_, i) => ({ id: id(100 + i), full_name: 'ابن ' + i, status: 'active', halaqa_id: id(10) }));
  const t0 = performance.now(); await loadRoleExtras(); const ms = Math.round(performance.now() - t0);
  const ids = state.students.map(s => s.id);
  return { ms, month: ids.filter(i => Array.isArray(state.guardianRanksMonth[i]) && state.guardianRanksMonth[i].length).length, day: ids.filter(i => Array.isArray(state.guardianRanksDay[i]) && state.guardianRanksDay[i].length).length };
});
ok(res.month === 5 && res.day === 5, `every child gets month and day ranks (month ${res.month}/5, day ${res.day}/5)`);
ok(total === 10, `exactly 2 rank requests per child (${total})`);
ok(peak >= 10, `all children's rank requests are in flight together (peak ${peak}; one after another would be 2)`);
console.log(`   loadRoleExtras took ${res.ms} ms with 5 children at 300 ms per request`);
await browser.close();
console.log(fails ? `\n${fails} guardian check(s) FAILED` : '\nGuardian load checks: all passed');
process.exit(fails ? 1 : 0);
