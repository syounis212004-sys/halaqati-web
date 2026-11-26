import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemo, evaluate, recite, summary, DEMO_STUDENTS, TOTAL_PAGES } from '../src/landing/demo.js';

test('evaluation level follows the mistake count', () => {
  assert.equal(evaluate(0).key, 'excellent');
  assert.equal(evaluate(2).key, 'very_good');
  assert.equal(evaluate(4).key, 'good');
  assert.equal(evaluate(7).key, 'redo');
});

test('negative or fractional mistake input is normalised', () => {
  assert.equal(evaluate(-3).key, 'excellent');
  assert.equal(evaluate(1.9).key, 'very_good');
  assert.equal(evaluate(NaN).key, 'excellent');
});

test('a passing recitation advances memorised pages and awards points', () => {
  const d = createDemo();
  const id = DEMO_STUDENTS[0].id;
  const before = d.students[id].pages;
  const r = recite(d, { studentId: id, pages: 1.5, mistakes: 0 });
  assert.equal(r.passed, true);
  assert.equal(d.students[id].pages, before + 1.5);
  assert.ok(d.students[id].points > 0);
  assert.equal(d.log.length, 1);
});

test('a failed recitation does not advance progress and asks for repetition', () => {
  const d = createDemo();
  const id = DEMO_STUDENTS[1].id;
  const before = { ...d.students[id] };
  const r = recite(d, { studentId: id, pages: 2, mistakes: 9 });
  assert.equal(r.passed, false);
  assert.equal(d.students[id].pages, before.pages);
  assert.equal(d.students[id].points, before.points);
  assert.equal(d.log.length, 1);
});

test('progress never exceeds the mushaf total', () => {
  const d = createDemo();
  const id = DEMO_STUDENTS[0].id;
  d.students[id].pages = TOTAL_PAGES - 1;
  recite(d, { studentId: id, pages: 3, mistakes: 0 });
  assert.equal(d.students[id].pages, TOTAL_PAGES);
});

test('unknown student is rejected without touching state', () => {
  const d = createDemo();
  assert.throws(() => recite(d, { studentId: 'nope', pages: 1, mistakes: 0 }));
  assert.equal(d.log.length, 0);
});

test('demo instances are isolated from each other', () => {
  const a = createDemo(), b = createDemo();
  recite(a, { studentId: DEMO_STUDENTS[0].id, pages: 1, mistakes: 0 });
  assert.equal(b.log.length, 0);
  assert.notEqual(a.students[DEMO_STUDENTS[0].id].pages, b.students[DEMO_STUDENTS[0].id].pages);
});

test('summary aggregates the session', () => {
  const d = createDemo();
  recite(d, { studentId: DEMO_STUDENTS[0].id, pages: 1, mistakes: 0 });
  recite(d, { studentId: DEMO_STUDENTS[1].id, pages: 1, mistakes: 8 });
  const s = summary(d);
  assert.equal(s.recitations, 2);
  assert.equal(s.passed, 1);
  assert.equal(s.needRepeat, 1);
});

test('demo data is fictional and contains no Quranic wording', () => {
  const blob = JSON.stringify(DEMO_STUDENTS);
  assert.ok(!/بسم الله|الرحمن الرحيم|قل هو|الحمد لله رب/.test(blob));
  assert.ok(DEMO_STUDENTS.every((s) => s.demo === true));
});
