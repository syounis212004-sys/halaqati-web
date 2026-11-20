/* Offline reload of pages that load their own data: every page visited online must still render (saved answers, marked stale) after the
 * network is cut and the tab reloaded, instead of staying a skeleton. Also checks sign-out purge. Real Chromium + service worker; Supabase answered
 * locally with synthetic data. Usage: node scripts/offline-pages-check.mjs   (serves ./dist, run `npm run build` first) */
import { chromium } from 'playwright';
import { serveDist } from './_static-server.mjs';

const { base: BASE, close } = serveDist(+(process.env.OFFLINE_PORT || 4196));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PAGES = ['exams', 'supervision', 'weekly', 'insights', 'plans', 'reports', 'community'];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let online = true;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' });
await ctx.route(/https:\/\//, r => {
  const u = new URL(r.request().url());
  if (!/supabase\.co/.test(u.host)) return r.abort();
  if (!online) return r.abort('failed');
  return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-allow-origin': '*' }, body: u.pathname.includes('/auth/') ? '{}' : '[]' });
});
const page = await ctx.newPage(); page.on('pageerror', () => {});
await page.goto(BASE);
await page.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 60000 });
await page.locator('#rc27Splash').evaluate(e => e.remove()).catch(() => {});
await page.evaluate(() => {
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  state.user = { id: id(1), email: 'x@example.test' }; state.profile = { id: id(1), role: 'admin', full_name: 'اختبار', active: true, approval_status: 'approved' };
  state.offline = false; state.networkVerified = true; state.v230LastFullLoadAt = Date.now();
  state.halaqas = [{ id: id(10), name: 'حلقة', active: true, halaqa_type: 'regular' }];
  state.students = Array.from({ length: 4 }, (_, i) => ({ id: id(100 + i), full_name: 'طالب ' + i, status: 'active', halaqa_id: id(10), track_code: 'general_hifz', enrollment_date: '2026-01-01', photo_path: null }));
  state.sessions = []; state.page = 'home';
  document.getElementById('auth').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); render(); saveOfflineAuth(state.user); cacheSnapshot();
});
for (const pid of PAGES) { await page.evaluate(p => go(p), pid).catch(() => {}); await page.waitForTimeout(900); }
const saved = await page.evaluate(() => new Promise(res => { const r = indexedDB.open('halaqati-swr-v1'); r.onsuccess = () => { const q = r.result.transaction('e').objectStore('e').count(); q.onsuccess = () => res(q.result); }; r.onerror = () => res(-1); }));
ok(saved > 0, `read answers were saved on the device while online (${saved} rows)`);
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(r => !!(r && r.active)), null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);

online = false; await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(6000);
ok(await page.evaluate(() => !document.getElementById('app').classList.contains('hidden') && state.profile?.role === 'admin'), 'offline reload opens the signed-in app with the saved role');
for (const pid of PAGES) {
  await page.evaluate(p => go(p), pid).catch(() => {}); await page.waitForTimeout(1500);
  const s = await page.evaluate(() => { const c = document.getElementById('content'); const t = (c?.innerText || '').replace(/\s+/g, ' ').trim(); return { len: t.length, skeleton: !!c?.querySelector('.nx-skel,.dn-skel,.skeleton') && t.length < 20 }; });
  ok(s.len > 0 && !s.skeleton, `offline: page "${pid}" shows content (${s.len} chars${s.skeleton ? ', stuck skeleton' : ''})`);
}
online = true; await ctx.setOffline(false);
await page.evaluate(() => { document.getElementById('app').classList.remove('hidden'); });
await page.evaluate(() => HalaqatiSwr.purge(state.user.id));
const left = await page.evaluate(() => new Promise(res => { const r = indexedDB.open('halaqati-swr-v1'); r.onsuccess = () => { const q = r.result.transaction('e').objectStore('e').count(); q.onsuccess = () => res(q.result); }; }));
ok(left === 0, `sign-out purge removes every saved answer of the user (${left} left)`);
await browser.close(); close();
console.log(fails ? `\n${fails} offline-page check(s) FAILED` : '\nOffline-page checks: all passed');
process.exit(fails ? 1 : 0);
