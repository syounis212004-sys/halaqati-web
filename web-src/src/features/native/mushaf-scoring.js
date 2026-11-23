/* V7 recitation score (proposal, runs in shadow mode next to V6; V6 stays the saved value).
 * Same formula and grade bands as V6 (core/runtime.js computeRecitationV6) so the numbers stay comparable, but a unit is not "1 per mistake and
 * 0.5 per prompt" any more: what kind of slip it was matters. The weights below are a PROPOSAL and need the owner's approval before V7 is used for points. */
(function (root) {
  'use strict';

  var V7_WEIGHTS = Object.freeze({
    mistake: Object.freeze({ word: 1, harakah: 0.5, ayah_start: 1 }),
    prompt: Object.freeze({ word: 0.5, harakah: 0.25, ayah_start: 0.25 })
  });
  var TYPES = ['mistake', 'prompt'], KINDS = ['word', 'harakah', 'ayah_start'];

  function weightOf(weights, type, kind) {
    var custom = weights && weights[type] && Number(weights[type][kind]);
    return Number.isFinite(custom) && custom >= 0 ? custom : V7_WEIGHTS[type][kind];
  }
  function count(n) { n = Number(n); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }

  /* input: { lines: number of mushaf lines recited, marks: [{type, kind}], unmarked: {mistakes, prompts} counters raised by hand, weights? } */
  function scoreV7(input) {
    var d = input || {}, lines = Number(d.lines) || 0, buckets = {}, order = [];
    function add(type, kind, n) {
      if (TYPES.indexOf(type) === -1 || KINDS.indexOf(kind) === -1 || n <= 0) return;
      var k = type + '|' + kind;
      if (!buckets[k]) { buckets[k] = { type: type, kind: kind, count: 0, units: 0 }; order.push(k); }
      buckets[k].count += n;
    }
    (d.marks || []).forEach(function (m) { if (m) add(m.type, m.kind || 'word', 1); });
    if (d.unmarked) { add('mistake', 'word', count(d.unmarked.mistakes)); add('prompt', 'word', count(d.unmarked.prompts)); }
    var breakdown = order.map(function (k) { var b = buckets[k]; b.units = b.count * weightOf(d.weights, b.type, b.kind); return b; })
      .sort(function (a, b) { return TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind); });
    var units = breakdown.reduce(function (t, b) { return t + b.units; }, 0);
    var safety = lines > 0 ? Math.max(0, Math.min(100, 100 - (units * 15 / lines) * 20)) : 0;
    var grade = lines <= 0 ? 'not_rated' : safety >= 90 ? 'excellent' : safety >= 80 ? 'very_good' : safety >= 70 ? 'good' : 'repeat';
    return { units: units, safety: Math.round(safety * 10) / 10, grade: grade, breakdown: breakdown };
  }

  var api = { V7_WEIGHTS: V7_WEIGHTS, scoreV7: scoreV7 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HalaqatiMushafScoring = api;
})(typeof window !== 'undefined' ? window : globalThis);
