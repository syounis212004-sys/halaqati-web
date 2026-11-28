import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:4192/');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
});

try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, locale: 'ar', reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(base.href);
    await page.waitForFunction(() => window.NGM && window.NXApprovals && window.usersPage);
    await page.evaluate(async () => {
      const guardian = {
        id: '00000000-0000-4000-8000-000000000001', full_name: 'ولي اختبار',
        role: 'guardian', requested_role: 'guardian', approval_status: 'pending', active: false,
      };
      const request = {
        id: '00000000-0000-4000-8000-000000000002', name: guardian.full_name,
        kind: 'link', role: 'guardian', student: 'طالب اختبار', stage: 'admin',
      };
      state.user = { id: '00000000-0000-4000-8000-000000000003' };
      state.profile = { ...state.user, role: 'admin', approval_status: 'approved', active: true };
      state.users = [guardian];
      state.networkVerified = true;
      state.offline = false;
      state.page = 'users';
      window.fixtureReviewCalls = [];
      window.fixtureReviewResult = null;
      window.fixtureProfileWrites = 0;
      window.fixtureReviewHook = async (route) => {
        state.page = route;
        await NXApprovals.load();
      };
      go = window.fixtureReviewHook;
      db.from = (table) => {
        const query = {
          select: () => query, order: () => query, range: () => query, eq: () => query,
          update: () => {
            window.fixtureProfileWrites++;
            return query;
          },
          then: (resolve, reject) => Promise.resolve({
            data: table === 'profiles' ? [guardian] : [], error: null,
          }).then(resolve, reject),
        };
        return query;
      };
      db.rpc = async (name, args) => {
        if (name === 'rc_pending_requests') return { data: [request], error: null };
        if (name === 'rc_review_request') {
          window.fixtureReviewCalls.push(args);
          return { data: window.fixtureReviewResult, error: null };
        }
        return { data: [], error: null };
      };
      db.functions.invoke = async () => ({ data: null, error: null });
      document.getElementById('auth').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('rc27Splash')?.remove();
      document.getElementById('content').innerHTML = await window.usersPage();
    });

    if (width < 600) await page.locator('#content .ngm-phone summary').first().click();
    const content = page.locator('#content');
    const visibleReviewLink = content.getByRole('button', { name: 'طلبات الربط', exact: true }).filter({ visible: true });
    await visibleReviewLink.click();
    await content.getByRole('button', { name: 'تأكيد وربط', exact: true }).click();
    await content.getByText('تعذر تنفيذ العملية', { exact: true }).waitFor();
    await page.evaluate(() => { window.fixtureReviewResult = { ok: true }; });
    await content.getByRole('button', { name: 'تأكيد وربط', exact: true }).click();
    await content.getByText('تمت الموافقة على طلب ولي اختبار', { exact: true }).waitFor();
    const result = await page.evaluate(() => ({
      writes: window.fixtureProfileWrites,
      calls: window.fixtureReviewCalls,
      route: state.page,
    }));
    assert.equal(result.writes, 0);
    assert.equal(result.route, 'approvals');
    assert.equal(result.calls.length, 2);
    assert.ok(result.calls.every(({ p_kind, p_action, p_id }) =>
      p_kind === 'link' && p_action === 'approve' && p_id.endsWith('0002')));
    console.log(`PASS ${width}px: account routes to link review; malformed response cannot report success`);
    const opened = await page.evaluate(async () => {
      const date = today();
      const student = { id: 'student-fixture', halaqa_id: 'primary-fixture', status: 'active' };
      const sessions = [
        { id: 'regular-session', halaqa_id: 'primary-fixture', session_date: date, status: 'open', session_type: 'tasmee' },
        { id: 'program-session', halaqa_id: 'program-fixture', session_date: date, status: 'open', session_type: 'tilawah' },
      ];
      const opened = [];
      openDailyForStudent = async (id, session) => opened.push([id, session]);
      state.students = [student];
      state.sessions = sessions;
      state.studentHalaqa = 'program-fixture';
      window.RC27.memberships = [{ student_id: student.id, halaqa_id: 'program-fixture', status: 'active' }];
      await window.NSS.recite(student.id);
      state.sessions = sessions.slice(0, 1);
      await window.NSS.recite(student.id);
      return opened;
    });
    assert.deepEqual(opened, [['student-fixture', 'program-session']]);
    console.log(`PASS ${width}px: recitation opens the selected program; no fallback into another scope`);
    await page.evaluate(async () => {
      state.page = 'sessions';
      state.sessionView = 'regular-session';
      state.sessionRoster = { attendance: [], notes: [], recitations: [] };
      window.fixtureAttendanceWrites = 0;
      window.NSR.load = async () => {};
      localAttendanceSave = () => { window.fixtureAttendanceWrites++; };
      await render();
      window.NSR.closeConfirm();
    });
    await page.getByText('عدد الطلاب الذين لم يُرصد حضورهم: 1. ستبقى حالتهم غير مرصودة.', { exact: true }).waitFor();
    const exitButton = page.locator('#nrSumDlg').getByRole('button', { name: 'خروج', exact: true });
    await exitButton.click();
    await page.waitForFunction(() => state.sessionView === null, null, { timeout: 8000 });
    const exit = await page.evaluate(() => ({ session: state.sessionView, writes: window.fixtureAttendanceWrites }));
    assert.equal(exit.session, null);
    await page.locator('#nrRoster').waitFor({ state: 'hidden' });
    assert.equal(exit.writes, 0);
    console.log(`PASS ${width}px: exiting an unobserved roster writes no automatic absence`);
    await context.close();
  }
} finally {
  await browser.close();
}
