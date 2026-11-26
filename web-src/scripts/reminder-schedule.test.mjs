// Same cases as Android ReminderScheduleTest.kt, using local-time Dates (days are ISO weekdays 1=Mon..7=Sun).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/features/reminders/schedule.mjs';

const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi, 0, 0);
const thu6 = { enabled: true, days: [4], hour: 18, minute: 0 };
const same = (a, b) => assert.equal(a && a.getTime(), b && b.getTime());

test('default is on, Thursday at 18:00', () => {
  assert.deepEqual(S.DEFAULT, thu6);
});

test('sameDayLaterTodayFires (Thursday 26 Nov 2026 09:00 -> 18:00 today)', () => {
  assert.equal(at(2026, 11, 26, 9, 0).getDay(), 4);
  same(S.nextAt(at(2026, 11, 26, 9, 0), thu6), at(2026, 11, 26, 18, 0));
});

test('timeAlreadyPassedMovesToNextWeek', () => {
  same(S.nextAt(at(2026, 11, 26, 18, 0), thu6), at(2026, 12, 3, 18, 0));
  same(S.nextAt(at(2026, 11, 26, 20, 30), thu6), at(2026, 12, 3, 18, 0));
});

test('pickedDaysAreAllConsidered', () => {
  const r = { enabled: true, days: [6, 2], hour: 7, minute: 30 };
  same(S.nextAt(at(2026, 11, 26, 20, 0), r), at(2026, 11, 28, 7, 30));
  same(S.nextAt(at(2026, 11, 28, 8, 0), r), at(2026, 12, 1, 7, 30));
});

test('everyDayAfterTheTimeGoesToTomorrow', () => {
  const r = { enabled: true, days: [1, 2, 3, 4, 5, 6, 7], hour: 6, minute: 0 };
  same(S.nextAt(at(2026, 11, 26, 6, 1), r), at(2026, 11, 27, 6, 0));
});

test('offOrNoDayMeansNothingIsScheduled', () => {
  assert.equal(S.nextAt(at(2026, 11, 26, 9, 0), { ...thu6, enabled: false }), null);
  assert.equal(S.nextAt(at(2026, 11, 26, 9, 0), { ...thu6, days: [] }), null);
});

test('textsExistOnlyForTheRolesThatCanActOnThem', () => {
  assert.equal(S.textForRole('guardian').title, 'تكفّل بحلقة أبنائك');
  assert.equal(S.textForRole('GUARDIAN').title, 'تكفّل بحلقة أبنائك');
  for (const r of ['teacher', 'supervisor', 'admin']) assert.equal(S.textForRole(r).title, 'أنشئ مسابقة لحلقتك');
  for (const r of ['observer', 'student', '', 'unknown', undefined]) assert.equal(S.textForRole(r), null);
});

test('lastDueAt is the latest occurrence not after now', () => {
  same(S.lastDueAt(at(2026, 11, 26, 18, 0), thu6), at(2026, 11, 26, 18, 0));
  same(S.lastDueAt(at(2026, 11, 27, 10, 0), thu6), at(2026, 11, 26, 18, 0));
  same(S.lastDueAt(at(2026, 11, 26, 17, 59), thu6), at(2026, 11, 19, 18, 0));
  assert.equal(S.lastDueAt(at(2026, 11, 26, 20, 0), { ...thu6, enabled: false }), null);
  assert.equal(S.lastDueAt(at(2026, 11, 26, 20, 0), { ...thu6, days: [] }), null);
});

test('dueOccurrence shows once: after the time, before an ack, inside the grace window', () => {
  const day = 24 * 3600 * 1000;
  const now = at(2026, 11, 26, 19, 0);
  same(S.dueOccurrence(now, thu6, 0, day), at(2026, 11, 26, 18, 0));
  // acknowledged at (or after) the occurrence: nothing more to show
  assert.equal(S.dueOccurrence(now, thu6, at(2026, 11, 26, 18, 0).getTime(), day), null);
  assert.equal(S.dueOccurrence(now, thu6, at(2026, 11, 26, 18, 30).getTime(), day), null);
  // the app was closed for two days: the missed occurrence is too late to be useful
  assert.equal(S.dueOccurrence(at(2026, 11, 28, 19, 0), thu6, 0, day), null);
  // before the time: the previous week's occurrence is old, so nothing
  assert.equal(S.dueOccurrence(at(2026, 11, 26, 9, 0), thu6, 0, day), null);
  // disabled: nothing
  assert.equal(S.dueOccurrence(now, { ...thu6, enabled: false }, 0, day), null);
});

const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, raw: m }; };

test('prefs: default when nothing stored, round trip, clamps and ignores garbage', () => {
  const st = mem();
  assert.deepEqual(S.loadPrefs(st), S.DEFAULT);
  S.savePrefs(st, { enabled: false, days: [2, 6], hour: 7, minute: 5 });
  assert.deepEqual(S.loadPrefs(st), { enabled: false, days: [2, 6], hour: 7, minute: 5 });
  st.setItem(S.PREFS_KEY, JSON.stringify({ enabled: true, days: [0, 8, 3, 3, 'x'], hour: 99, minute: -4 }));
  assert.deepEqual(S.loadPrefs(st), { enabled: true, days: [3], hour: 23, minute: 0 });
  st.setItem(S.PREFS_KEY, '{not json');
  assert.deepEqual(S.loadPrefs(st), S.DEFAULT);
});

test('prefs never throw when storage is blocked', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(S.loadPrefs(bad), S.DEFAULT);
  assert.doesNotThrow(() => S.savePrefs(bad, S.DEFAULT));
  assert.equal(S.loadAck(bad), 0);
  assert.doesNotThrow(() => S.saveAck(bad, 5));
  assert.deepEqual(S.loadPrefs(null), S.DEFAULT);
});

test('ack round trip', () => {
  const st = mem();
  assert.equal(S.loadAck(st), 0);
  S.saveAck(st, 12345);
  assert.equal(S.loadAck(st), 12345);
});

test('labels in Arabic', () => {
  assert.equal(S.dayName(4), 'الخميس');
  assert.equal(S.dayName(6), 'السبت');
  assert.equal(S.timeLabel(18, 5), '٦:٠٥ م');
  assert.equal(S.timeLabel(0, 0), '١٢:٠٠ ص');
  assert.equal(S.timeLabel(12, 30), '١٢:٣٠ م');
  assert.deepEqual(S.WEEK.map((x) => x[0]), [6, 7, 1, 2, 3, 4, 5]);
});

test('time input helpers', () => {
  assert.equal(S.toTimeInput(7, 5), '07:05');
  assert.deepEqual(S.fromTimeInput('18:30'), { hour: 18, minute: 30 });
  assert.equal(S.fromTimeInput(''), null);
  assert.equal(S.fromTimeInput('25:00'), null);
});
