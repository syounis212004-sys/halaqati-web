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
