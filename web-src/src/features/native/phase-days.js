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
  var api = { commonDays: commonDays, resolveBulkDays: resolveBulkDays, sameDays: same, cleanDays: clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HalaqatiPhaseDays = api;
})(typeof window !== 'undefined' ? window : globalThis);
