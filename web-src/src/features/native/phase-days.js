/* Sard days for the bulk Hifz -> Sard sheet. The sheet must show and keep the days the students really have (their own phase),
 * and only overwrite them when the manager changes the common days or picks days for one student. Pure: no DOM, no storage. */
(function (root) {
  'use strict';
  function clean(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (d) { d = Number(d); if (d >= 0 && d <= 6 && d === Math.floor(d) && !seen[d]) { seen[d] = 1; out.push(d); } });
    return out.sort(function (a, b) { return a - b; });
  }
  function same(a, b) { a = clean(a); b = clean(b); return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
  /* the most common non-empty set among the students' own Sard days; null when nobody has one */
  function commonDays(lists) {
    var count = {}, best = null, bestN = 0;
    (lists || []).forEach(function (l) {
      var c = clean(l); if (!c.length) return;
      var k = c.join(','); count[k] = (count[k] || 0) + 1;
      if (count[k] > bestN) { bestN = count[k]; best = c; }
    });
    return best;
  }
  /* custom: days picked for this student in the sheet; existing: the student's current phase days; common/initial: the sheet's common days now / when it opened */
  function resolveBulkDays(o) {
    var custom = clean(o && o.custom), common = clean(o && o.common), existing = clean(o && o.existing);
    if (custom.length) return custom;
    if (existing.length && same(common, o && o.initial)) return existing;
    return common;
  }
  /* pace of a Sard phase against its own schedule: pages due so far = target x scheduled days already passed / scheduled days.
   * Same bands as the plan engine (ratio > 1.10 ahead, >= 0.90 on track, >= 0.75 needs attention, else needs follow-up). */
  function sardPace(pp) {
    var target = Number(pp && pp.target) || 0, done = Number(pp && pp.completed) || 0, all = Number(pp && pp.scheduledDays) || 0, rem = Number(pp && pp.remainingDays) || 0;
    var elapsed = Math.max(0, all - rem), expected = target > 0 && all > 0 ? Math.round(target * elapsed / all * 100) / 100 : 0;
    if (!(expected > 0.001)) return { expected: 0, behind: 0, ahead: 0, health: 'green' };
    var ratio = done / expected, behind = Math.max(0, Math.round((expected - done) * 100) / 100), ahead = Math.max(0, Math.round((done - expected) * 100) / 100);
    var health = ratio > 1.10 ? 'blue' : ratio >= 0.90 ? 'green' : ratio >= 0.75 ? 'yellow' : 'red';
    return { expected: expected, behind: ratio >= 0.90 && ratio <= 1.10 ? 0 : behind, ahead: ratio > 1.10 ? ahead : 0, health: health };
  }
  var api = { sardPace: sardPace, commonDays: commonDays, resolveBulkDays: resolveBulkDays, sameDays: same, cleanDays: clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HalaqatiPhaseDays = api;
})(typeof window !== 'undefined' ? window : globalThis);
