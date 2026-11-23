/* V7 recitation score («تقييم مقترح»): runs next to V6 in shadow mode. V6 stays the saved value. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const V = require('../src/features/native/mushaf-scoring.js');

const m = (type, kind = 'word') => ({ type, kind });
// the V6 formula from core/runtime.js, restated here so a drift in either one fails a test
const v6 = (lines, mistakes, prompts) => { const units = mistakes + prompts * 0.5; const n = lines > 0 ? units * 15 / lines : 0; return lines > 0 ? Math.max(0, Math.min(100, 100 - n * 20)) : 0; };

test('no marks on a recited page is a perfect score; no lines means not rated', () => {
  const r = V.scoreV7({ lines: 15, marks: [] });
  assert.equal(r.units, 0); assert.equal(r.safety, 100); assert.equal(r.grade, 'excellent');
  const none = V.scoreV7({ lines: 0, marks: [m('mistake')] });
  assert.equal(none.grade, 'not_rated'); assert.equal(none.safety, 0);
});

test('with only word-level marks V7 equals V6 (so scores stay comparable during the shadow period)', () => {
  for (const [lines, mi, pr] of [[15, 1, 0], [15, 0, 2], [30, 3, 4], [45, 5, 9], [15, 9, 0]]) {
    const marks = [...Array(mi).fill(m('mistake')), ...Array(pr).fill(m('prompt'))];
    assert.equal(V.scoreV7({ lines, marks }).safety, Math.round(v6(lines, mi, pr) * 10) / 10, `${lines} lines, ${mi} mistakes, ${pr} prompts`);
  }
});

test('kinds change the weight: a vowel mistake costs half a wrong word, a prompt at the start of an ayah a quarter', () => {
  assert.equal(V.scoreV7({ lines: 15, marks: [m('mistake', 'harakah')] }).units, 0.5);
  assert.equal(V.scoreV7({ lines: 15, marks: [m('prompt', 'ayah_start')] }).units, 0.25);
  assert.equal(V.scoreV7({ lines: 15, marks: [m('prompt', 'harakah')] }).units, 0.25);
  assert.equal(V.scoreV7({ lines: 15, marks: [m('mistake', 'ayah_start')] }).units, 1);
});

test('grade bands match V6 (90 / 80 / 70) and the breakdown explains the units per type and kind', () => {
  const g = (n, type) => V.scoreV7({ lines: 15, marks: Array(n).fill(m(type)) });
  assert.equal(g(1, 'prompt').grade, 'excellent');   // 0.5 unit -> 90
  assert.equal(g(1, 'mistake').grade, 'very_good');  // 1 unit -> 80
  assert.equal(g(3, 'prompt').grade, 'good');        // 1.5 units -> 70
  assert.equal(g(2, 'mistake').grade, 'repeat');     // 2 units -> 60
  const r = V.scoreV7({ lines: 15, marks: [m('mistake'), m('mistake', 'harakah'), m('prompt'), m('prompt')] });
  assert.deepEqual(r.breakdown.map(b => [b.type, b.kind, b.count, b.units]), [['mistake', 'word', 1, 1], ['mistake', 'harakah', 1, 0.5], ['prompt', 'word', 2, 1]]);
  assert.equal(r.units, 2.5);
});

test('counters raised by hand (not backed by marks) count as word-level so nothing is lost', () => {
  const r = V.scoreV7({ lines: 15, marks: [m('mistake')], unmarked: { mistakes: 1, prompts: 2 } });
  assert.equal(r.units, 3);
  assert.deepEqual(V.scoreV7({ lines: 15, marks: [], unmarked: { mistakes: -3, prompts: NaN } }).units, 0, 'bad numbers are ignored');
});

test('weights can be overridden per type and kind without touching the defaults', () => {
  const r = V.scoreV7({ lines: 15, marks: [m('mistake', 'harakah')], weights: { mistake: { harakah: 0.25 } } });
  assert.equal(r.units, 0.25);
  assert.equal(V.V7_WEIGHTS.mistake.harakah, 0.5, 'defaults are not mutated');
  assert.throws(() => { V.V7_WEIGHTS.mistake.word = 9; }, TypeError, 'defaults are frozen');
});

test('an unknown type or kind is ignored, never silently scored as something else', () => {
  assert.equal(V.scoreV7({ lines: 15, marks: [m('tajweed'), m('mistake', 'zzz'), null] }).units, 0);
});
