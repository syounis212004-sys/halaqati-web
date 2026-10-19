import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseUrl = process.env.HALAQATI_PREVIEW_URL || 'http://127.0.0.1:4173';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.HalaqatiSmartPlansEngine?.version === '2.18.0');
await page.evaluate(() => {
  state.user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.test' };
  state.profile = { id: state.user.id, role: 'admin', full_name: 'مدير الاختبار', active: true, approval_status: 'approved' };
  state.networkVerified = false;
  state.offline = true;
  state.halaqas = [{ id: '22222222-2222-4222-8222-222222222222', name: 'حلقة الإتقان' }];
  state.students = [
    { id: '33333333-3333-4333-8333-333333333333', halaqa_id: state.halaqas[0].id, full_name: 'أحمد محمود', status: 'active', track_code: 'general_hifz' },
    { id: '44444444-4444-4444-8444-444444444444', halaqa_id: state.halaqas[0].id, full_name: 'ليان محمد', status: 'active', track_code: 'general_hifz' },
  ];
  state.sessions = [{ id: '55555555-5555-4555-8555-555555555555', halaqa_id: state.halaqas[0].id, session_date: '2026-08-30', session_type: 'tasmee', title: 'جلسة الأحد', status: 'open' }];
  state.smartPlansAvailable = true;
  state.smartPlans = [{
    id: '66666666-6666-4666-8666-666666666666', scope_type: 'halaqa', halaqa_id: state.halaqas[0].id, student_id: null,
    plan_type: 'hifz', review_tier: 'none', title: 'خطة حفظ الصفحات 221–240', goal_unit: 'pages', target_units: 20, target_pages: 20,
    start_date: '2026-08-01', end_date: '2026-09-30', schedule_weekdays: [0, 1, 2, 3, 4], catch_up_weekday: 4,
    max_daily_multiplier: 1.5, auto_extend: true, quality_gate_enabled: true, minimum_evaluation: 'very_good',
    range_start_page: 221, range_end_page: 240, range_start_surah: 10, range_start_ayah: 107, range_end_surah: 12, range_end_ayah: 52,
    selected_surahs: [], selected_juz: [], selected_rubs: [], near_revision_pages: 7, far_revision_pages: 20,
    milestone_mode: 'juz', milestone_requires_approval: true, delay_alert_days: 3, home_prep_push: true, status: 'active',
    created_by: state.user.id, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', revision: 1,
  }];
  state.smartPlanEvents = [];
  state.smartPlanRecitations = [{
    id: '77777777-7777-4777-8777-777777777777', session_id: state.sessions[0].id, student_id: state.students[0].id,
    activity_type: 'new_hifz', input_method: 'pages', start_page: 221, end_page: 227, pages_count: 7,
    mistakes: 0, prompts: 0, evaluation: 'excellent', selection_data: { mode: 'pages', smart_plan_id: state.smartPlans[0].id },
    sessions: { session_date: '2026-08-29', halaqa_id: state.halaqas[0].id }, created_at: '2026-08-29T12:00:00Z',
  }];
  state.smartPlanTab = 'dashboard';
  state.smartPlanHalaqa = 'all';
  state.offlineRosterCache = { [state.sessions[0].id]: { attendance: [], notes: [], recitations: [] } };
  state.sessionRoster = { attendance: [], notes: [], recitations: [] };
  state.page = 'plans';
  document.querySelector('#auth').classList.add('hidden');
  document.querySelector('#app').classList.remove('hidden');
  render();
});

await page.waitForSelector('.smart-plan-track');
const planText = await page.locator('#content').innerText();
if (!planText.includes('الخطط الذكية v2.17') || !planText.includes('خطة حفظ الصفحات 221–240') || !planText.includes('مطلوب اليوم')) {
  throw new Error('smart plan dashboard did not render expected Arabic content');
}
await page.screenshot({ path: 'artifacts/smart-plans-dashboard.png', fullPage: true });

await page.evaluate(() => openPlan('33333333-3333-4333-8333-333333333333'));
await page.waitForSelector('#smartPlanDlg[open]');
if (await page.locator('#spRangeStart option').count() !== 604) throw new Error('page range selector is incomplete');
await page.locator('#smartPlanDlg .close').click();

await page.evaluate(() => {
  state.page = 'sessions';
  state.sessionView = state.sessions[0].id;
  render();
});
await page.waitForSelector('.smart-session-plan');
const sessionText = await page.locator('#content').innerText();
if (!sessionText.includes('المقرر الذكي اليوم') || !sessionText.includes('تسميع المقرر اليومي')) throw new Error('session smart-plan widget is missing');
await page.screenshot({ path: 'artifacts/smart-plans-session.png', fullPage: true });

await page.getByRole('button', { name: 'تسميع المقرر اليومي' }).first().click();
await page.waitForSelector('#reportDlg[open] .rec-row');
const prefill = await page.locator('#reportDlg .rec-row').last().evaluate(row => ({
  start: row.dataset.startPage,
  end: row.dataset.endPage,
  plan: row.dataset.smartPlanId,
  type: row.querySelector('.rType')?.value,
}));
if (!prefill.start || !prefill.end || prefill.plan !== '66666666-6666-4666-8666-666666666666' || prefill.type !== 'new_hifz') {
  throw new Error(`one-tap prefill failed: ${JSON.stringify(prefill)}`);
}

const relevantErrors = errors.filter(message => !message.includes('favicon') && !message.includes('service worker'));
if (relevantErrors.length) throw new Error(`browser console errors:\n${relevantErrors.join('\n')}`);

await browser.close();
console.log('SMART_PLANS_V216_UI_SMOKE_PASS');

