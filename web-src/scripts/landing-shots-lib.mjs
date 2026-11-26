/* Shared helpers for generating landing-page screenshots from the REAL web app with fictional, isolated data.
   Nothing here talks to a network: db.rpc/db.from are replaced in the page and every cross-origin request is aborted. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serveDist } from './_static-server.mjs';

export const idn = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const today = () => new Date().toISOString().slice(0, 10);
const AR_NAMES =['طالب تجريبي', 'طالبة تجريبية'];


/* ---- fictional dataset: names are labels like "طالب تجريبي 3"; numbers are illustrative ---- */
export function fixture() {
  const halaqas = [
    { id: idn(10), name: 'حلقة تجريبية (أ)', active: true, halaqa_type: 'regular' },
    { id: idn(11), name: 'حلقة تجريبية (ب)', active: true, halaqa_type: 'regular' },
    { id: idn(12), name: 'حلقة تجريبية (ج)', active: true, halaqa_type: 'regular' },
  ];
  const students = Array.from({ length: 12 }, (_, i) => ({
    id: idn(100 + i), full_name: `${AR_NAMES[i % 2]} ${i + 1}`, status: 'active', halaqa_id: halaqas[i % 3].id,
    track_code: 'general_hifz', enrollment_date: '2026-01-01', gender: i % 2 ? 'female' : 'male',
  }));
  const sessions = [
    { id: idn(200), halaqa_id: halaqas[0].id, session_date: today(), session_type: 'tasmee', status: 'open', title: 'جلسة اليوم', activity_data: {} },
    { id: idn(201), halaqa_id: halaqas[1].id, session_date: today(), session_type: 'tasmee', status: 'closed', title: 'جلسة تجريبية', activity_data: {} },
  ];
  return { halaqas, students, sessions };
}

export async function launch() {
  const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
  const srv = serveDist(+(process.env.SHOTS_PORT || 4194));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
  return { browser, srv };
}

/* open the app as a fictional user of `role`; `extra(state)` may enrich the page state before the first render */
export async function openAs(browser, srv, { role, width, height, dark = false, dsf = 2, data = fixture(), mock = {} }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, locale: 'ar', serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
  const origin = new URL(srv.base).origin;
  await ctx.route('**/*', (r) => (new URL(r.request().url()).origin === origin ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(srv.base);
  await page.waitForFunction(() => window.RC50 && window.HalaqatiMushaf && window.go, null, { timeout: 120000 });
  await page.evaluate(([role, data, dark, mock]) => {
    const idn = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    try { localStorage.clear(); localStorage.setItem('halaqati_theme_v4', JSON.stringify({ dark })); } catch (_e) { /* ignore */ }
    window.__calls = [];
    state.user = { id: idn(1), email: 'demo@example.invalid' };
    state.profile = { id: idn(1), role, active: true, approval_status: 'approved', full_name: ({ admin: 'مدير تجريبي', teacher: 'محفّظ تجريبي', supervisor: 'مشرف تجريبي', guardian: 'ولي أمر تجريبي', donor: 'مانح تجريبي' })[role] };
    state.page = 'home'; state.offline = false; state.networkVerified = true; state.demo = true;
    state.halaqas = data.halaqas; state.students = data.students; state.sessions = data.sessions; state.profiles = [state.profile];
    Object.assign(state, mock.state || {});
    const tables = mock.tables || {};
    /* one query object per db.from() call: concurrent queries must not share the table name */
    const makeQ = (t) => {
      const q = {}, f = [];
      for (const m of ['select', 'order', 'limit', 'is', 'or', 'single', 'maybeSingle', 'not', 'like', 'ilike', 'range']) q[m] = () => q;
      q.eq = (c, v) => { f.push((r) => r[c] === v); return q; };
      q.neq = (c, v) => { f.push((r) => r[c] !== v); return q; };
      q.in = (c, v) => { f.push((r) => v.includes(r[c])); return q; };
      q.gte = (c, v) => { f.push((r) => String(r[c]) >= String(v)); return q; };
      q.lte = (c, v) => { f.push((r) => String(r[c]) <= String(v)); return q; };
      q.then = (res, rej) => Promise.resolve({ data: (tables[t] || []).filter((r) => f.every((x) => x(r))), error: null }).then(res, rej);
      return q;
    };
    db.from = (t) => makeQ(t);
    const handlers = mock.rpc || {};
    db.rpc = async (name, args) => { window.__calls.push(name); const h = handlers[name]; return h !== undefined ? { data: typeof h === 'function' ? h(args) : h, error: null } : { data: null, error: { message: 'no mock ' + name } }; };
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('rc27Splash')?.remove();
    if (dark) document.body.classList.add('dark');
    window.__banner = () => document.querySelectorAll('.banner,.toast.show').length;
  }, [role, data, dark, mock]);
  return { ctx, page, errors };
}
