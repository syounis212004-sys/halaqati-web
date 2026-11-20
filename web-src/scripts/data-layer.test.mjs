// Data-layer behaviour tests (no browser): paged reads, SWR cache invalidation, roster pre-cache and connectivity probe policy.
// The classic scripts keep their code in globals, so each unit is cut out of the real source file and run in a vm sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = p => fs.readFileSync(path.join(SRC, p), 'utf8');
const between = (text, start, end) => { const a = text.indexOf(start); assert.ok(a >= 0, 'missing: ' + start); const b = text.indexOf(end, a); assert.ok(b > a, 'missing end: ' + end); return text.slice(a, b + end.length); };

/* ---------- HalaqatiData.all: stop on a short page, do not ask for an empty one ---------- */
function loadData() {
  const sandbox = { window: {} }; vm.createContext(sandbox);
  vm.runInContext(read('features/rc27/data.js'), sandbox);
  return sandbox.window.HalaqatiData;
}
const pager = total => { let calls = 0; const rows = Array.from({ length: total }, (_, i) => i); return { calls: () => calls, make: () => ({ range: async (a, b) => { calls++; return { data: rows.slice(a, b + 1) }; } }) }; };

test('paged read: fewer rows than the page size costs ONE request', async () => {
  const D = loadData(), p = pager(65);
  const rows = await D.all(p.make, () => 1, 100);
  assert.equal(rows.length, 65); assert.equal(p.calls(), 1);
});
test('paged read: exactly one full page needs a second request to prove the end', async () => {
  const D = loadData(), p = pager(100);
  assert.equal((await D.all(p.make, () => 1, 100)).length, 100); assert.equal(p.calls(), 2);
});
test('paged read: several pages return every row in order', async () => {
  const D = loadData(), p = pager(250);
  const rows = await D.all(p.make, () => 1, 100);
  assert.equal(rows.length, 250); assert.equal(rows[249], 249); assert.equal(p.calls(), 3);
});
test('paged read: an empty table costs one request', async () => {
  const D = loadData(), p = pager(0);
  assert.equal((await D.all(p.make, () => 1, 100)).length, 0); assert.equal(p.calls(), 1);
});
test('paged read: an account change in the middle still aborts', async () => {
  const D = loadData(), p = pager(250); let user = 'a';
  const make = () => ({ range: async (a, b) => { const r = await p.make().range(a, b); user = 'b'; return r; } });
  await assert.rejects(D.all(make, () => user, 100), /تغير الحساب/);
});

/* ---------- HalaqatiSwr: reads that are POST RPCs must not flush the cache ---------- */
function loadSwr() {
  const code = between(read('core/runtime.js'), 'const HalaqatiSwr=(()=>{', '})();');
  const sandbox = { document: { getElementById: () => null, querySelector: () => null, hidden: false, activeElement: null }, scrollY: 0, render() {}, Response, Headers, URL, Date, setTimeout, clearTimeout, Math, Map };
  vm.createContext(sandbox);
  return vm.runInContext(code + ';HalaqatiSwr', sandbox);
}
const mkGo = counter => () => { counter.n++; return Promise.resolve(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })); };
const U = p => 'https://x.supabase.co/rest/v1/' + p;
const READ_RPCS = ['rc_pending_requests', 'rc49_support_cards', 'rc49_support_defaults', 'rc49_my_pledges', 'rc49_donor_impact', 'rc49_donor_report', 'rc49_news_list', 'rc32_observer_overview', 'rc40_observer_breakdown'];

for (const name of READ_RPCS) {
  test(`SWR: STABLE read rpc ${name} is cached and does not flush other cached reads`, async () => {
    const S = loadSwr(), c = { n: 0 }, go = mkGo(c);
    await S.fetch(U('students?select=*'), { method: 'GET' }, go); assert.equal(c.n, 1);
    await S.fetch(U('rpc/' + name), { method: 'POST', body: '{}' }, go); assert.equal(c.n, 2);
    await S.fetch(U('students?select=*'), { method: 'GET' }, go); assert.equal(c.n, 2, 'students read must still come from the cache');
    await S.fetch(U('rpc/' + name), { method: 'POST', body: '{}' }, go); assert.equal(c.n, 2, 'the rpc answer itself is cached');
  });
}
test('SWR: a real write still flushes everything', async () => {
  const S = loadSwr(), c = { n: 0 }, go = mkGo(c);
  await S.fetch(U('students?select=*'), { method: 'GET' }, go);
  await S.fetch(U('students'), { method: 'POST', body: '{"full_name":"x"}' }, go);
  await S.fetch(U('students?select=*'), { method: 'GET' }, go);
  assert.equal(c.n, 3);
});
test('SWR: an unknown rpc is treated as a write (safe default)', async () => {
  const S = loadSwr(), c = { n: 0 }, go = mkGo(c);
  await S.fetch(U('students?select=*'), { method: 'GET' }, go);
  await S.fetch(U('rpc/rc_something_new'), { method: 'POST', body: '{}' }, go);
  await S.fetch(U('students?select=*'), { method: 'GET' }, go);
  assert.equal(c.n, 3);
});
test('SWR: the notification cleanup rpc neither flushes nor is cached', async () => {
  const S = loadSwr(), c = { n: 0 }, go = mkGo(c);
  await S.fetch(U('students?select=*'), { method: 'GET' }, go);
  await S.fetch(U('rpc/rc27_cleanup_notifications'), { method: 'POST', body: '{}' }, go);
  await S.fetch(U('rpc/rc27_cleanup_notifications'), { method: 'POST', body: '{}' }, go);
  await S.fetch(U('students?select=*'), { method: 'GET' }, go);
  assert.equal(c.n, 3);
});

/* ---------- roster pre-cache plan: do not re-download 30 sessions at every launch ---------- */
function loadPlan() {
  const code = between(read('features/sessions/runtime.js'), 'function rosterPrecachePlan', '\n');
  const sandbox = {}; vm.createContext(sandbox); return vm.runInContext(code + ';rosterPrecachePlan', sandbox);
}
const sess = (id, date) => ({ id, session_date: date });
const NOW = Date.parse('2026-11-20T10:00:00Z'), MIN = 60000;
test('roster plan: inside the 30 minute window nothing is downloaded', () => {
  const plan = loadPlan();
  assert.equal(plan([sess('a', '2026-11-20')], {}, NOW - 5 * MIN, NOW, '2026-11-20').length, 0);
});
test('roster plan: after the window it fetches sessions that are missing locally', () => {
  const plan = loadPlan();
  assert.deepEqual([...plan([sess('a', '2026-10-01'), sess('b', '2026-10-02')], { a: {} }, NOW - 40 * MIN, NOW, '2026-11-20')], ['b']);
});
test('roster plan: recent sessions (last 3 days) are refreshed even when cached', () => {
  const plan = loadPlan();
  assert.deepEqual([...plan([sess('a', '2026-11-19'), sess('b', '2026-10-02')], { a: {}, b: {} }, NOW - 40 * MIN, NOW, '2026-11-20')], ['a']);
});
test('roster plan: first run ever (no timestamp) fetches the missing ones', () => {
  const plan = loadPlan();
  assert.equal(plan([sess('a', '2026-10-01')], {}, 0, NOW, '2026-11-20').length, 1);
});
test('roster plan: fully cached old sessions cost nothing', () => {
  const plan = loadPlan();
  assert.equal(plan([sess('a', '2026-10-01')], { a: {} }, NOW - 99 * MIN, NOW, '2026-11-20').length, 0);
});
test('roster pre-cache goes through the plan and records when it last succeeded', () => {
  const src = between(read('features/sessions/runtime.js'), 'async function cacheRecentSessionRostersForOffline', 'window.cacheRecentSessionRostersForOffline');
  assert.match(src, /rosterPrecachePlan\(/);
  assert.match(src, /halaqati_roster_cache_at_/);
});
test('sign-out clears the roster stamp and the full-load stamp together with the snapshot', () => {
  const src = between(read('features/auth/runtime.js'), 'async function clearLocalStudentData', 'async function logout');
  assert.match(src, /halaqati_roster_cache_at_/); assert.match(src, /halaqati_full_load_/);
});

/* ---------- connectivity: a real server answer in the last minute is proof; do not ping /auth/v1/health again ---------- */
function loadNet(stampAgoMs) {
  const rt = read('core/runtime.js');
  const probe = between(rt, 'async function internetReachable', '\n}\n');
  const answered = between(rt, 'const halaqatiAnswered=', '\n');
  let fetches = 0;
  const sandbox = { navigator: { onLine: true }, state: { lastServerAnswerAt: stampAgoMs == null ? 0 : Date.now() - stampAgoMs }, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_KEY: 'k', Date, setTimeout, clearTimeout, AbortController, updateSyncBadge() {}, sleep: ms => new Promise(r => setTimeout(r, ms)), fetch: async () => { fetches++; return { status: 200 }; } };
  vm.createContext(sandbox);
  vm.runInContext(probe + '\n' + answered, sandbox);
  return { sandbox, fetches: () => fetches };
}
test('connectivity: a server answer 10 s ago makes a forced check free', async () => {
  const n = loadNet(10000);
  assert.equal(await n.sandbox.internetReachable(true), true); assert.equal(n.fetches(), 0);
  assert.equal(n.sandbox.state.networkVerified, true); assert.equal(n.sandbox.state.offline, false);
});
test('connectivity: after 2 minutes of silence the forced check really probes once', async () => {
  const n = loadNet(120000);
  assert.equal(await n.sandbox.internetReachable(true), true); assert.equal(n.fetches(), 1);
});
test('connectivity: with no recorded answer it probes', async () => {
  const n = loadNet(null);
  await n.sandbox.internetReachable(true); assert.equal(n.fetches(), 1);
});
test('connectivity: navigator.onLine=false is still offline without any probe', async () => {
  const n = loadNet(5000); n.sandbox.navigator.onLine = false;
  assert.equal(await n.sandbox.internetReachable(true), false); assert.equal(n.fetches(), 0);
});
test('connectivity: only a non-5xx server answer is recorded as proof', () => {
  const n = loadNet(null);
  const answered = vm.runInContext('halaqatiAnswered', n.sandbox);
  answered({ status: 503 }); assert.equal(n.sandbox.state.lastServerAnswerAt, 0);
  answered({ status: 200 }); assert.ok(n.sandbox.state.lastServerAnswerAt > 0);
});

/* ---------- plan health: do not re-send an identical (plan, student, day, numbers) record to the server ---------- */
function loadHealth() {
  const store = new Map(), sandbox = { window: {}, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) }, Date, JSON, Number, Array };
  vm.createContext(sandbox); vm.runInContext(read('features/plans/health.js'), sandbox); return { H: sandbox.window.HalaqatiPlanHealth, store };
}
const plan = { id: 'p1', plan_type: 'hifz', schedule_weekdays: [0, 1, 2, 3, 4], catch_up_weekday: 6 }, stu = { id: 's1', full_name: 'x' };
const prog = (over = {}) => ({ health: 'green', plannedByToday: 4, completed: 4, behindBy: 0, ...over });
const fakeDb = (statusRow) => { const calls = []; return { calls, rpc: async (n, a) => { calls.push(n); return { data: n === 'rc19_record_plan_health' ? [statusRow] : [{}], error: null }; } }; };
test('plan health: record returns done when nothing needs a notification', async () => {
  const { H } = loadHealth(), db = fakeDb({ should_notify: false });
  assert.equal(await H.record(db, plan, stu, prog(), '2026-11-20', async () => ({})), 'done'); assert.deepEqual(db.calls, ['rc19_record_plan_health']);
});
test('plan health: a failed notification keeps the record pending so it is retried', async () => {
  const { H } = loadHealth(), db = fakeDb({ should_notify: true });
  assert.equal(await H.record(db, plan, stu, prog(), '2026-11-20', async () => null), 'pending');
});
test('plan health: unchanged numbers are skipped after a clean record, changed numbers are not', () => {
  const { H } = loadHealth();
  assert.equal(H.unchanged('u1', plan, stu, prog(), '2026-11-20'), false);
  H.remember('u1', plan, stu, prog(), '2026-11-20');
  assert.equal(H.unchanged('u1', plan, stu, prog(), '2026-11-20'), true);
  assert.equal(H.unchanged('u1', plan, stu, prog({ completed: 5 }), '2026-11-20'), false);
  assert.equal(H.unchanged('u2', plan, stu, prog(), '2026-11-20'), false, 'per user');
  assert.equal(H.unchanged('u1', plan, stu, prog(), '2026-11-21'), false, 'next day starts fresh');
});
test('plan health: the alert loop consults the memo and only remembers clean records', () => {
  const src = between(read('features/plans/runtime.js'), 'async function checkSmartPlanAlerts', '\n}\n');
  assert.match(src, /HalaqatiPlanHealth\.unchanged\(/); assert.match(src, /HalaqatiPlanHealth\.remember\(/);
});

/* ---------- notifications: the 60 s poll fetches ONE query, and backs off while nothing changes ---------- */
function loadNotif(rows = []) {
  const src = read('features/notifications/runtime.js');
  const code = 'let notificationLastRefresh=0,notificationAuxAt=0,notificationPollStreak=0,notificationTopKey="";\n'
    + between(src, 'function notificationPollDelay', '\n') + '\n' + between(src, 'async function refreshNotifications', '\n}\n');
  const calls = [];
  const q = name => { const b = { select: () => b, eq: () => b, neq: () => b, order: () => b, limit: () => Promise.resolve({ data: rows, error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }; calls.push(name); return b; };
  const sandbox = { state: { user: { id: 'u' }, notifications: [], sentNotifications: [] }, navigator: { onLine: true }, db: { from: name => q(name) }, canSendNotifications: () => true, notificationPreferencesDefaults: () => ({}), updateNotificationBadges() {}, cacheSnapshot() {}, toast() {}, console, Date, Promise };
  vm.createContext(sandbox); vm.runInContext(code, sandbox);
  return { S: sandbox, calls, run: vm.runInContext.bind(vm) };
}
test('notifications: first load asks for inbox, sent items and preferences', async () => {
  const n = loadNotif(); await n.S.refreshNotifications({ silent: true });
  assert.deepEqual(n.calls, ['notifications', 'notifications', 'notification_preferences']);
});
test('notifications: a following silent poll asks for the inbox only', async () => {
  const n = loadNotif(); await n.S.refreshNotifications({ silent: true }); n.calls.length = 0;
  await n.S.refreshNotifications({ silent: true });
  assert.deepEqual(n.calls, ['notifications']);
});
test('notifications: a manual refresh (not silent) re-reads everything', async () => {
  const n = loadNotif(); await n.S.refreshNotifications({ silent: true }); n.calls.length = 0;
  await n.S.refreshNotifications({ silent: false });
  assert.equal(n.calls.length, 3);
});
test('notifications: the delay grows 60 s -> 120 s -> 240 s -> 300 s while nothing changes and resets on news', async () => {
  const n = loadNotif([{ id: 'a', read_at: null }]);
  assert.equal(n.S.notificationPollDelay(), 60000);
  const seen = []; for (let i = 0; i < 8; i++) { await n.S.refreshNotifications({ silent: true }); seen.push(n.S.notificationPollDelay()); }
  assert.deepEqual(seen, [60000, 60000, 60000, 120000, 120000, 240000, 240000, 300000]);
  n.S.db.from = name => { const b = { select: () => b, eq: () => b, neq: () => b, order: () => b, limit: () => Promise.resolve({ data: [{ id: 'new', read_at: null }], error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }; return b; };
  await n.S.refreshNotifications({ silent: true });
  assert.equal(n.S.notificationPollDelay(), 60000);
});
test('notifications: the poller is a self-scheduling timer, not a fixed interval', () => {
  const src = between(read('features/notifications/runtime.js'), 'async function initHalaqatiNotifications', '\n}\n');
  assert.doesNotMatch(src, /setInterval\(/); assert.match(src, /scheduleNotificationPoll\(/);
});

/* ---------- student photos: the list query leaves out the inline base64 photo, which is carried over / fetched lazily ---------- */
function loadPhotos(stateOver = {}, dbImpl, win) {
  const src = read('core/performance-runtime.js');
  const code = [between(src, 'const V230_STUDENT_COLUMNS=', '\n'), between(src, 'function v230MergeStudentPhotos', '\n'), between(src, 'function keepStudentPhoto', '\n'), between(src, 'async function v230HydrateStudentPhotos', '\n}\n')].join('\n');
  const calls = [];
  const mk = (cols, mode) => { const b = { not: () => b, in: ids => { b.ids = ids; return b; }, then: (ok, bad) => Promise.resolve(dbImpl(mode(b), b)).then(ok, bad) }; return b; };
  const sandbox = { state: { demo: false, networkVerified: true, students: [], photoUrls: {}, ...stateOver }, db: { from: t => ({ select: cols => { calls.push({ t, cols }); const b = { _q: { t, cols } }; b.not = (...a) => { b._q.not = a; return b; }; b.in = (c, ids) => { b._q.in = ids; return b; }; b.then = (ok, bad) => Promise.resolve(dbImpl(b._q)).then(ok, bad); return b; } }) }, v230RefreshPhotoUrls() {}, cacheSnapshot() {}, v230RenderIfVisible() {}, $: () => null, console, ...(win ? { window: win } : {}) };
  vm.createContext(sandbox); vm.runInContext(code, sandbox); return { S: sandbox, calls, cols: vm.runInContext('V230_STUDENT_COLUMNS', sandbox) };
}
test('photos: the student list column set is every column except photo_path', () => {
  const { cols } = loadPhotos(); const list = cols.split(',');
  assert.ok(!list.includes('photo_path')); for (const c of ['id', 'full_name', 'halaqa_id', 'updated_at', 'primary_teacher_id', 'status', 'national_id', 'association_id']) assert.ok(list.includes(c), c);
  assert.equal(new Set(list).size, list.length);
  assert.match(between(read('core/performance-runtime.js'), 'async function v230LoadCoreData', '\n}\n'), /select\(V230_STUDENT_COLUMNS\)/);
});
test('photos: merge carries a known photo only while updated_at is unchanged', () => {
  const { S } = loadPhotos();
  const prev = [{ id: 'a', updated_at: 't1', photo_path: 'data:image/x' }, { id: 'b', updated_at: 't1', photo_path: null }, { id: 'c', updated_at: 't1' }, { id: 'd', updated_at: 't1', photo_path: 'data:image/d' }];
  const next = [{ id: 'a', updated_at: 't1' }, { id: 'b', updated_at: 't1' }, { id: 'c', updated_at: 't1' }, { id: 'd', updated_at: 't2' }, { id: 'e', updated_at: 't1' }];
  const out = S.v230MergeStudentPhotos(prev, next);
  assert.equal(out[0].photo_path, 'data:image/x'); assert.equal(out[1].photo_path, null); assert.ok(!('photo_path' in out[2]), 'unknown stays unknown');
  assert.ok(!('photo_path' in out[3]), 'changed row is refetched'); assert.ok(!('photo_path' in out[4]), 'new row is fetched');
});
test('photos: a few unknown students are fetched by id in ONE request and missing ones become "no photo"', async () => {
  const { S, calls } = loadPhotos({ students: [{ id: 'a' }, { id: 'b' }, { id: 'k', photo_path: 'data:image/k' }] }, q => ({ data: [{ id: 'a', photo_path: 'data:image/a' }], error: null }));
  assert.equal(await S.v230HydrateStudentPhotos(), 2);
  assert.equal(calls.length, 1); assert.equal(calls[0].cols, 'id,photo_path');
  const s = S.state.students; assert.equal(s[0].photo_path, 'data:image/a'); assert.equal(s[1].photo_path, null); assert.equal(s[2].photo_path, 'data:image/k');
});
test('photos: many unknown students use one "has a photo" request instead of a long id list', async () => {
  const students = Array.from({ length: 65 }, (_, i) => ({ id: 's' + i }));
  let seen; const { S, calls } = loadPhotos({ students }, q => { seen = q; return { data: [{ id: 's3', photo_path: 'data:image/3' }], error: null }; });
  await S.v230HydrateStudentPhotos();
  assert.equal(calls.length, 1); assert.ok(seen.not && !seen.in);
  assert.equal(S.state.students[3].photo_path, 'data:image/3'); assert.equal(S.state.students[4].photo_path, null);
});
test('photos: a failed fetch leaves students unknown so the next load retries, and offline makes no request', async () => {
  const bad = loadPhotos({ students: [{ id: 'a' }] }, () => ({ data: null, error: { message: 'x' } }));
  assert.equal(await bad.S.v230HydrateStudentPhotos(), 0); assert.ok(!('photo_path' in bad.S.state.students[0]));
  const off = loadPhotos({ networkVerified: false, students: [{ id: 'a' }] }, () => ({ data: [], error: null }));
  assert.equal(await off.S.v230HydrateStudentPhotos(), 0); assert.equal(off.calls.length, 0);
});
test('photos: nothing unknown means no request at all', async () => {
  const { S, calls } = loadPhotos({ students: [{ id: 'a', photo_path: null }] }, () => ({ data: [], error: null }));
  assert.equal(await S.v230HydrateStudentPhotos(), 0); assert.equal(calls.length, 0);
});
test('photos: a reload during the fetch does not write onto stale rows', async () => {
  let ctx; const { S } = loadPhotos({ students: [{ id: 'a' }] }, () => { ctx.state.students = [{ id: 'a', note: 'fresh' }]; return { data: [{ id: 'a', photo_path: 'data:image/a' }], error: null }; });
  ctx = S; await S.v230HydrateStudentPhotos();
  assert.equal(S.state.students[0].photo_path, 'data:image/a'); assert.equal(S.state.students[0].note, 'fresh');
});
test('photos: editing a student whose photo is still unknown must NOT overwrite it with null', () => {
  const { S } = loadPhotos();
  assert.equal(S.keepStudentPhoto(undefined), null, 'new student: no photo');
  assert.equal(S.keepStudentPhoto({ id: 'a' }), undefined, 'unknown: leave the column out of the save');
  assert.equal(S.keepStudentPhoto({ id: 'a', photo_path: null }), null);
  assert.equal(S.keepStudentPhoto({ id: 'a', photo_path: 'data:image/a' }), 'data:image/a');
  for (const f of ['features/native/students.js', 'features/students/runtime.js']) assert.match(read(f), /keepStudentPhoto\(old\)/, f);
});

test('photos: students that only exist in the unscoped master list (RC27.master) are hydrated too', async () => {
  const shared = { id: 'a' }, onlyMaster = { id: 'm' };
  const { S } = loadPhotos({ students: [shared] }, () => ({ data: [{ id: 'a', photo_path: 'data:image/a' }, { id: 'm', photo_path: 'data:image/m' }], error: null }), { RC27: { master: { students: [shared, onlyMaster] } } });
  assert.equal(await S.v230HydrateStudentPhotos(), 2);
  assert.equal(shared.photo_path, 'data:image/a'); assert.equal(onlyMaster.photo_path, 'data:image/m');
});
