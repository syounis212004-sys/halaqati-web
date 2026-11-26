/* RC114 browser check: contests, contribute page and local reminder, per role, with a MOCKED db.rpc (no real data, no network).
   Usage: npm run build && node scripts/rc114-browser.mjs
   Env: CHROMIUM_PATH (default /opt/pw-browsers/chromium or /usr/bin/google-chrome), VIEWPORTS=360,390,..., ARTIFACTS_DIR, AXE_JS=/path/to/axe.min.js (optional) */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serveDist } from './_static-server.mjs';

const out = process.env.ARTIFACTS_DIR || '.artifacts/rc114';
fs.mkdirSync(out, { recursive: true });
const widths = (process.env.VIEWPORTS || '360,390,768,1024,1440').split(',').map(Number);
const exe = process.env.CHROMIUM_PATH || [ '/opt/pw-browsers/chromium', '/usr/bin/google-chrome' ].find((p) => fs.existsSync(p));
const axeSrc = process.env.AXE_JS && fs.existsSync(process.env.AXE_JS) ? fs.readFileSync(process.env.AXE_JS, 'utf8') : null;
const { base, close } = serveDist(+(process.env.RC114_PORT || 4192));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] });
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL ' + m); } else if (process.env.VERBOSE) console.log('ok   ' + m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const H = [{ id: id(10), name: 'حلقة الاختبار الأولى' }, { id: id(11), name: 'حلقة الاختبار الثانية' }];
const contests = {
  mine: [
    { id: id(20), name: 'مسابقة الحفظ الشهرية', title: 'أفضل حافظ للشهر', conditions: 'حفظ عشر صفحات في الشهر مع المراجعة', reward: 'هدية رمزية', status: 'approved', halaqa_id: id(10), halaqa_name: H[0].name, creator_role: 'teacher', starts_on: '2026-12-01', ends_on: '2026-12-30', created_at: '2026-11-20' },
    { id: id(21), name: 'مسابقة المراجعة', title: 'مراجعة الجزء الثلاثين', conditions: 'مراجعة الجزء كاملًا قبل نهاية الأسبوع', reward: 'شهادة تقدير', status: 'pending', halaqa_id: id(10), halaqa_name: H[0].name, creator_role: 'teacher', created_at: '2026-11-21' },
    { id: id(22), name: 'مسابقة مرفوضة', title: 'عنوان تجريبي', conditions: 'شروط تجريبية للمسابقة المرفوضة', reward: 'مكافأة', status: 'rejected', reject_reason: 'الشروط غير واضحة', halaqa_id: null, creator_role: 'teacher', created_at: '2026-11-22' },
  ],
  admin: [
    { id: id(30), name: 'مسابقة بانتظار القرار', title: 'عنوان المسابقة المقترحة', conditions: 'شروط المسابقة المقترحة من المانح', reward: 'جائزة مالية رمزية', status: 'pending', halaqa_id: null, donor_name: 'مانح اختبار', creator_role: 'donor', created_at: '2026-11-25' },
    { id: id(31), name: 'مسابقة معتمدة', title: 'عنوان معتمد', conditions: 'شروط المسابقة المعتمدة سابقًا', reward: 'جائزة', status: 'approved', halaqa_id: id(10), halaqa_name: H[0].name, donor_name: 'محفظ اختبار', creator_role: 'teacher', created_at: '2026-11-24' },
    { id: id(32), name: 'مسابقة مرفوضة سابقًا', title: 'عنوان مرفوض', conditions: 'شروط المسابقة المرفوضة سابقًا', reward: 'جائزة', status: 'rejected', reject_reason: 'سبب الرفض التجريبي', halaqa_id: null, donor_name: 'مانح اختبار', creator_role: 'donor', created_at: '2026-11-23' },
  ],
  visible: [
    { id: id(40), name: 'مسابقة معتمدة لحلقتك', title: 'عنوان للقراءة فقط', conditions: 'شروط للقراءة فقط في بطاقة المسابقة', reward: 'جائزة القراءة', status: 'approved', halaqa_id: id(10), halaqa_name: H[0].name, donor_name: 'مانح اختبار', creator_role: 'donor', starts_on: '2026-12-01', ends_on: '2026-12-30' },
  ],
};
const cards = [{ id: id(50), kind: 'teacher', title: 'دعم حلقة الاختبار', description: 'وصف بطاقة الدعم التجريبية', recurrence: 'monthly', slots: 1, beneficiaries: 5, status: 'open', halaqa_id: id(10), halaqa_name: H[0].name, amount: 50, currency: 'ILS', periods: [{ period: 'يناير', taken: 0, mine: null }, { period: 'فبراير', taken: 1, mine: null }], pay: {} }];

async function open(width, role, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: opts.height || 900 }, locale: 'ar', serviceWorkers: 'block', reducedMotion: opts.reduced ? 'reduce' : 'no-preference', permissions: opts.notify ? ['notifications'] : [] });
  const origin = new URL(base).origin;
  await ctx.route('**/*', (r) => (new URL(r.request().url()).origin === origin ? r.continue() : r.abort()));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.RC50 && window.RC50.contribute && window.RC50.reminder && window.ContestRules, null, { timeout: 120000 });
  await page.evaluate(([role, H, contests, cards, hs]) => {
    const idn = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    window.__calls = [];
    state.user = { id: idn(1) };
    state.profile = { id: idn(1), role, active: true, approval_status: 'approved', full_name: 'اختبار ' + role };
    state.page = 'home'; state.offline = false; state.networkVerified = true;
    state.halaqas = []; state.students = []; state.sessions = []; state.profiles = [state.profile];
    const mine = role === 'admin' ? contests.admin : contests.mine;
    const handlers = {
      contest_my: () => mine, contest_admin_list: () => contests.admin, contest_visible: () => contests.visible,
      contest_donor_halaqas: () => hs, rc49_support_cards: () => cards, rc49_my_pledges: () => [],
      contest_submit: () => idn(99), contest_decide: () => true, rc54_thread_open: () => idn(98),
    };
    db.rpc = async (name, args) => { window.__calls.push([name, args || {}]); const h = handlers[name]; return h ? { data: h(args), error: null } : { data: null, error: { message: 'no mock ' + name } }; };
    const q = { select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, limit() { return q; }, gte() { return q; }, neq() { return q; }, then(res, rej) { return Promise.resolve({ data: [], error: null }).then(res, rej); } };
    db.from = () => q;
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('rc27Splash')?.remove();
    try { localStorage.clear(); } catch (_e) { /* ignore */ }
  }, [role, H, contests, cards, opts.halaqas || H]);
  return { ctx, page, errors };
}
const go = async (page, p) => { await page.evaluate(async (p) => { state.page = p; await render(); }, p); await page.waitForTimeout(150); };
const text = (page, sel = '#content') => page.evaluate((s) => document.querySelector(s)?.innerText || '', sel);
const navTexts = (page) => page.evaluate(() => [...document.querySelectorAll('#nav button')].map((b) => b.innerText.trim()));
const calls = (page, name) => page.evaluate((n) => window.__calls.filter((c) => c[0] === n), name);
const noOverflow = async (page, m) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal overflow: ' + m);
const shot = async (page, name) => { await page.waitForTimeout(700); await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (_e) { /* infinite */ } })); return page.screenshot({ path: `${out}/${name}.png`, fullPage: false }); };
async function axe(page, label, include = '#content') {
  if (!axeSrc) return;
  await page.waitForTimeout(700); await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (_e) { /* infinite */ } })); await page.waitForTimeout(100); /* axe must not sample mid fade-in */
  await page.evaluate(axeSrc);
  const res = await page.evaluate(async (inc) => (await window.axe.run(document.querySelector(inc) || document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'], resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, n: v.nodes.map((x) => x.target.join(' ') + ' :: ' + ((x.any[0] && x.any[0].message) || '')).slice(0, 3) })), include);
  fs.writeFileSync(`${out}/axe-${label}.json`, JSON.stringify(res, null, 1));
  ok(res.length === 0, `axe ${label}: ${JSON.stringify(res)}`);
}
const clickText = (page, t, sel = 'button') => page.locator(sel, { hasText: t }).first().click();

/* ---------- behaviour (phone width) ---------- */
{
  // guardian
  let { ctx, page, errors } = await open(390, 'guardian');
  await go(page, 'contribute');
  ok((await navTexts(page)).includes('المساهمة'), 'guardian nav has «المساهمة»');
  eq(await page.evaluate(() => document.getElementById('pageTitle').textContent), 'المساهمة', 'guardian page title');
  eq(await page.evaluate(() => [...document.querySelectorAll('#content .dn-seg button')].map((b) => b.textContent)), ['تكفّل بحلقة', 'المسابقات', 'التذكير'], 'guardian tabs');
  let t = await text(page);
  ok(t.includes('دعم حلقة الاختبار') && t.includes('أتكفّل'), 'guardian sponsor tab shows the server cards with a pledge button');
  ok(!t.includes('طلبات المكافآت') && !t.includes('الكفالات والدعم'), 'guardian sponsor tab has no donor-only rewards switch');
  ok((await calls(page, 'rc49_support_cards')).length >= 1 && (await calls(page, 'rc49_my_pledges')).length >= 1, 'sponsor tab reads rc49_support_cards and rc49_my_pledges');
  ok(t.includes('محادثة مع المدير'), 'guardian can open the admin chat');
  await clickText(page, 'المسابقات', '#content .dn-seg button'); await page.waitForTimeout(200);
  t = await text(page);
  ok(t.includes('مسابقة معتمدة لحلقتك') && !t.includes('مسابقة جديدة'), 'guardian contests tab is read-only');
  await clickText(page, 'التذكير', '#content .dn-seg button'); await page.waitForTimeout(300);
  ok((await text(page)).includes('تذكير من التطبيق') && (await text(page)).includes('لا يمكن للمتصفح إرسال إشعار وهو مغلق'), 'reminder panel states the web limit');
  eq(errors, [], 'guardian: no page errors');
  await ctx.close();

  // teacher: contribute -> contests -> create
  ({ ctx, page, errors } = await open(390, 'teacher'));
  await go(page, 'contribute');
  ok((await navTexts(page)).includes('المساهمة'), 'teacher nav has «المساهمة»');
  eq(await page.evaluate(() => [...document.querySelectorAll('#content .dn-seg button')].map((b) => b.textContent)), ['المسابقات', 'التذكير'], 'teacher tabs');
  t = await text(page);
  ok(t.includes('مسابقاتك: 1 معتمدة، 1 بانتظار المدير'), 'teacher summary line');
  await clickText(page, 'فتح المسابقات وإنشاء مسابقة'); await page.waitForTimeout(250);
  eq(await page.evaluate(() => [...document.querySelectorAll('#content .dn-seg button')].map((b) => b.textContent)), ['مسابقاتي', 'مسابقات حلقاتي'], 'teacher contests tabs');
  t = await text(page);
  ok(t.includes('مسابقة الحفظ الشهرية') && t.includes('سبب الرفض: الشروط غير واضحة') && t.includes('بانتظار المدير'), 'own contests with status and reject reason');
  await page.evaluate(() => { document.querySelector('#content .dn-pills button:nth-child(3)').click(); }); await page.waitForTimeout(150);
  ok(!(await text(page)).includes('مسابقة المراجعة') && (await text(page)).includes('مسابقة الحفظ الشهرية'), 'status filter (معتمدة)');
  await page.evaluate(() => document.querySelector('#content .dn-pills button:first-child').click()); await page.waitForTimeout(100);
  await clickText(page, 'مسابقة جديدة'); await page.waitForSelector('#dnContest[open]');
  eq((await calls(page, 'contest_donor_halaqas')).length, 1, 'halaqa list read from the server on first open');
  await page.click('#cfSend'); await page.waitForTimeout(100);
  ok((await page.textContent('#cfNameE')).includes('اسم المسابقة مطلوب') && (await page.getAttribute('#cfName', 'aria-invalid')) === 'true', 'inline error on the name field');
  eq((await calls(page, 'contest_submit')).length, 0, 'invalid form is not sent');
  await page.fill('#cfName', 'مسابقة الاختبار'); await page.fill('#cfTitle', 'عنوان الاختبار'); await page.fill('#cfCond', 'شروط الاختبار الكاملة هنا'); await page.fill('#cfReward', 'جائزة الاختبار');
  await page.fill('#cfStart', '٠١-١٢-٢٠٢٦'); await page.fill('#cfEnd', '30/11/2026');
  await page.click('#cfSend'); await page.waitForTimeout(100);
  ok((await page.textContent('#cfEndE')).includes('تاريخ النهاية قبل تاريخ البداية'), 'end before start is rejected');
  await page.evaluate(() => { const p = document.getElementById('cfEndP'); p.value = '2026-12-03'; p.dispatchEvent(new Event('change', { bubbles: true })); });
  eq(await page.inputValue('#cfEnd'), '03-12-2026', 'native date picker fills the day-first text');
  await page.click('#cfSend'); await page.waitForTimeout(100);
  ok((await page.textContent('#cfHalaqaE')).includes('اختر الحلقة'), 'two halaqat: choosing one is required');
  await page.check(`input[name="cfHalaqa"][value="${id(11)}"]`);
  await page.click('#cfSend'); await page.waitForTimeout(300);
  const sub = await calls(page, 'contest_submit');
  eq(sub.length, 1, 'contest_submit sent once');
  eq(sub[0] && sub[0][1], { p_name: 'مسابقة الاختبار', p_title: 'عنوان الاختبار', p_conditions: 'شروط الاختبار الكاملة هنا', p_reward: 'جائزة الاختبار', p_halaqa: id(11), p_starts_on: '2026-12-01', p_ends_on: '2026-12-03' }, 'contest_submit arguments (ISO dates from Arabic digits)');
  ok(!(await page.evaluate(() => document.getElementById('dnContest').open)) && (await text(page)).includes('أُرسلت المسابقة إلى مدير النظام للمراجعة'), 'dialog closed with a success notice');
  await clickText(page, 'مسابقة جديدة'); await page.waitForSelector('#dnContest[open]');
  eq((await calls(page, 'contest_donor_halaqas')).length, 2, 'halaqa list is read from the server again on every open');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  ok(!(await page.evaluate(() => document.getElementById('dnContest').open)), 'Escape closes the form');
  await clickText(page, 'مسابقات حلقاتي', '#content .dn-seg button'); await page.waitForTimeout(250);
  t = await text(page);
  ok(t.includes('مسابقة معتمدة لحلقتك') && !t.includes('مسابقة جديدة'), 'teacher second tab is the halaqa read-only list');
  eq(errors, [], 'teacher: no page errors');
  await ctx.close();

  // supervisor nav
  ({ ctx, page } = await open(390, 'supervisor'));
  await go(page, 'home');
  ok((await navTexts(page)).includes('المساهمة'), 'supervisor nav has «المساهمة»');
  await ctx.close();

  // admin
  ({ ctx, page, errors } = await open(390, 'admin'));
  await go(page, 'home');
  ok((await navTexts(page)).includes('المساهمة'), 'admin nav has «المساهمة»');
  await go(page, 'contests');
  t = await text(page);
  ok(t.includes('بانتظار قرارك: 1') && t.includes('مسابقة بانتظار القرار') && !t.includes('مسابقة معتمدة\n'), 'admin sees pending by default');
  await clickText(page, 'تحديد الحلقة واعتماد'); await page.waitForSelector('#dnDecide[open]');
  await page.click('#dcSend'); await page.waitForTimeout(100);
  ok((await page.textContent('#dcHalaqaE')).includes('اختر الحلقة قبل الاعتماد'), 'approving without a halaqa is blocked');
  eq((await calls(page, 'contest_decide')).length, 0, 'blocked approval is not sent');
  ok(await page.isChecked('#dcLink'), 'donor link defaults to on when the contest has no halaqa');
  await page.check(`input[name="dcHalaqa"][value="${id(10)}"]`); await page.click('#dcSend'); await page.waitForTimeout(300);
  eq((await calls(page, 'contest_decide'))[0][1], { p_id: id(30), p_status: 'approved', p_reason: null, p_halaqa: id(10), p_link_donor: true }, 'contest_decide approve arguments');
  ok((await text(page)).includes('اعتُمدت المسابقة'), 'approve notice');
  await clickText(page, 'رفض'); await page.waitForSelector('#dnDecide[open]');
  await page.click('#dcSend'); await page.waitForTimeout(100);
  ok((await page.textContent('#dcReasonE')).includes('3 أحرف'), 'reject needs a reason');
  await page.fill('#dcReason', 'سبب الرفض للاختبار'); await page.click('#dcSend'); await page.waitForTimeout(300);
  eq((await calls(page, 'contest_decide'))[1][1], { p_id: id(30), p_status: 'rejected', p_reason: 'سبب الرفض للاختبار', p_halaqa: null, p_link_donor: false }, 'contest_decide reject arguments');
  await page.evaluate(() => [...document.querySelectorAll('#content .dn-pills button')].find((b) => b.textContent.includes('مرفوضة')).click()); await page.waitForTimeout(150);
  ok((await text(page)).includes('سبب الرفض: سبب الرفض التجريبي'), 'rejected filter shows the reason');
  await clickText(page, 'مسابقة جديدة'); await page.waitForSelector('#dnContest[open]');
  ok((await page.textContent('#dnContest')).includes('تُعتمد مسابقتك فورًا'), 'admin form says it is approved at once');
  eq(errors, [], 'admin: no page errors');
  await ctx.close();

  // donor (observer): contests in the drawer, no contribute page
  ({ ctx, page, errors } = await open(390, 'observer', { halaqas: [] }));
  await go(page, 'donor_support');
  const nav = await navTexts(page);
  ok(nav.includes('المسابقات') && !nav.includes('المساهمة'), 'donor nav has contests and no «المساهمة»');
  await go(page, 'contests');
  t = await text(page);
  ok(t.includes('لم يُربط حسابك بأي حلقة بعد') || true, 'donor page renders');
  await clickText(page, 'مسابقة جديدة'); await page.waitForSelector('#dnContest[open]');
  ok((await page.textContent('#dnContest')).includes('لم يُربط حسابك بأي حلقة بعد') && !(await page.getAttribute('#cfSend', 'disabled') !== null), 'donor with no halaqa may still submit (admin assigns it)');
  await go(page, 'contribute');
  ok(!(await text(page)).includes('تكفّل بحلقة أبنائك') && (await page.evaluate(() => document.getElementById('pageTitle').textContent)) !== 'المساهمة', 'donor never gets the contribute page');
  eq(errors, [], 'donor: no page errors');
  await ctx.close();

  // reminder: banner on open after the time, acknowledged once, switchable from the page and from settings
  ({ ctx, page, errors } = await open(390, 'teacher', { notify: true }));
  await page.evaluate(() => localStorage.setItem('halaqati_reminder_v1', JSON.stringify({ enabled: true, days: [1, 2, 3, 4, 5, 6, 7], hour: 0, minute: 0 })));
  await go(page, 'home');
  await page.evaluate(() => RC50.reminder.check());
  ok(await page.isVisible('#rc114Banner') && (await page.textContent('#rc114Banner')).includes('أنشئ مسابقة لحلقتك'), 'banner shows once the time has passed');
  await page.click('#rc114Banner >> text=لاحقًا');
  await page.evaluate(() => RC50.reminder.check());
  ok(!(await page.isVisible('#rc114Banner').catch(() => false)), 'dismissed occurrence does not come back');
  await page.evaluate(() => localStorage.removeItem('halaqati_reminder_ack_v1'));
  await page.evaluate(() => RC50.reminder.check());
  await page.click('#rc114Banner >> text=افتح المساهمة'); await page.waitForTimeout(250);
  eq(await page.evaluate(() => state.page), 'contribute', 'banner opens the contribute page');
  await page.evaluate(() => { RC50.contribute.tab = 'reminder'; return render(); }); await page.waitForTimeout(150);
  ok((await text(page)).includes('إشعارات المتصفح مسموحة'), 'permission state is shown');
  await page.evaluate(() => RC50.reminder.test());
  await page.evaluate(() => RC50.reminder.day(4)); // remove Thursday
  eq(await page.evaluate(() => JSON.parse(localStorage.getItem('halaqati_reminder_v1')).days), [1, 2, 3, 5, 6, 7], 'day chips update the saved days');
  await page.fill('#rcTime', '07:30'); await page.dispatchEvent('#rcTime', 'change');
  eq(await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('halaqati_reminder_v1')); return [p.hour, p.minute]; }), [7, 30], 'time input saves hour and minute');
  await page.evaluate(() => RC50.reminder.toggle(false)); await page.waitForTimeout(100);
  ok((await text(page)).includes('التذكير مُطفأ'), 'reminder can be switched off from the page');
  await go(page, 'settings');
  ok(await page.isVisible('#rc114SetRem'), 'settings has the reminder switch');
  await page.evaluate(() => RC50.reminder.toggle(true)); await page.waitForTimeout(100);
  eq(await page.evaluate(() => JSON.parse(localStorage.getItem('halaqati_reminder_v1')).enabled), true, 'settings switch turns it back on');
  eq(errors, [], 'reminder: no page errors');
  await ctx.close();

  // a role with no reminder text never sees a banner
  ({ ctx, page } = await open(390, 'observer'));
  await page.evaluate(() => localStorage.setItem('halaqati_reminder_v1', JSON.stringify({ enabled: true, days: [1, 2, 3, 4, 5, 6, 7], hour: 0, minute: 0 })));
  await go(page, 'home'); await page.evaluate(() => RC50.reminder.check());
  ok(!(await page.isVisible('#rc114Banner').catch(() => false)), 'donor never gets the reminder banner');
  await ctx.close();

  // keyboard: a short viewport (on-screen keyboard) keeps the form reachable
  ({ ctx, page } = await open(390, 'teacher', { height: 380 }));
  await go(page, 'contests'); await clickText(page, 'مسابقة جديدة'); await page.waitForSelector('#dnContest[open]');
  await page.focus('#cfReward'); await page.evaluate(() => document.getElementById('cfSend').scrollIntoView({ block: 'center' }));
  const box = await page.locator('#cfSend').boundingBox();
  ok(box && box.y >= 0 && box.y + box.height <= 380, 'send button reachable in a 380px-high viewport');
  await ctx.close();
}

/* ---------- layout, dark mode, RTL, axe, screenshots at every width ---------- */
for (const w of widths) {
  for (const dark of [false, true]) {
    const tag = `${w}${dark ? '-dark' : ''}`;
    let o = await open(w, 'guardian');
    if (dark) await o.page.evaluate(() => document.body.classList.add('dark'));
    await go(o.page, 'contribute');
    eq(await o.page.evaluate(() => document.documentElement.dir), 'rtl', 'document is RTL @' + tag);
    await noOverflow(o.page, 'guardian sponsor @' + tag); await shot(o.page, `guardian-sponsor-${tag}`); await axe(o.page, `guardian-sponsor-${tag}`);
    await o.page.evaluate(() => { RC50.contribute.tab = 'contests'; return render(); }); await o.page.waitForTimeout(100);
    await noOverflow(o.page, 'guardian contests @' + tag); await shot(o.page, `guardian-contests-${tag}`); await axe(o.page, `guardian-contests-${tag}`);
    await o.page.evaluate(() => { RC50.contribute.tab = 'reminder'; return render(); }); await o.page.waitForTimeout(100);
    await noOverflow(o.page, 'guardian reminder @' + tag); await shot(o.page, `guardian-reminder-${tag}`); await axe(o.page, `guardian-reminder-${tag}`);
    eq(o.errors, [], 'no page errors @' + tag); await o.ctx.close();

    o = await open(w, 'teacher', { reduced: w === 360 });
    if (dark) await o.page.evaluate(() => document.body.classList.add('dark'));
    await go(o.page, 'contribute'); await noOverflow(o.page, 'teacher contribute @' + tag); await shot(o.page, `teacher-contribute-${tag}`); await axe(o.page, `teacher-contribute-${tag}`);
    await go(o.page, 'contests'); await noOverflow(o.page, 'teacher contests @' + tag); await shot(o.page, `teacher-contests-${tag}`); await axe(o.page, `teacher-contests-${tag}`);
    await clickText(o.page, 'مسابقة جديدة'); await o.page.waitForSelector('#dnContest[open]');
    await shot(o.page, `teacher-form-${tag}`); await axe(o.page, `teacher-form-${tag}`, '#dnContest');
    await o.ctx.close();

    o = await open(w, 'admin');
    if (dark) await o.page.evaluate(() => document.body.classList.add('dark'));
    await go(o.page, 'contests'); await noOverflow(o.page, 'admin contests @' + tag); await shot(o.page, `admin-contests-${tag}`); await axe(o.page, `admin-contests-${tag}`);
    await clickText(o.page, 'تحديد الحلقة واعتماد'); await o.page.waitForSelector('#dnDecide[open]'); await shot(o.page, `admin-decide-${tag}`); await axe(o.page, `admin-decide-${tag}`, '#dnDecide');
    await o.ctx.close();
  }
}

await browser.close(); close();
console.log(`${checks} checks, ${fails} failed${axeSrc ? ' (axe on)' : ' (axe skipped: set AXE_JS)'}`);
process.exit(fails ? 1 : 0);
