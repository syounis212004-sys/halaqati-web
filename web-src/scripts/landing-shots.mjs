/* Generates the RAW landing-page screenshots from the real web app (fictional isolated data, no network).
   Usage: npm run build (with a local pack in public/dk) && node scripts/landing-shots.mjs [id ...]
   Env: SHOTS_RAW (default .artifacts/landing-raw). Every shot is listed in SHOTS with the role, the page and what it proves. */
import fs from 'node:fs';
import { launch, openAs, idn, fixture } from './landing-shots-lib.mjs';
import { RPC, TABLES } from './landing-shots-data.mjs';
import { pinsOf } from './landing-shots-pins.mjs';

const OUT = process.env.SHOTS_RAW || '.artifacts/landing-raw';
fs.mkdirSync(OUT, { recursive: true });

const today = () => new Date().toISOString().slice(0, 10);
const goto = (page, p) => page.evaluate((p) => go(p), p).then(() => page.waitForTimeout(900));

/* mushaf: same dialog host the real screen uses; the pack in dist/dk is the only real asset */
async function mushaf(page, { initialPage, marks = [], v6, range }) {
  await page.evaluate(([initialPage, v6, range]) => {
    const host = document.createElement('dialog'); host.id = 'mushafHost';
    host.style.cssText = 'width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:var(--dn-page,#fff)';
    document.body.appendChild(host); host.showModal();
    window.__mushafSession = HalaqatiMushafState.createMushafSession({ initialPage });
    HalaqatiMushaf.mount(host, { session: window.__mushafSession, loader: { loadPage: async () => ({ ok: false, error: 'offline' }) }, getRange: () => range, getCounters: () => ({ mistakes: 0, prompts: 0 }), getV6: () => v6, onMark() {} });
  }, [initialPage, v6 || null, range || null]);
  await page.waitForSelector('.hm-dk .hm-word', { timeout: 20000 });
  await page.waitForTimeout(500);
  for (const i of marks) {
    const b = await page.locator('.hm-dk .hm-word').nth(i).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
  await page.waitForTimeout(500);
}

/* ---- in-page state helpers (run inside the app page; fictional data only) ---- */
const rosterState = () => {
  const sid = '00000000-0000-4000-8000-000000000200';
  const st = state.students.filter((s) => s.halaqa_id === state.halaqas[0].id);
  const ev = ['excellent', 'very_good', 'good', 'excellent'];
  state.offlineRosterCache = { [sid]: { attendance: st.map((s, i) => ({ session_id: sid, student_id: s.id, status: i === 3 ? 'absent' : 'present' })), notes: [], recitations: st.slice(0, 3).map((s, i) => ({ id: 'r' + i, session_id: sid, student_id: s.id, activity_type: 'new_hifz', start_surah: 67, start_ayah: 1 + i * 8, end_surah: 67, end_ayah: 9 + i * 8, date: today(), evaluation: ev[i], pages: 1 + (i % 2) * 0.5, mistakes: i, prompts: i ? 1 : 0, safety: 98 - i * 4 })) } };
  return openSessionRoster(sid);
};
const plansState = () => {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  state.smartPlansAvailable = true; state.smartPlanRecitations = [];
  state.smartPlans = state.students.filter((s) => s.halaqa_id === state.halaqas[0].id).map((s, i) => ({ id: 'p' + i, scope_type: 'student', halaqa_id: s.halaqa_id, student_id: s.id, plan_type: i === 3 ? 'review' : 'hifz', title: i === 3 ? 'خطة مراجعة تجريبية' : 'خطة حفظ تجريبية', target_units: 20, target_pages: 20 + i * 2, start_date: d(0), end_date: d(24), schedule_weekdays: [0, 1, 2, 3, 4], catch_up_weekday: 5, max_daily_multiplier: 1.5, auto_extend: true, quality_gate_enabled: true, minimum_evaluation: 'good', milestone_mode: 'juz', milestone_requires_approval: false, delay_alert_days: 3, status: 'active', settings: { minimum_daily_mode: 'dynamic' }, range_start_surah: 67, range_start_ayah: 1, goal_unit: 'pages' }));
  return go('plans');
};
const twoKids = (page) => page.evaluate(() => { state.students = state.students.slice(0, 2); });

export const SHOTS = [
  /* ---- teacher (phone) ---- */
  { id: 'web-teacher-home', role: 'teacher', w: 390, h: 844, run: (p) => goto(p, 'home') },
  { id: 'web-teacher-roster', role: 'teacher', w: 390, h: 844, run: async (p) => { await p.evaluate(rosterState); await p.waitForTimeout(900); } },
  { id: 'web-teacher-plans', role: 'teacher', w: 390, h: 844, run: async (p) => { await p.evaluate(plansState); await p.waitForTimeout(900); } },
  { id: 'web-teacher-students', role: 'teacher', w: 390, h: 844, run: (p) => goto(p, 'students') },
  { id: 'web-teacher-mushaf-page', role: 'teacher', w: 390, h: 844, run: (p) => mushaf(p, { initialPage: 300, marks: [3, 9, 14], v6: { safety: 92, label: 'ممتاز' }, range: { startPage: 299, endPage: 301 } }) },
  { id: 'web-teacher-mushaf-surah', role: 'teacher', w: 390, h: 844, run: (p) => mushaf(p, { initialPage: 511, marks: [5], range: { startPage: 511, endPage: 512 } }) },
  { id: 'web-teacher-mushaf-dark', role: 'teacher', w: 390, h: 844, dark: true, run: (p) => mushaf(p, { initialPage: 187, marks: [2, 6], range: { startPage: 187, endPage: 188 } }) },
  { id: 'web-teacher-home-dark', role: 'teacher', w: 390, h: 844, dark: true, run: (p) => goto(p, 'home') },
  /* ---- admin (desktop) ---- */
  { id: 'web-admin-home', role: 'admin', w: 1440, h: 900, run: (p) => goto(p, 'home') },
  { id: 'web-admin-halaqas', role: 'admin', w: 1440, h: 900, run: (p) => goto(p, 'halaqas') },
  { id: 'web-admin-users', role: 'admin', w: 1440, h: 900, run: (p) => goto(p, 'users') },
  { id: 'web-admin-contests', role: 'admin', w: 1440, h: 900, run: (p) => goto(p, 'contests') },
  { id: 'web-admin-support', role: 'admin', w: 1440, h: 900, run: (p) => goto(p, 'support') },
  { id: 'web-admin-certificates', role: 'admin', w: 1440, h: 900, run: (p) => goto(p, 'certificates') },
  { id: 'web-admin-home-dark', role: 'admin', w: 1440, h: 900, dark: true, run: (p) => goto(p, 'home') },
  /* ---- guardian (phone) ---- */
  { id: 'web-guardian-profile', role: 'guardian', w: 390, h: 844, run: async (p) => { await twoKids(p); await goto(p, 'profile'); } },
  { id: 'web-guardian-ranking', role: 'guardian', w: 390, h: 844, run: async (p) => { await twoKids(p); await goto(p, 'ranking'); } },
  { id: 'web-guardian-contribute', role: 'guardian', w: 390, h: 844, run: (p) => goto(p, 'contribute') },
  { id: 'web-guardian-profile-dark', role: 'guardian', w: 390, h: 844, dark: true, run: async (p) => { await twoKids(p); await goto(p, 'profile'); } },
  /* ---- supervisor / donor (phone) ---- */
  { id: 'web-supervisor-staff', role: 'supervisor', w: 390, h: 844, run: async (p) => { await p.waitForTimeout(1500); await goto(p, 'home'); await goto(p, 'supervision'); await p.waitForTimeout(1200); } },
  { id: 'web-donor-home', role: 'observer', w: 390, h: 844, run: (p) => goto(p, 'home') },
  { id: 'web-donor-support', role: 'observer', w: 390, h: 844, run: (p) => goto(p, 'donor_support') },
];

if (process.argv[1] && process.argv[1].endsWith('landing-shots.mjs')) {
  const want = process.argv.slice(2);
  const { browser, srv } = await launch();
  let bad = 0; const meta = {};
  for (const s of SHOTS.filter((s) => !want.length || want.includes(s.id))) {
    const { ctx, page, errors } = await openAs(browser, srv, { role: s.role, width: s.w, height: s.h, dark: !!s.dark, dsf: s.w >= 1000 ? 1.5 : 2, mock: { rpc: RPC, tables: TABLES, state: s.state } });
    try { await s.run(page); await page.addStyleTag({ content: '#toast,.toast,.banner-offline{display:none!important}' }); meta[s.id] = await pinsOf(page, s.id, s.w, s.h); await page.screenshot({ path: `${OUT}/${s.id}.png` }); console.log('ok  ', s.id, errors.length ? 'errors: ' + errors[0] : ''); } catch (e) { bad++; console.log('FAIL', s.id, e.message.split('\n')[0]); }
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/pins.json`, JSON.stringify(meta, null, 1));
  await browser.close(); srv.close();
  process.exit(bad ? 1 : 0);
}
