import {
  findAyahIdBySurah,
  findPage,
  getJuzMeta,
  getPageMeta,
  getRubAlHizbMeta,
  getSurahMeta,
} from 'quran-meta/hafs';

const DAY_MS = 86400000;
const EVALUATION_RANK = Object.freeze({
  repeat: 0,
  weak: 0,
  good: 2,
  very_good: 3,
  excellent: 4,
});

const TYPE_ACTIVITIES = Object.freeze({
  hifz: new Set(['new_hifz', 'hifz']),
  review: new Set(['review', 'review_near', 'review_far']),
  sard: new Set(['sard', 'test']),
  tathbit: new Set(['tathbit', 'review_far']),
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function dateValue(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function parseDate(value) {
  const text = dateValue(value);
  return text ? new Date(`${text}T00:00:00Z`) : null;
}

function formatDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

function addDays(value, days) {
  const date = parseDate(value);
  if (!date) return '';
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return formatDate(date);
}

function compareDate(a, b) {
  return dateValue(a).localeCompare(dateValue(b));
}

function weekday(value) {
  return parseDate(value)?.getUTCDay() ?? -1;
}

function datesBetween(start, end) {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to || from > to) return [];
  const result = [];
  for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += DAY_MS) {
    result.push(formatDate(new Date(cursor)));
  }
  return result;
}

function safeObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function uniqueNumbers(values, minimum, maximum) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= minimum && value <= maximum))]
    .sort((a, b) => a - b);
}

function normalizePlan(input = {}) {
  const rangeStart = Number(input.range_start_page) || null;
  const rangeEnd = Number(input.range_end_page) || null;
  const exactPages = rangeStart && rangeEnd && rangeEnd >= rangeStart
    ? rangeEnd - rangeStart + 1
    : null;
  const schedule = uniqueNumbers(input.schedule_weekdays?.length ? input.schedule_weekdays : [0, 1, 2, 3, 4], 0, 6);
  const catchUp = input.catch_up_weekday === null || input.catch_up_weekday === undefined || input.catch_up_weekday === ''
    ? null
    : clamp(input.catch_up_weekday, 0, 6);
  return {
    ...input,
    scope_type: ['student', 'category', 'halaqa'].includes(input.scope_type) ? input.scope_type : 'student',
    plan_type: ['hifz', 'review', 'sard', 'tathbit'].includes(input.plan_type) ? input.plan_type : 'hifz',
    review_tier: ['near', 'far', 'both'].includes(input.review_tier) ? input.review_tier : 'none',
    goal_unit: ['pages', 'juz', 'surah', 'rub', 'ayahs'].includes(input.goal_unit) ? input.goal_unit : 'pages',
    target_units: Math.max(0.01, Number(input.target_units) || exactPages || 1),
    target_pages: Math.max(0.01, Number(input.target_pages) || exactPages || 1),
    start_date: dateValue(input.start_date),
    end_date: dateValue(input.end_date),
    schedule_weekdays: schedule.length ? schedule : [0, 1, 2, 3, 4],
    catch_up_weekday: catchUp,
    max_daily_multiplier: clamp(input.max_daily_multiplier || 1.5, 1, 3),
    auto_extend: input.auto_extend !== false,
    quality_gate_enabled: input.quality_gate_enabled !== false,
    minimum_evaluation: EVALUATION_RANK[input.minimum_evaluation] === undefined ? 'very_good' : input.minimum_evaluation,
    range_start_page: rangeStart,
    range_end_page: rangeEnd,
    near_revision_pages: clamp(input.near_revision_pages ?? 7, 0, 30),
    far_revision_pages: clamp(input.far_revision_pages ?? 20, 0, 604),
    milestone_mode: ['none', 'hizb', 'juz'].includes(input.milestone_mode) ? input.milestone_mode : 'juz',
    milestone_requires_approval: input.milestone_requires_approval !== false,
    delay_alert_days: clamp(input.delay_alert_days || 3, 1, 30),
    category_id: input.category_id || null,
    settings: safeObject(input.settings),
    status: input.status || 'active',
  };
}

function dateInside(value, start, end) {
  const d=dateValue(value),a=dateValue(start),b=dateValue(end);
  return !!d && !!a && !!b && compareDate(d,a)>=0 && compareDate(d,b)<=0;
}

function planPauseReason(planInput,value){
  const plan=normalizePlan(planInput);
  for(const item of Array.isArray(plan.settings?.pause_ranges)?plan.settings.pause_ranges:[]){
    if(dateInside(value,item?.from,item?.to)) return String(item?.reason||'pause');
  }
  return '';
}

function isIntensiveSardDay(planInput,value){
  const plan=normalizePlan(planInput),s=plan.settings||{};
  if(plan.plan_type!=='sard'||!s.intensive_week_from||!s.intensive_week_to||!dateInside(value,s.intensive_week_from,s.intensive_week_to))return false;
  const days=uniqueNumbers(Array.isArray(s.intensive_weekdays)?s.intensive_weekdays:[0,1,2,3,4,5],0,6);
  return days.includes(weekday(value));
}

function isRegularPlanDay(planInput, value) {
  const plan=normalizePlan(planInput);
  if(planPauseReason(plan,value))return false;
  const day = weekday(value);
  if(isIntensiveSardDay(plan,value))return day!==plan.catch_up_weekday;
  return plan.schedule_weekdays.includes(day) && day !== plan.catch_up_weekday;
}


function isCatchUpDay(plan, value) {
  return plan.catch_up_weekday !== null && weekday(value) === plan.catch_up_weekday;
}

function planDates(planInput, from = '', to = '') {
  const plan = normalizePlan(planInput);
  const start = from && compareDate(from, plan.start_date) > 0 ? dateValue(from) : plan.start_date;
  const end = to && compareDate(to, plan.end_date) < 0 ? dateValue(to) : plan.end_date;
  return datesBetween(start, end).filter((value) => isRegularPlanDay(plan, value));
}

function recordDate(record, sessionMap = new Map()) {
  const nested = Array.isArray(record?.sessions) ? record.sessions[0] : record?.sessions;
  return dateValue(
    record?.session_date
    || nested?.session_date
    || record?.session?.session_date
    || sessionMap.get(record?.session_id)?.session_date
    || record?.created_at,
  );
}

function selectionData(record) {
  return safeObject(record?.selection_data);
}

function isPassing(record, planInput) {
  const plan = normalizePlan(planInput);
  let evaluation = String(record?.evaluation || '').toLowerCase();
  if (!evaluation || evaluation === 'not_rated') {
    const pages = Number(record?.pages_count) || 0;
    if (pages > 0) {
      const effective = Math.max(1, pages);
      const density = (Number(record?.mistakes || 0) + Number(record?.prompts || 0) * 0.25) / effective;
      const safety = Math.max(0, Math.min(100, 100 - (density * 15)));
      evaluation = safety > 85 ? 'excellent' : safety >= 75 ? 'very_good' : safety >= 70 ? 'good' : 'repeat';
    }
  }
  if (evaluation === 'repeat' || evaluation === 'weak' || evaluation === 'إعادة' || evaluation === 'ضعيف') return false;
  // v2.42 V6: every accepted Quran result (good / very good / excellent)
  // counts as progress for hifz, sard, review and tathbit. Only repeat/weak blocks.
  if (['good', 'very_good', 'excellent'].includes(evaluation)) return true;
  if (!plan.quality_gate_enabled) return true;
  const threshold = EVALUATION_RANK[plan.minimum_evaluation] ?? EVALUATION_RANK.good;
  return (EVALUATION_RANK[evaluation] ?? -1) >= threshold;
}

function activityMatches(planInput, record) {
  const plan = normalizePlan(planInput);
  const details = selectionData(record);
  const taggedPlan = details.smart_plan_id || details.plan_id;
  if (taggedPlan && taggedPlan !== plan.id && plan.id !== '__review_source__') return false;
  if (taggedPlan === plan.id) return true;
  const activity = String(record?.activity_type || '').toLowerCase();
  return TYPE_ACTIVITIES[plan.plan_type]?.has(activity) || false;
}

function relevantRecords(planInput, studentId, records = [], sessionMap = new Map()) {
  const plan = normalizePlan(planInput);
  return records
    .filter((record) => (!studentId || record.student_id === studentId) && activityMatches(plan, record))
    .map((record) => ({ ...record, _planDate: recordDate(record, sessionMap) }))
    .filter((record) => record._planDate
      && compareDate(record._planDate, plan.start_date) >= 0
      && compareDate(record._planDate, plan.end_date) <= 0)
    .sort((a, b) => compareDate(a._planDate, b._planDate) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

function recordPageRange(record, plan) {
  let start = Number(record?.start_page);
  let end = Number(record?.end_page);
  if (!Number.isInteger(start) && Number.isInteger(end)) start = end;
  if (!Number.isInteger(end) && Number.isInteger(start)) end = start;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start > end) [start, end] = [end, start];
  if (plan.range_start_page) start = Math.max(start, plan.range_start_page);
  if (plan.range_end_page) end = Math.min(end, plan.range_end_page);
  return end >= start ? [start, end] : null;
}


function normalizeLineKey(value) {
  const match = String(value || '').match(/^(\d{1,3}):(\d{1,2})$/);
  if (!match) return '';
  const page = Number(match[1]);
  const line = Number(match[2]);
  return page >= 1 && page <= 604 && line >= 1 && line <= 15 ? `${page}:${line}` : '';
}

function planLineKeys(planInput) {
  const plan = normalizePlan(planInput);
  const raw = Array.isArray(plan.settings?.memorization_line_keys) ? plan.settings.memorization_line_keys : [];
  const seen = new Set();
  const result = [];
  for (const value of raw) {
    const key = normalizeLineKey(value);
    if (key && !seen.has(key)) { seen.add(key); result.push(key); }
  }
  return result;
}

function recordLineKeys(record) {
  const details = selectionData(record);
  const explicit = Array.isArray(details.qcf_line_keys) ? details.qcf_line_keys : [];
  const seen = new Set();
  const result = [];
  for (const value of explicit) {
    const key = normalizeLineKey(value);
    if (key && !seen.has(key)) { seen.add(key); result.push(key); }
  }
  if (result.length) return result;
  let start = Number(record?.start_page), end = Number(record?.end_page);
  if (!Number.isInteger(start) && Number.isInteger(end)) start = end;
  if (!Number.isInteger(end) && Number.isInteger(start)) end = start;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return [];
  if (start > end) [start, end] = [end, start];
  for (let page = Math.max(1, start); page <= Math.min(604, end); page += 1) {
    for (let line = 1; line <= 15; line += 1) result.push(`${page}:${line}`);
  }
  return result;
}

function lineKeysToPages(keys = []) {
  return [...new Set(keys.map((key) => Number(String(key).split(':')[0])).filter(Number.isInteger))].sort((a, b) => a - b);
}

function lineQuota(targetLines, totalDays, dayIndex) {
  return exactDailyQuota(targetLines, totalDays, dayIndex) / 15;
}

function cumulativeLineQuota(targetLines, totalDays, elapsedDays) {
  return exactCumulativeQuota(targetLines, totalDays, elapsedDays) / 15;
}

function eventAdjustment(events = []) {
  return events.reduce((total, event) => {
    const pages = Number(safeObject(event.payload).pages) || 0;
    if (event.event_type === 'manual_credit') return total + pages;
    if (event.event_type === 'manual_debit') return total - pages;
    return total;
  }, 0);
}

function buildCompletionBase(planInput, studentId, records = [], sessions = [], events = []) {
  const plan = normalizePlan(planInput);
  const sessionMap = new Map((sessions || []).map((session) => [session.id, session]));
  const relevant = relevantRecords(plan, studentId, records, sessionMap);
  const orderedLineKeys = planLineKeys(plan);
  const linePlan = orderedLineKeys.length > 0;
  const exact = Number.isInteger(plan.range_start_page) && Number.isInteger(plan.range_end_page);
  const pageState = new Map();
  const lineState = new Map();
  const dailyAmounts = new Map();
  let amount = 0;

  if (linePlan) {
    const allowed = new Set(orderedLineKeys);
    for (const record of relevant) {
      const passing = isPassing(record, plan);
      for (const key of recordLineKeys(record)) {
        if (allowed.has(key)) lineState.set(key, { passing, date: record._planDate, record });
      }
    }
    for (const [key, item] of lineState) {
      if (!item.passing) continue;
      amount += 1 / 15;
      dailyAmounts.set(item.date, (dailyAmounts.get(item.date) || 0) + (1 / 15));
    }
    const completedLineKeys = orderedLineKeys.filter((key) => lineState.get(key)?.passing);
    const retryLineKeys = orderedLineKeys.filter((key) => lineState.has(key) && !lineState.get(key)?.passing);
    let nextLineIndex = orderedLineKeys.findIndex((key) => !lineState.get(key)?.passing);
    if (nextLineIndex < 0) nextLineIndex = null;
    amount = Math.max(0, amount + eventAdjustment(events));
    return {
      amount: round(amount),
      completedPages: lineKeysToPages(completedLineKeys),
      retryPages: lineKeysToPages(retryLineKeys),
      completedLineKeys,
      retryLineKeys,
      nextLineIndex,
      nextPage: nextLineIndex === null ? null : Number(orderedLineKeys[nextLineIndex].split(':')[0]),
      dailyAmounts,
      relevant,
      pageState,
      lineState,
      linePlan: true,
      targetLines: orderedLineKeys.length,
    };
  }

  for (const record of relevant) {
    const passing = isPassing(record, plan);
    const range = recordPageRange(record, plan);
    if (exact) {
      if (!range) continue;
      for (let page = range[0]; page <= range[1]; page += 1) {
        pageState.set(page, { passing, date: record._planDate, record });
      }
      continue;
    }
    if (!passing) continue;
    const pages = Math.max(0, Number(record.pages_count) || (range ? range[1] - range[0] + 1 : 0));
    amount += pages;
    dailyAmounts.set(record._planDate, (dailyAmounts.get(record._planDate) || 0) + pages);
  }

  if (exact) {
    for (const [page, item] of pageState) {
      if (!item.passing) continue;
      amount += 1;
      dailyAmounts.set(item.date, (dailyAmounts.get(item.date) || 0) + 1);
    }
  }

  amount = Math.max(0, amount + eventAdjustment(events));
  const completedPages = exact
    ? [...pageState.entries()].filter(([, item]) => item.passing).map(([page]) => page).sort((a, b) => a - b)
    : [];
  const retryPages = exact
    ? [...pageState.entries()].filter(([, item]) => !item.passing).map(([page]) => page).sort((a, b) => a - b)
    : relevant.filter((record) => !isPassing(record, plan)).flatMap((record) => {
      const range = recordPageRange(record, plan);
      return range ? Array.from({ length: range[1] - range[0] + 1 }, (_, index) => range[0] + index) : [];
    });

  let nextPage = plan.range_start_page;
  if (exact) {
    const completed = new Set(completedPages);
    while (nextPage <= plan.range_end_page && completed.has(nextPage)) nextPage += 1;
    if (nextPage > plan.range_end_page) nextPage = null;
  }

  return { amount, completedPages, retryPages: [...new Set(retryPages)], completedLineKeys: [], retryLineKeys: [], nextLineIndex: null, nextPage, dailyAmounts, relevant, pageState, lineState, linePlan: false, targetLines: 0 };
}


// Native RC27.7 parity: a hifz plan's completed amount is the continuous stretch from the FIRST ayah recited in the plan
// month to the LAST ayah reached along the route (15 lines per page); daily amounts are the new lines each day pushed the frontier.
const SPAN_NAS = 'reverse_surahs_forward_ayahs';
function spanPosition(surah, ayah, route) { return ((route === SPAN_NAS ? 200 - surah : surah) * 1000) + ayah; }
function spanCompletion(plan, relevant) {
  const provider = globalThis.rc27RouteLineKeys;
  if (plan.plan_type !== 'hifz' || typeof provider !== 'function') return null;
  const route = plan.settings?.route_direction || SPAN_NAS;
  const ayahLevel = relevant.filter((r) => isPassing(r, plan) && r.start_surah && r.start_ayah && r.end_surah && r.end_ayah);
  if (!ayahLevel.length) return null;
  const loc = (s, a) => ({ s: Number(s), a: Number(a) });
  let base = null;
  for (const r of ayahLevel) { const l = loc(r.start_surah, r.start_ayah); if (!base || spanPosition(l.s, l.a, route) < spanPosition(base.s, base.a, route)) base = l; }
  const daily = new Map(); const covered = new Set(); let frontier = null;
  for (const r of ayahLevel) {
    const end = loc(r.end_surah, r.end_ayah);
    if (frontier && spanPosition(end.s, end.a, route) <= spanPosition(frontier.s, frontier.a, route)) continue;
    const keys = provider(frontier || base, end, route);
    if (!keys) return null;
    const before = covered.size;
    keys.forEach((k) => covered.add(k));
    const delta = covered.size - before;
    if (delta > 0) daily.set(r._planDate, (daily.get(r._planDate) || 0) + delta / 15);
    frontier = end;
  }
  return { amount: covered.size / 15, daily };
}
function buildCompletion(planInput, studentId, records = [], sessions = [], events = []) {
  const base = buildCompletionBase(planInput, studentId, records, sessions, events);
  const plan = normalizePlan(planInput);
  const span = spanCompletion(plan, base.relevant || []);
  if (!span) return base;
  return { ...base, amount: round(Math.max(0, span.amount + eventAdjustment(events))), dailyAmounts: span.daily };
}

function approvedMilestoneKeys(events = []) {
  return new Set(events
    .filter((event) => event.event_type === 'milestone_approved')
    .map((event) => safeObject(event.payload).milestone_key)
    .filter(Boolean));
}

function milestoneRange(mode, id) {
  if (mode === 'juz') {
    const meta = getJuzMeta(id);
    return {
      key: `juz:${id}`,
      label: `اختبار الجزء ${id}`,
      startPage: findPage(...meta.first),
      endPage: findPage(...meta.last),
    };
  }
  const first = getRubAlHizbMeta(((id - 1) * 4) + 1);
  const last = getRubAlHizbMeta(id * 4);
  return {
    key: `hizb:${id}`,
    label: `اختبار الحزب ${id}`,
    startPage: findPage(...first.first),
    endPage: findPage(...last.last),
  };
}

function pendingMilestone(planInput, completion, events = []) {
  const plan = normalizePlan(planInput);
  if (!plan.milestone_requires_approval || plan.milestone_mode === 'none' || !plan.range_start_page) return null;
  const approved = approvedMilestoneKeys(events);
  const maximum = plan.milestone_mode === 'juz' ? 30 : 60;
  const orderedLines = planLineKeys(plan);
  const completedLines = new Set(completion.completedLineKeys || []);
  for (let id = 1; id <= maximum; id += 1) {
    const milestone = milestoneRange(plan.milestone_mode, id);
    if (completion.linePlan) {
      // Hifz v2.17 moves from the last surahs toward Al-Baqarah.  Therefore the
      // milestone is reached at the *lower* page boundary, not the conventional
      // endPage used by ascending page plans.  Requiring every planned QCF line
      // in the milestone range prevents an early test after memorising page 604.
      const required = orderedLines.filter((key) => {
        const page = Number(String(key).split(':')[0]);
        return page >= milestone.startPage && page <= milestone.endPage;
      });
      const reachesReverseBoundary = required.some((key) => Number(String(key).split(':')[0]) === milestone.startPage);
      const boundaryCompleted = reachesReverseBoundary && required.length > 0 && required.every((key) => completedLines.has(key));
      if (boundaryCompleted && !approved.has(milestone.key)) {
        return {
          ...milestone,
          startPage: Math.max(milestone.startPage, plan.range_start_page),
          endPage: Math.min(milestone.endPage, plan.range_end_page),
        };
      }
      continue;
    }
    if (milestone.endPage < plan.range_start_page || milestone.endPage > plan.range_end_page) continue;
    const boundaryCompleted = completion.completedPages.includes(milestone.endPage);
    if (boundaryCompleted && !approved.has(milestone.key)) {
      return {
        ...milestone,
        startPage: Math.max(milestone.startPage, plan.range_start_page),
        endPage: Math.min(milestone.endPage, plan.range_end_page),
      };
    }
  }
  return null;
}

function compressPages(pages = []) {
  const sorted = [...new Set(pages.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  const ranges = [];
  for (const page of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && page === last.end + 1) last.end = page;
    else ranges.push({ start: page, end: page });
  }
  return ranges;
}


function exactDailyQuota(targetPages, totalDays, dayIndex) {
  const target = Math.max(0, Math.round(Number(targetPages) || 0));
  const days = Math.max(1, Math.trunc(Number(totalDays) || 1));
  const index = Math.max(0, Math.min(days - 1, Math.trunc(Number(dayIndex) || 0)));
  const before = Math.round((index * target) / days);
  const through = Math.round(((index + 1) * target) / days);
  return Math.max(0, through - before);
}

function exactCumulativeQuota(targetPages, totalDays, elapsedDays) {
  const target = Math.max(0, Math.round(Number(targetPages) || 0));
  const days = Math.max(1, Math.trunc(Number(totalDays) || 1));
  const elapsed = Math.max(0, Math.min(days, Math.trunc(Number(elapsedDays) || 0)));
  return Math.max(0, Math.min(target, Math.round((elapsed * target) / days)));
}

function extendEndDate(planInput, pagesNeeded, dailyCapacity) {
  const plan = normalizePlan(planInput);
  if (!plan.auto_extend || pagesNeeded <= 0 || dailyCapacity <= 0) return plan.end_date;
  let remaining = pagesNeeded;
  let cursor = plan.end_date;
  let guard = 0;
  while (remaining > 0 && guard < 730) {
    cursor = addDays(cursor, 1);
    if (isRegularPlanDay(plan, cursor)) remaining -= dailyCapacity;
    guard += 1;
  }
  return cursor;
}

function calculateConsecutiveMissed(planInput, dailyAmounts, currentDate, baseDaily) {
  const plan = normalizePlan(planInput);
  const allDates = planDates(plan);
  const totalDays = Math.max(1, allDates.length);
  const priorDates = allDates.filter((date) => compareDate(date, currentDate) < 0).reverse();
  const lines = planLineKeys(plan);
  const exactLines = lines.length > 0;
  const exactPages = !exactLines && Number.isInteger(plan.range_start_page) && Number.isInteger(plan.range_end_page);
  let missed = 0;
  for (const date of priorDates) {
    const index = allDates.indexOf(date);
    const expected = exactLines
      ? lineQuota(lines.length, totalDays, index)
      : exactPages
        ? exactDailyQuota(plan.target_pages, totalDays, index)
        : baseDaily;
    const customMinimumDaily = plan.plan_type === 'hifz' && plan.settings?.minimum_daily_mode === 'custom'
      ? Math.max(0, Number(plan.settings?.minimum_daily_pages || 0))
      : 0;
    const expectedWithFloor = Math.max(expected, customMinimumDaily);
    if (expectedWithFloor <= 0) continue;
    const amount = dailyAmounts.get(date) || 0;
    if (amount + 0.001 < expectedWithFloor) missed += 1;
    else break;
  }
  return missed;
}

function statusFromRatio(ratio) {
  // native SmartPlanHealthRules (RC19): blue / green / yellow / red bands against what was due by today
  const r = Math.max(0, ratio);
  if (r > 1.10) return { health: 'blue', healthLabel: 'متقدم', pace: 'ahead', paceLabel: 'متقدم' };
  if (r >= 0.90) return { health: 'green', healthLabel: 'على المسار', pace: 'on_track', paceLabel: 'ملتزم' };
  if (r >= 0.75) return { health: 'yellow', healthLabel: 'يحتاج انتباه', pace: 'behind', paceLabel: 'متأخر' };
  return { health: 'red', healthLabel: 'يحتاج متابعة', pace: 'behind', paceLabel: 'متأخر' };
}

function calculateProgress({
  plan: input,
  studentId,
  recitations = [],
  sessions = [],
  events = [],
  today = formatDate(new Date()),
} = {}) {
  const plan = normalizePlan(input);
  const currentDate = dateValue(today) || formatDate(new Date());
  const allScheduleDates = planDates(plan);
  const totalDays = Math.max(1, allScheduleDates.length);
  const lineKeys = planLineKeys(plan);
  const linePlan = lineKeys.length > 0;
  const originalDaily = plan.target_pages / totalDays;
  const exactPagePlan = !linePlan && Number.isInteger(plan.range_start_page) && Number.isInteger(plan.range_end_page);
  const completion = buildCompletion(plan, studentId, recitations, sessions, events);

  const elapsedDates = allScheduleDates.filter((date) => compareDate(date, currentDate) <= 0);
  const priorDates = allScheduleDates.filter((date) => compareDate(date, currentDate) < 0);
  const completedBeforeToday = [...completion.dailyAmounts.entries()]
    .filter(([date]) => compareDate(date, currentDate) < 0)
    .reduce((sum, [, amount]) => sum + amount, 0);

  let plannedBeforeToday = Math.min(
    plan.target_pages,
    linePlan
      ? cumulativeLineQuota(lineKeys.length, totalDays, priorDates.length)
      : exactPagePlan
        ? exactCumulativeQuota(plan.target_pages, totalDays, priorDates.length)
        : priorDates.length * originalDaily,
  );
  let expectedByNow = Math.min(
    plan.target_pages,
    linePlan
      ? cumulativeLineQuota(lineKeys.length, totalDays, elapsedDates.length)
      : exactPagePlan
        ? exactCumulativeQuota(plan.target_pages, totalDays, elapsedDates.length)
        : elapsedDates.length * originalDaily,
  );

  // v2.18.2: the normal hifz minimum is the student's own plan pace.
  // For line-based plans this can naturally be 0.5 page/day (or any exact
  // 15-line fraction) instead of the old hard-coded 1 page floor.
  const dynamicDailyMinimum = plan.plan_type === 'hifz'
    ? round(linePlan ? (lineKeys.length / 15) / totalDays : originalDaily)
    : 0;
  const customMinimumDaily = plan.plan_type === 'hifz' && plan.settings?.minimum_daily_mode === 'custom'
    ? Math.max(0, Number(plan.settings?.minimum_daily_pages || 0))
    : 0;
  const minimumDaily = customMinimumDaily || dynamicDailyMinimum;
  if (customMinimumDaily > 0) {
    plannedBeforeToday = Math.max(plannedBeforeToday, Math.min(plan.target_pages, priorDates.length * customMinimumDaily));
    expectedByNow = Math.max(expectedByNow, Math.min(plan.target_pages, elapsedDates.length * customMinimumDaily));
  }
  const deficit = Math.max(0, plannedBeforeToday - completedBeforeToday);
  const remaining = Math.max(0, plan.target_pages - completion.amount);
  const completedToday = round(completion.dailyAmounts.get(currentDate) || 0);
  const futureRegularDates = allScheduleDates.filter((date) => compareDate(date, currentDate) >= 0);
  let dailyCap = linePlan
    ? Math.max(1, Math.ceil((lineKeys.length / totalDays) * plan.max_daily_multiplier)) / 15
    : exactPagePlan
      ? Math.max(1, Math.ceil(originalDaily * plan.max_daily_multiplier))
      : originalDaily * plan.max_daily_multiplier;
  if (customMinimumDaily > 0) dailyCap = Math.max(dailyCap, customMinimumDaily);

  let dueToday = 0;
  let plannedToday = 0;
  let recoveryShare = 0;
  if (compareDate(currentDate, plan.start_date) >= 0 && compareDate(currentDate, plan.end_date) <= 0) {
    if (isRegularPlanDay(plan, currentDate)) {
      const index = allScheduleDates.indexOf(currentDate);
      plannedToday = linePlan && index >= 0
        ? lineQuota(lineKeys.length, totalDays, index)
        : exactPagePlan && index >= 0
          ? exactDailyQuota(plan.target_pages, totalDays, index)
          : originalDaily;
      if (customMinimumDaily > 0) plannedToday = Math.max(plannedToday, Math.min(customMinimumDaily, remaining + completedToday));

      if (linePlan) {
        const remainingDays = Math.max(1, futureRegularDates.length);
        const recoveryNeed = Math.ceil((deficit * 15) / remainingDays) / 15;
        const recoveryRoom = Math.max(0, dailyCap - plannedToday);
        recoveryShare = Math.min(recoveryRoom, recoveryNeed);
        dueToday = plannedToday + recoveryShare;
      } else if (exactPagePlan) {
        const remainingDays = Math.max(1, futureRegularDates.length);
        const recoveryNeed = Math.ceil(deficit / remainingDays);
        const recoveryRoom = Math.max(0, dailyCap - plannedToday);
        recoveryShare = Math.min(recoveryRoom, recoveryNeed);
        dueToday = plannedToday + recoveryShare;
      } else {
        recoveryShare = deficit / Math.max(1, futureRegularDates.length);
        dueToday = plannedToday + recoveryShare;
      }
    } else if (isCatchUpDay(plan, currentDate)) {
      recoveryShare = Math.min(deficit, dailyCap);
      dueToday = recoveryShare;
    }
  }

  const dailyTarget = linePlan
    ? Math.max(0, Math.min(remaining + completedToday, dailyCap, Math.ceil(dueToday * 15) / 15))
    : exactPagePlan
      ? Math.max(0, Math.min(remaining + completedToday, dailyCap, Math.round(dueToday)))
      : round(Math.min(remaining + completedToday, dailyCap, dueToday));
  dueToday = linePlan
    ? round(Math.max(0, Math.min(remaining, Math.ceil((dailyTarget - completedToday) * 15) / 15)))
    : exactPagePlan
      ? Math.max(0, Math.min(remaining, Math.round(dailyTarget - completedToday)))
      : round(Math.max(0, Math.min(remaining, dailyTarget - completedToday)));

  const ratio = expectedByNow > 0 ? completion.amount / expectedByNow : (completion.amount > 0 ? 1.1 : 1);
  const consecutiveMissed = calculateConsecutiveMissed(plan, completion.dailyAmounts, currentDate, originalDaily);
  const status = statusFromRatio(ratio);
  const remainingCapacity = futureRegularDates.length * dailyCap;
  const uncoveredPages = Math.max(0, remaining - remainingCapacity);
  const suggestedEndDate = extendEndDate(plan, uncoveredPages, dailyCap);
  const milestone = pendingMilestone(plan, completion, events);
  const blockedByRetry = plan.plan_type === 'hifz' && (completion.retryLineKeys.length > 0 || completion.retryPages.length > 0);
  const percentage = plan.target_pages > 0 ? round((completion.amount / plan.target_pages) * 100, 1) : 0;
  let assignment = {
    kind: plan.plan_type,
    pages: dueToday,
    startPage: completion.nextPage,
    endPage: !linePlan && completion.nextPage && dueToday > 0
      ? Math.min(plan.range_end_page || 604, completion.nextPage + Math.max(1, Math.ceil(dueToday)) - 1)
      : completion.nextPage,
    isCatchUp: isCatchUpDay(plan, currentDate),
    blockedByRetry,
    milestone: null,
  };

  if (blockedByRetry) {
    const retryRanges = compressPages(completion.retryPages);
    assignment = {
      ...assignment,
      kind: 'tathbit',
      pages: linePlan ? round(completion.retryLineKeys.length / 15) : completion.retryPages.length,
      startPage: retryRanges[0]?.start || completion.nextPage || null,
      endPage: retryRanges[0]?.end || completion.nextPage || null,
      retryRanges,
    };
  } else if (milestone) {
    assignment = {
      ...assignment,
      kind: 'test',
      pages: milestone.endPage - milestone.startPage + 1,
      startPage: milestone.startPage,
      endPage: milestone.endPage,
      milestone,
    };
  }

  return {
    plan,
    studentId,
    completed: round(completion.amount),
    completedToday,
    remaining: round(remaining),
    percentage,
    originalDaily: round(originalDaily),
    plannedToday: round(plannedToday),
    dailyTarget: round(dailyTarget),
    recoveryShare: round(recoveryShare),
    dailyCap: round(dailyCap),
    plannedByToday: round(expectedByNow),
    deficit: round(deficit),
    aheadBy: round(Math.max(0, completion.amount - expectedByNow)),
    behindBy: round(Math.max(0, expectedByNow - completion.amount)),
    minimumDaily: round(minimumDaily),
    dynamicDailyMinimum: round(dynamicDailyMinimum),
    pauseReason: planPauseReason(plan,currentDate),
    intensiveSardDay: isIntensiveSardDay(plan,currentDate),
    consecutiveMissed,
    suggestedEndDate,
    extensionNeeded: suggestedEndDate !== plan.end_date,
    completedPages: completion.completedPages,
    retryPages: completion.retryPages,
    completedLineKeys: completion.completedLineKeys,
    retryLineKeys: completion.retryLineKeys,
    nextLineIndex: completion.nextLineIndex,
    nextPage: completion.nextPage,
    linePlan,
    ...status,
    assignment,
  };
}

function effectivePlans(plans = [], student = {}, value = formatDate(new Date())) {
  const currentDate = dateValue(value);
  const candidates = plans.filter((plan) => {
    const normalized = normalizePlan(plan);
    const scopeMatches = normalized.scope_type === 'halaqa'
      || (normalized.scope_type === 'category' && normalized.category_id && normalized.category_id === student.category_id)
      || (normalized.scope_type === 'student' && normalized.student_id === student.id);
    return normalized.status === 'active'
      && normalized.halaqa_id === student.halaqa_id
      && compareDate(currentDate, normalized.start_date) >= 0
      && compareDate(currentDate, normalized.end_date) <= 0
      && scopeMatches;
  });
  const types = ['hifz', 'review', 'sard', 'tathbit'];
  const priority = { halaqa: 1, category: 2, student: 3 };
  return types.map((type) => candidates
    .filter((plan) => normalizePlan(plan).plan_type === type)
    .sort((a, b) => {
      const pa = priority[normalizePlan(a).scope_type] || 0;
      const pb = priority[normalizePlan(b).scope_type] || 0;
      if (pa !== pb) return pb - pa;
      return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
    })[0]).filter(Boolean);
}

function reviewSuggestions({
  studentId,
  recitations = [],
  sessions = [],
  nearPages = 7,
  farPages = 20,
  today = formatDate(new Date()),
} = {}) {
  const syntheticPlan = normalizePlan({
    id: '__review_source__',
    plan_type: 'hifz',
    target_pages: 604,
    target_units: 604,
    start_date: '1900-01-01',
    end_date: '2999-12-31',
    quality_gate_enabled: true,
    minimum_evaluation: 'very_good',
  });
  const sessionMap = new Map((sessions || []).map((session) => [session.id, session]));
  const pageDates = new Map();
  for (const record of relevantRecords(syntheticPlan, studentId, recitations, sessionMap)) {
    if (!isPassing(record, syntheticPlan)) continue;
    const range = recordPageRange(record, syntheticPlan);
    if (!range) continue;
    for (let page = range[0]; page <= range[1]; page += 1) pageDates.set(page, record._planDate);
  }
  const recent = [...pageDates.entries()]
    .sort((a, b) => compareDate(b[1], a[1]) || b[0] - a[0])
    .slice(0, Math.ceil(nearPages))
    .map(([page]) => page);
  const recentSet = new Set(recent);
  const old = [...pageDates.keys()].filter((page) => !recentSet.has(page)).sort((a, b) => a - b);
  const epochWeeks = Math.floor((parseDate(today)?.getTime() || 0) / (DAY_MS * 7));
  const start = old.length ? epochWeeks % old.length : 0;
  const far = [];
  for (let offset = 0; offset < Math.min(Math.ceil(farPages), old.length); offset += 1) {
    far.push(old[(start + offset) % old.length]);
  }
  return {
    nearPages: recent.sort((a, b) => a - b),
    nearRanges: compressPages(recent),
    farPages: far.sort((a, b) => a - b),
    farRanges: compressPages(far),
  };
}

function quranRangeFromSelection(input = {}) {
  const unit = input.goal_unit || input.goalUnit || 'pages';
  const startValue = Number(input.start_value ?? input.startValue);
  const endValue = Number(input.end_value ?? input.endValue ?? startValue);
  let first;
  let last;
  let targetUnits;
  const result = { selected_surahs: [], selected_juz: [], selected_rubs: [] };

  if (unit === 'pages') {
    const startPage = clamp(startValue, 1, 604);
    const endPage = clamp(endValue, startPage, 604);
    first = getPageMeta(startPage).first;
    last = getPageMeta(endPage).last;
    targetUnits = endPage - startPage + 1;
  } else if (unit === 'juz') {
    const start = clamp(Math.trunc(startValue), 1, 30);
    const end = clamp(Math.trunc(endValue), start, 30);
    first = getJuzMeta(start).first;
    last = getJuzMeta(end).last;
    result.selected_juz = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    targetUnits = result.selected_juz.length;
  } else if (unit === 'rub') {
    const start = clamp(Math.trunc(startValue), 1, 240);
    const end = clamp(Math.trunc(endValue), start, 240);
    first = getRubAlHizbMeta(start).first;
    last = getRubAlHizbMeta(end).last;
    result.selected_rubs = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    targetUnits = result.selected_rubs.length;
  } else if (unit === 'surah') {
    const start = clamp(Math.trunc(startValue), 1, 114);
    const end = clamp(Math.trunc(endValue), start, 114);
    first = getSurahMeta(start).first;
    last = getSurahMeta(end).last;
    result.selected_surahs = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    targetUnits = result.selected_surahs.length;
  } else {
    const startSurah = clamp(Math.trunc(input.start_surah ?? input.startSurah), 1, 114);
    const endSurah = clamp(Math.trunc(input.end_surah ?? input.endSurah ?? startSurah), startSurah, 114);
    const startAyah = clamp(Math.trunc(input.start_ayah ?? input.startAyah), 1, getSurahMeta(startSurah).ayahCount);
    const endAyah = clamp(Math.trunc(input.end_ayah ?? input.endAyah), 1, getSurahMeta(endSurah).ayahCount);
    first = [startSurah, startAyah];
    last = [endSurah, endAyah];
    const firstAyahId = findAyahIdBySurah(...first);
    const lastAyahId = findAyahIdBySurah(...last);
    if (lastAyahId < firstAyahId) throw new RangeError('نهاية نطاق الآيات يجب أن تكون بعد بدايته');
    targetUnits = lastAyahId - firstAyahId + 1;
  }

  const startPage = findPage(...first);
  const endPage = findPage(...last);
  return {
    ...result,
    goal_unit: unit,
    target_units: targetUnits,
    target_pages: endPage - startPage + 1,
    range_start_page: startPage,
    range_end_page: endPage,
    range_start_surah: first[0],
    range_start_ayah: first[1],
    range_end_surah: last[0],
    range_end_ayah: last[1],
  };
}

export function createSmartPlansEngine() {
  return Object.freeze({
    version: '2.18.0',
    addDays,
    calculateProgress,
    compressPages,
    effectivePlans,
    isPassing,
    normalizePlan,
    planDates,
    quranRangeFromSelection,
    reviewSuggestions,
  });
}

export function installSmartPlansEngine(target = window) {
  const engine = createSmartPlansEngine();
  target.HalaqatiSmartPlansEngine = engine;
  return engine;
}
