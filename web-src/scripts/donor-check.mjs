/* Donor home: tathbit pages are shown as their own tile, never inside "review". Mocks rc49_donor_report. */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const rep = { students: 51, sessions: 16, hifz_pages: 556, review_pages: 0, tathbit_pages: 91.67, attendance_pct: 82, winners: 0 };
await ctx.route(/https:\/\//, async r => { const u = new URL(r.request().url()); if (!/supabase\.co/.test(u.host)) return r.abort();
  const body = /rc49_donor_report/.test(u.pathname) ? JSON.stringify(rep) : '[]';
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body }).catch(() => {}); });
const p = await ctx.newPage(); await p.goto(BASE);
await p.waitForFunction(() => !!window.HalaqatiCertificates && window.__hmRender, null, { timeout: 45000 });
await p.evaluate(() => { const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`; state.user = { id: id(1) }; state.profile = { id: id(1), role: 'observer', full_name: 'مانح', active: true, approval_status: 'approved' }; state.offline = false; state.networkVerified = true; state.halaqas = []; state.students = []; state.sessions = []; document.getElementById('auth').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); state.page = 'home'; render(); });
await p.waitForFunction(() => /صفحة حفظ/.test(document.getElementById('content').innerText), null, { timeout: 15000 });
const tiles = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.dn-tile')].map(t => { const l = t.innerText.split('\n').map(x => x.trim()).filter(Boolean); return [l[1], l[0]]; })));
const ok = tiles['صفحة مراجعة'] === '0' && /91/.test(tiles['صفحة تثبيت'] || '') && tiles['صفحة حفظ'] === '556';
console.log(ok ? 'PASS D1 donor home: review 0, tathbit 91.7 shown separately' : 'FAIL D1 ' + JSON.stringify(tiles)); if (!ok) process.exitCode = 1;
await b.close();
