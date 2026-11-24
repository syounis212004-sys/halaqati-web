/* Bulk Hifz -> Sard management must not silently override the days already set on each student's own Sard phase. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const D = require('../src/features/native/phase-days.js');

test('the bulk form starts from the days the students really have (the most common set), not from a fixed Sunday-Friday', () => {
  assert.deepEqual(D.commonDays([[5], [5], [5], [0, 1, 2, 3, 4, 5]]), [5]);
  assert.deepEqual(D.commonDays([[5, 0], [0, 5], [1]]), [0, 5], 'order does not matter');
  assert.equal(D.commonDays([null, undefined, []]), null, 'no Sard phase yet: the caller uses its own default');
});

test('students keep their own days unless the manager changed the common days', () => {
  const common = [5];
  assert.deepEqual(D.resolveBulkDays({ common, initial: [5], custom: [], existing: [5] }), [5]);
  assert.deepEqual(D.resolveBulkDays({ common: [5], initial: [5], custom: [], existing: [0, 1, 2] }), [0, 1, 2], 'untouched common days never overwrite an individual choice');
  assert.deepEqual(D.resolveBulkDays({ common: [0, 1, 2, 3, 4], initial: [5], custom: [], existing: [5] }), [0, 1, 2, 3, 4], 'an explicit change of the common days applies to everyone');
  assert.deepEqual(D.resolveBulkDays({ common: [0, 1, 2, 3, 4], initial: [5], custom: [6], existing: [5] }), [6], 'a per-student choice in the bulk sheet wins');
  assert.deepEqual(D.resolveBulkDays({ common: [5], initial: [5], custom: [], existing: null }), [5], 'a student with no Sard phase yet gets the common days');
});

test('days come back sorted, unique and limited to 0-6', () => {
  assert.deepEqual(D.resolveBulkDays({ common: [5, 0, 5, 9, -1], initial: [], custom: [], existing: null }), [0, 5]);
});

test('Sard pace: the card measures the Sard phase itself (its target and its scheduled days), not the month of Hifz', () => {
  // 8 scheduled days, none done, first day: nothing is due yet, so the student is on track
  assert.deepEqual(D.sardPace({ target: 25, completed: 0, scheduledDays: 8, remainingDays: 8 }), { expected: 0, behind: 0, ahead: 0, health: 'green' });
  // 4 of 8 days passed: 12.5 pages were due
  assert.deepEqual(D.sardPace({ target: 25, completed: 12.5, scheduledDays: 8, remainingDays: 4 }), { expected: 12.5, behind: 0, ahead: 0, health: 'green' });
  assert.equal(D.sardPace({ target: 25, completed: 0, scheduledDays: 8, remainingDays: 4 }).health, 'red');
  assert.equal(D.sardPace({ target: 25, completed: 10, scheduledDays: 8, remainingDays: 4 }).health, 'yellow', '10 of 12.5 due = 80%');
  const fast = D.sardPace({ target: 25, completed: 15, scheduledDays: 8, remainingDays: 4 });
  assert.equal(fast.health, 'blue'); assert.equal(fast.ahead, 2.5);
  assert.deepEqual(D.sardPace({ target: null, completed: 3, scheduledDays: 0, remainingDays: 0 }), { expected: 0, behind: 0, ahead: 0, health: 'green' });
});

test('server errors about the plan phases are explained in Arabic', () => {
  const m = D.friendlyPlanError('RC11.2: smart plan phases may not overlap');
  assert.ok(m.includes('تتداخل') && !m.includes('RC11'));
  assert.ok(D.friendlyPlanError('RC11.3: Sard must start after Hifz for plan 1').includes('بعد'));
  assert.ok(D.friendlyPlanError('RC11.3: invalid Hifz date range for plan 1').includes('الحفظ'));
  assert.ok(D.friendlyPlanError('RC11.3: invalid Sard date range for plan 1').includes('السرد'));
  assert.equal(D.friendlyPlanError('أي خطأ آخر'), 'أي خطأ آخر');
  assert.equal(D.friendlyPlanError(''), 'تعذر تنفيذ العملية');
});
