import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/features/native/students.js', import.meta.url), 'utf8');
const saveMembershipsSource = source.slice(source.indexOf('  async function saveMemberships('), source.indexOf('  NSS.edSave='));

function fixture(rows, { failRead = false, connected = true } = {}) {
  const calls = [];
  const window = { RC27: { memberships: [...rows] } };
  const db = {
    from(table) {
      assert.equal(table, 'student_halaqa_memberships');
      return {
        select: () => ({ eq: async () => failRead ? { error: new Error('Read failed') } : { data: rows } }),
        upsert: async (row) => {
          calls.push(['add', row.halaqa_id]);
          return {};
        },
        update: (patch) => ({
          eq: (column, student) => ({
            eq: async (scopeKey, scope) => {
              assert.equal(column, 'student_id');
              assert.equal(student, 'student');
              assert.equal(scopeKey, 'halaqa_id');
              assert.equal(patch.status, 'withdrawn');
              calls.push(['remove', scope]);
              return {};
            },
          }),
        }),
      };
    },
  };
  const save = vm.runInNewContext(`${saveMembershipsSource}\nsaveMemberships`, {
    window, db, online: () => connected, T: () => '2026-11-28',
  });
  return { save, calls, cache: window.RC27 };
}

test('changing one set of memberships only writes explicit edits', async () => {
  const rows = ['visible', 'unchanged', 'hidden', 'new-primary'].map((halaqa_id) => ({
    student_id: 'student', halaqa_id, status: 'active',
  }));
  const { save, calls, cache } = fixture(rows);
  await save('student', {
    hid: 'new-primary',
    orig: new Set(['visible', 'unchanged', 'new-primary']),
    sec: new Set(['unchanged', 'added']),
  });
  assert.deepEqual(calls, [['add', 'added'], ['remove', 'visible']]);
  assert.equal(cache.memberships.find((m) => m.halaqa_id === 'hidden').status, 'active');
  assert.equal(cache.memberships.find((m) => m.halaqa_id === 'new-primary').status, 'active');
  assert.equal(cache.memberships.find((m) => m.halaqa_id === 'visible').status, 'withdrawn');
});

test('a read failure cannot trigger membership writes', async () => {
  const { save, calls } = fixture([], { failRead: true });
  await assert.rejects(save('student', { hid: 'primary', orig: new Set(), sec: new Set(['added']) }), /Read failed/);
  assert.deepEqual(calls, []);
});
