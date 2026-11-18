/* Measurements behind the loading / motion report. Mocks only the network (every https request is counted and answered with [] after a delay). */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL||'http://127.0.0.1:5173/', DELAY = +(process.env.DELAY || 700);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });

async function open(role = 'admin', width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', hasTouch: true, isMobile: true });
  const log = [];
  await context.route(/https:\/\//, async r => {
    const u = new URL(r.request().url());
    if (!/supabase\.co/.test(u.host)) return r.abort();
    log.push({ t: Date.now(), m: r.request().method(), p: u.pathname.replace('/rest/v1/', '') });
    await new Promise(res => setTimeout(res, DELAY));
    const rpc = /\/rpc\//.test(u.pathname);
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-allow-origin': '*' }, body: /single|object/.test(r.request().headers().accept || '') ? '{}' : (rpc ? '[]' : '[]') });
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
const bigState = () => { const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  state.students = Array.from({ length: 800 }, (_, i) => ({ id: id(1000 + i), full_name: 'طالب رقم ' + i + ' أبو يونس', status: 'active', halaqa_id: state.halaqas[i % 3].id, track_code: 'general_hifz', enrollment_date: '2026-01-01' })); state.page = 'home'; };

{ /* S1 + S2: tapping a drawer row on a slow CPU ends on the real page, and uses no View Transition */
  const { context, page } = await open('admin'); const c = await context.newCDPSession(page);
  await page.evaluate(bigState); await page.evaluate(async () => { await render(); }); await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__vt = 0; const o = document.startViewTransition; if (o) document.startViewTransition = function () { window.__vt++; return o.apply(document, arguments) } });
  await page.evaluate(() => toggleDrawer(true)); await page.waitForTimeout(800);
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.locator('.dtile', { hasText: 'الطلاب' }).first().click();
  await page.waitForFunction(() => document.querySelector('#content .nst-card'), null, { timeout: 9000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({ cards: document.querySelectorAll('#content .nst-card').length, skeleton: !!document.querySelector('#content .ops-skeleton'), vt: window.__vt }));
  note(r.cards > 0 && !r.skeleton, `S1 drawer tap on a slow CPU ends on the student list, not a skeleton (cards ${r.cards}, skeleton ${r.skeleton})`);
  note(r.vt === 0, `S2 a page change does not use a View Transition (calls ${r.vt})`);
  const cv = await page.evaluate(() => { const e = document.querySelector('.nst-card'); return e ? getComputedStyle(e).contentVisibility : 'none' });
  note(cv === 'auto', `S5 student cards use content-visibility:auto (${cv})`);
  await context.close();
}
{ /* S1b: deterministic form of the race: the page is already written when the 260ms skeleton timer fires */
  const { context, page } = await open('admin'); await page.evaluate(async () => { state.page = 'home'; await render(); }); await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => { const base = render; render = async function () { document.getElementById('content').innerHTML = '<div id="realPage">page</div>'; await new Promise(res => setTimeout(res, 600)); };
    go('sessions'); await new Promise(res => setTimeout(res, 900)); render = base; return { real: !!document.getElementById('realPage'), skeleton: !!document.querySelector('#content .ops-skeleton') } });
  note(r.real && !r.skeleton, `S1b a finished page is never overwritten by the late skeleton (page kept ${r.real}, skeleton ${r.skeleton})`);
  await context.close();
}
{ /* S3: automatic refresh policy */
  const { context, page } = await open('admin');
  const r = await page.evaluate(async () => { let n = 0; refreshFromServer = async () => { n++ }; internetReachable = async () => true; ensureServerAuthSession = async () => true; readOfflineQueue = () => [];
    const fire = async () => { document.dispatchEvent(new Event('visibilitychange')); await new Promise(res => setTimeout(res, 400)) };
    state.v230LastFullLoadAt = Date.now() - 60000; await fire(); const fresh = n;
    state.v230LastFullLoadAt = Date.now() - 10 * 60000; await fire(); const old = n - fresh;
    return { fresh, old } });
  note(r.fresh === 0 && r.old === 1, `S3 coming back to the app refreshes only when the last full load is older than 5 min (fresh ${r.fresh}, old ${r.old})`);
  await context.close();
}
{ /* S4: no decorative Lottie loops running on an idle home screen */
  const { context, page } = await open('admin'); await page.evaluate(async () => { state.page = 'home'; await render(); }); await page.waitForTimeout(3500);
  const r = await page.evaluate(() => { const a = window.lottie?.getRegisteredAnimations?.() || []; return { total: a.length, looping: a.filter(x => !x.isPaused && x.loop === true).length } });
  note(r.looping === 0, `S4 no looping Lottie animation runs on the idle home screen (registered ${r.total}, looping+playing ${r.looping})`);
  await context.close();
}
{ /* S6: the refresh gesture leaves the drawer alone */
  const { context, page } = await open('admin'); const c = await context.newCDPSession(page);
  await page.evaluate(async () => { state.page = 'home'; await render(); }); await page.waitForTimeout(1500);
  const drag = async (x, y0, y1) => { await page.evaluate(() => { window.__pm = []; if (!window.__pml) { window.__pml = 1; document.addEventListener('touchmove', e => window.__pm.push(e.defaultPrevented), { passive: true }) } });
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 12; i++) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * i / 12 }] }); await page.waitForTimeout(16) }
    const armed = await page.evaluate(() => document.getElementById('halaqatiPullRefresh')?.classList.contains('armed') || false);
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(300);
    return { armed, prevented: await page.evaluate(() => window.__pm.filter(Boolean).length) } };
  const closed = await drag(200, 300, 600); note(closed.armed, 'S6a closed drawer, page at top: pull-to-refresh arms (unchanged)');
  await page.waitForTimeout(2500);
  await page.evaluate(() => toggleDrawer(true)); await page.waitForTimeout(800);
  await page.evaluate(() => { (document.querySelector('.drawer .nav') || document.getElementById('nav')).scrollTop = 400 }); await page.waitForTimeout(200);
  const before = await page.evaluate(() => (document.querySelector('.drawer .nav') || document.getElementById('nav')).scrollTop);
  const op = await drag(200, 300, 600);
  const after = await page.evaluate(() => (document.querySelector('.drawer .nav') || document.getElementById('nav')).scrollTop);
  note(!op.armed && op.prevented === 0 && after < before, `S6b open drawer scrolled 400px: dragging down scrolls the list back (scrollTop ${before} -> ${after}), no refresh armed (${op.armed}), prevented ${op.prevented}`);
  await context.close();
}
{ /* S7: no sync notices anywhere on the web (the header badge stays as the way into the sync centre) */
  const { context, page } = await open('admin');
  await page.evaluate(() => { state.pendingSync = 1; state.networkVerified = true; state.offline = false; state.sessions = [{ id: 'se1', halaqa_id: state.halaqas[0].id, session_date: today(), session_type: 'tasmee', status: 'open', title: 'جلسة', activity_data: {}, _offline: true }]; state.page = 'sessions'; });
  await page.evaluate(async () => { await render(); }); await page.waitForTimeout(2500);
  const read = () => page.evaluate(() => ({ roster: !!document.querySelector('.nr-head'), banner: document.querySelectorAll('.nt-banner').length, text: /بانتظار المزامنة|بانتظار الرفع|وضع العمل دون إنترنت|تحتاج مراجعة/.test(document.getElementById('content').innerText + (document.getElementById('ntBanner')?.innerText || '')) }));
  const a = await read();
  await page.evaluate(async () => { state.offline = true; state.networkVerified = false; state.authNeedsLogin = true; state.sessionView = 'se1'; await render(); }); await page.waitForTimeout(2500);
  const b = await read();
  note(b.roster && a.banner === 0 && !a.text && b.banner === 0 && !b.text, `S7 no sync/offline notices on the sessions list or the roster (list ${JSON.stringify(a)}, roster ${JSON.stringify(b)})`);
  await context.close();
}
{ /* S8: slow mobile networks are not "offline" */
  const { context, page } = await open('admin');
  await context.route(/\/auth\/v1\/health/, r => setTimeout(() => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }), 4500));
  const r = await page.evaluate(async () => { state.lastNetworkCheck = 0; const ok = await internetReachable(true); return { ok, offline: state.offline } });
  note(r.ok === true && r.offline === false, `S8a a health check answered after 4.5 s is still online (${JSON.stringify(r)})`);
  await context.close();
}
{ /* S8b: any answer from the server proves the connection and clears a stale "offline" */
  const { context, page } = await open('admin');
  const r = await page.evaluate(async () => { state.offline = true; state.networkVerified = false; await db.from('exam_settings').select('*').limit(1); return { offline: state.offline, verified: state.networkVerified } });
  note(r.offline === false && r.verified === true, `S8b a successful request clears a stale offline state (${JSON.stringify(r)})`);
  await context.close();
}
{ /* S8c: a refresh that fails for a reason that is not the network (permission, code error) does not turn the app offline */
  const { context, page } = await open('admin');
  await context.route(/\/rest\/v1\/profiles/, r => r.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"42501","message":"permission denied for table profiles"}' }));
  const r = await page.evaluate(async () => { internetReachable = async () => { state.networkVerified = true; state.offline = false; return true }; ensureServerAuthSession = async () => true; readOfflineQueue = () => [];
    state.networkVerified = true; state.offline = false; const ok = await refreshFromServer({ renderAfter: false }); return { ok, offline: state.offline } });
  note(r.offline === false, `S8c a permission error during refresh does not set offline (${JSON.stringify(r)})`);
  await context.close();
}
{ /* S9: danger/error text is readable on the surfaces it is drawn on, in light and dark (the rc54 status tokens are solid-pill colours: white text) */
  const { context, page } = await open('admin');
  const CASES = [['nx-menu', '<div class="nx-menu" style="position:static;animation:none"><button class="danger">حذف</button></div>', 'button'], ['nc-err', '<span class="nc-err">خطأ</span>'], ['nh-err', '<span class="nh-err">خطأ</span>'], ['ngm-err', '<span class="ngm-err">خطأ</span>'], ['nr-pick-err', '<p class="nr-pick-err">خطأ</p>'], ['ns-del-err', '<p class="ns-del-err">خطأ</p>'], ['nc-del', '<button class="nc-del">حذف</button>'], ['nc-danger', '<button class="nc-danger">حذف</button>'], ['nc-late', '<span class="nc-late">متأخر</span>'], ['ngm-offline-red', '<span class="ngm-offline-red">x</span>'], ['ngm-reject', '<small class="ngm-reject">مرفوض</small>'], ['nr-del', '<button class="nr-del">حذف</button>'], ['nr-del-btn', '<button class="nr-del-btn">حذف</button>'], ['nr-sub.bad', '<span class="nr-sub bad">x</span>'], ['nr-sync.bad', '<span class="nr-sync bad">x</span>'], ['ns-wk-s.bad', '<i class="ns-wk-s bad">x</i>'], ['nr-cmp em.bad', '<div class="nr-cmp"><em class="bad">x</em></div>', 'em']];
  const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }); return .2126 * r + .7152 * g + .0722 * b };
  const bad = [];
  for (const dark of [false, true]) {
    const res = await page.evaluate(({ dark, CASES }) => { document.body.classList.toggle('dark', dark); const host = document.createElement('div'); host.style.cssText = 'background:var(--card);padding:8px'; document.body.appendChild(host); const out = [];
      for (const [name, html, sel] of CASES) { host.innerHTML = html; const el = sel ? host.querySelector(sel) : host.firstElementChild; out.push([name, getComputedStyle(el).color, getComputedStyle(host).backgroundColor]) }
      host.innerHTML = '<div class="ngm-dlg"><button class="nx-btn nx-danger">حذف</button></div>'; const b = host.querySelector('button'); out.push(['ngm-dlg danger button', getComputedStyle(b).color, getComputedStyle(b).backgroundColor]); host.remove(); return out }, { dark, CASES });
    for (const [name, fg, bg] of res) { const a = lum(fg), b = lum(bg), cr = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (cr < 3) bad.push(`${name}${dark ? ' (dark)' : ''}: ${cr.toFixed(2)}`) }
  }
  note(bad.length === 0, `S9 danger/error text has contrast >= 3:1 on its surface in light and dark ${JSON.stringify(bad)}`);
  await context.close();
}
{ /* S10: the Back button closes what is on top, then goes back one screen, and only leaves the app from the home screen */
  const mk = async () => { const { context, page } = await open('admin'); await page.evaluate(async () => { window.__alive = 1; state.sessions = [{ id: 'se1', halaqa_id: state.halaqas[0].id, session_date: today(), session_type: 'tasmee', status: 'open', title: 'جلسة', activity_data: {} }]; state.page = 'home'; await render(); }); await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await page.waitForTimeout(800); return { context, page } };
  const back = async page => { await page.evaluate(() => history.back()); await page.waitForTimeout(900) };
  const alive = page => page.evaluate(() => window.__alive === 1).catch(() => false);
  { const { context, page } = await mk(); await page.evaluate(() => toggleDrawer(true)); await page.waitForTimeout(500); await back(page);
    const r = await page.evaluate(() => window.__alive === 1 && !document.getElementById('drawer').classList.contains('open')).catch(() => false);
    note(r, 'S10a Back closes the open drawer and stays in the app'); await context.close(); }
  { const { context, page } = await mk(); await page.evaluate(() => { NX.dialog('tDlg', 'اختبار', '<p>x</p>') }); await page.waitForTimeout(400); await back(page);
    const r = await page.evaluate(() => window.__alive === 1 && !document.getElementById('tDlg').open).catch(() => false);
    note(r, 'S10b Back closes an open dialog and stays in the app'); await context.close(); }
  { const { context, page } = await mk(); await page.evaluate(async () => { state.page = 'sessions'; await render(); state.sessionView = 'se1'; await render(); }); await page.waitForTimeout(800); const open = await page.evaluate(() => !!document.querySelector('.nr-back')); await back(page);
    const r = await page.evaluate(() => ({ alive: window.__alive === 1, view: state.sessionView, page: state.page })).catch(() => ({ alive: false }));
    note(open && r.alive && !r.view && r.page === 'sessions', `S10c Back from an open session returns to the sessions list (${JSON.stringify(r)})`); await context.close(); }
  { const { context, page } = await mk(); await page.evaluate(async () => { go('sessions') }); await page.waitForTimeout(900); await back(page);
    const r = await page.evaluate(() => ({ alive: window.__alive === 1, page: state.page })).catch(() => ({ alive: false }));
    note(r.alive && r.page === 'home', `S10d Back from a bottom-bar page goes to the home screen instead of leaving (${JSON.stringify(r)})`); await context.close(); }
  { const { context, page } = await mk(); await page.evaluate(async () => { go('sessions') }); await page.waitForTimeout(700); await page.evaluate(() => go('settings')); await page.waitForTimeout(900); await back(page);
    const r = await page.evaluate(() => ({ alive: window.__alive === 1, page: state.page })).catch(() => ({ alive: false }));
    note(r.alive && r.page === 'sessions', `S10e Back from a menu page returns to the page it was opened from (${JSON.stringify(r)})`); await context.close(); }
  { /* S10g: Chrome skips history entries a page adds without a user gesture when the person presses Back, so the sentinel is only added on the first touch */
    const { context, page } = await open('admin'); await page.waitForTimeout(500);
    const before = await page.evaluate(() => history.length); await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await page.waitForTimeout(300);
    const after = await page.evaluate(() => history.length);
    note(after === before + 1, `S10g the Back sentinel is added on the first user gesture, not at load (history ${before} -> ${after})`); await context.close(); }
  { const { context, page } = await mk(); await back(page); const gone = !(await alive(page));
    note(gone, 'S10f Back on the home screen with nothing open leaves the app (unchanged)'); await context.close(); }
}
await browser.close(); console.log(failures.length ? failures.length + ' FAILED' : 'Stability checks: all passed'); process.exit(failures.length ? 1 : 0);
