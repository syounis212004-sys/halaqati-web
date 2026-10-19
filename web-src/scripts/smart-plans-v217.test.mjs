import assert from 'node:assert/strict';
import test from 'node:test';
import { createSmartPlansEngine } from '../src/features/plans/engine.js';

const engine = createSmartPlansEngine();

function plan(overrides = {}) {
  return {
    id: 'plan-1',
    scope_type: 'student',
    halaqa_id: 'halaqa-1',
    student_id: 'student-1',
    plan_type: 'hifz',
    target_units: 10,
    target_pages: 10,
    start_date: '2026-08-30',
    end_date: '2026-09-03',
    schedule_weekdays: [0, 1, 2, 3, 4],
    catch_up_weekday: null,
    max_daily_multiplier: 1.5,
    auto_extend: true,
    quality_gate_enabled: true,
    minimum_evaluation: 'very_good',
    milestone_mode: 'none',
    milestone_requires_approval: true,
    delay_alert_days: 3,
    status: 'active',
    ...overrides,
  };
}

function rec({ start, end = start, evaluation = 'excellent', date = '2026-08-30', type = 'new_hifz', id = `${start}-${end}-${date}` }) {
  return {
    id,
    student_id: 'student-1',
    activity_type: type,
    start_page: start,
    end_page: end,
    pages_count: end - start + 1,
    evaluation,
    sessions: { session_date: date, halaqa_id: 'halaqa-1' },
    created_at: `${date}T12:00:00Z`,
  };
}

test('Quran selections resolve to exact Hafs page and rub boundaries', () => {
  const pages = engine.quranRangeFromSelection({ goal_unit: 'pages', start_value: 221, end_value: 240 });
  assert.equal(pages.target_pages, 20);
  assert.equal(pages.range_start_page, 221);
  assert.equal(pages.range_end_page, 240);
  assert.deepEqual([pages.range_start_surah, pages.range_start_ayah], [10, 107]);

  const rubs = engine.quranRangeFromSelection({ goal_unit: 'rub', start_value: 1, end_value: 4 });
  assert.deepEqual(rubs.selected_rubs, [1, 2, 3, 4]);
  assert.equal(rubs.range_start_page, 1);
  assert.equal(rubs.range_end_page, 11);

  const ayahs = engine.quranRangeFromSelection({ goal_unit: 'ayahs', start_surah: 18, start_ayah: 1, end_surah: 18, end_ayah: 10 });
  assert.equal(ayahs.target_units, 10);
  assert.ok(ayahs.target_pages >= 1);
  assert.throws(() => engine.quranRangeFromSelection({ goal_unit: 'ayahs', start_surah: 18, start_ayah: 10, end_surah: 18, end_ayah: 1 }), /نهاية نطاق الآيات/);
});

test('deficit is spread over remaining days and never exceeds the 150% cap', () => {
  const progress = engine.calculateProgress({ plan: plan(), studentId: 'student-1', today: '2026-09-01' });
  assert.equal(progress.originalDaily, 2);
  assert.equal(progress.deficit, 4);
  assert.equal(progress.dailyCap, 3);
  assert.equal(progress.assignment.pages, 3);
});

test('a low page rate allocates whole pages without assigning one page every day', () => {
  const slow = plan({ target_units: 2, target_pages: 2, range_start_page: 100, range_end_page: 101 });
  const recitations = [];
  const assignments = [];
  let nextPage = 100;
  for (const today of ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03']) {
    const due = engine.calculateProgress({ plan: slow, studentId: 'student-1', recitations, today }).assignment.pages;
    assignments.push(due);
    if (due) recitations.push(rec({ start: nextPage++, date: today, id: `slow-${today}` }));
  }
  assert.equal(assignments.filter(Boolean).length, 2);
  assert.equal(assignments.reduce((sum, value) => sum + value, 0), 2);
});


test('27 pages over 23 workdays counts four ordinary untagged pages and starts with one page', () => {
  const ahmadPlan = plan({
    id: 'ahmad-plan',
    target_units: 27,
    target_pages: 27,
    range_start_page: 1,
    range_end_page: 27,
    start_date: '2026-08-31',
    end_date: '2026-09-30',
    schedule_weekdays: [0, 1, 2, 3, 4],
  });
  const recitations = [
    {
      ...rec({ start: 1, end: 2, date: '2026-08-31', id: 'ahmad-1-2' }),
      start_page: '1.00',
      end_page: '2.00',
      pages_count: '2.00',
      selection_data: { mode: 'pages', smart_plan_id: null, smart_plan_date: null, smart_plan_type: null },
    },
    {
      ...rec({ start: 3, end: 4, date: '2026-08-31', id: 'ahmad-3-4' }),
      start_page: '3.00',
      end_page: '4.00',
      pages_count: '2.00',
      selection_data: { mode: 'pages', smart_plan_id: null, smart_plan_date: null, smart_plan_type: null },
    },
  ];
  const progress = engine.calculateProgress({
    plan: ahmadPlan,
    studentId: 'student-1',
    recitations,
    today: '2026-08-31',
  });

  assert.equal(engine.planDates(ahmadPlan).length, 23);
  assert.equal(progress.originalDaily, 1.17);
  assert.equal(progress.dailyCap, 2);
  assert.equal(progress.plannedToday, 1);
  assert.equal(progress.dailyTarget, 1);
  assert.equal(progress.assignment.pages, 0);
  assert.equal(progress.completedToday, 4);
  assert.equal(progress.completed, 4);
  assert.equal(progress.remaining, 23);
  assert.equal(progress.percentage, 14.8);
  assert.equal(progress.pace, 'ahead');
});

test('duplicate and out-of-range pages do not inflate smart-plan completion', () => {
  const scoped = plan({
    target_units: 4,
    target_pages: 4,
    range_start_page: 10,
    range_end_page: 13,
    start_date: '2026-08-30',
    end_date: '2026-09-03',
  });
  const progress = engine.calculateProgress({
    plan: scoped,
    studentId: 'student-1',
    recitations: [
      rec({ start: 10, end: 11, id: 'first' }),
      rec({ start: 10, end: 11, id: 'duplicate' }),
      rec({ start: 1, end: 5, id: 'outside' }),
    ],
    today: '2026-08-30',
  });
  assert.equal(progress.completed, 2);
  assert.deepEqual(progress.completedPages, [10, 11]);
});

test('unrecoverable deficit produces a safe automatic extension date', () => {
  const progress = engine.calculateProgress({
    plan: plan({ target_units: 20, target_pages: 20 }),
    studentId: 'student-1',
    today: '2026-09-03',
  });
  assert.equal(progress.originalDaily, 4);
  assert.equal(progress.dailyCap, 6);
  assert.equal(progress.assignment.pages, 6);
  assert.equal(progress.extensionNeeded, true);
  assert.ok(progress.suggestedEndDate > progress.plan.end_date);
});

test('good hifz is accepted and does not create a retry block even when the stored minimum is higher', () => {
  const scoped = plan({ target_units: 4, target_pages: 4, range_start_page: 221, range_end_page: 224, minimum_evaluation: 'excellent' });
  const progress = engine.calculateProgress({
    plan: scoped,
    studentId: 'student-1',
    recitations: [
      rec({ start: 221, end: 222, evaluation: 'good', id: 'accepted-good' }),
    ],
    today: '2026-08-31',
  });
  assert.equal(engine.isPassing(rec({ start: 221, end: 222, evaluation: 'good' }), scoped), true);
  assert.equal(progress.completed, 2);
  assert.deepEqual(progress.retryPages, []);
  assert.notEqual(progress.assignment.kind, 'tathbit');
  assert.equal(progress.assignment.blockedByRetry, false);
});

test('failed recitation blocks new memorisation and creates mandatory tathbit', () => {
  const scoped = plan({ target_units: 4, target_pages: 4, range_start_page: 221, range_end_page: 224 });
  const progress = engine.calculateProgress({
    plan: scoped,
    studentId: 'student-1',
    recitations: [
      rec({ start: 221, end: 222, evaluation: 'excellent' }),
      rec({ start: 223, end: 224, evaluation: 'repeat', id: 'failed' }),
    ],
    today: '2026-08-31',
  });
  assert.equal(progress.completed, 2);
  assert.deepEqual(progress.retryPages, [223, 224]);
  assert.equal(progress.assignment.kind, 'tathbit');
  assert.equal(progress.assignment.blockedByRetry, true);
  assert.deepEqual(progress.assignment.retryRanges, [{ start: 223, end: 224 }]);
});

test('legacy records without an evaluation derive the same quality gate from mistakes', () => {
  const scoped = plan({ target_units: 2, target_pages: 2, range_start_page: 10, range_end_page: 11 });
  const legacy = rec({ start: 10, end: 11 });
  delete legacy.evaluation;
  legacy.mistakes = 1;
  assert.equal(engine.isPassing(legacy, scoped), true);
  legacy.mistakes = 5;
  assert.equal(engine.isPassing(legacy, scoped), false);
});

test('a later passing recitation clears the retry gate', () => {
  const scoped = plan({ target_units: 4, target_pages: 4, range_start_page: 221, range_end_page: 224 });
  const progress = engine.calculateProgress({
    plan: scoped,
    studentId: 'student-1',
    recitations: [
      rec({ start: 221, end: 222, evaluation: 'excellent' }),
      rec({ start: 223, end: 224, evaluation: 'repeat', id: 'failed' }),
      rec({ start: 223, end: 224, evaluation: 'very_good', date: '2026-08-31', id: 'retry-pass' }),
    ],
    today: '2026-08-31',
  });
  assert.equal(progress.completed, 4);
  assert.deepEqual(progress.retryPages, []);
  assert.equal(progress.assignment.blockedByRetry, false);
});

test('completed juz boundary pauses new pages for a milestone exam', () => {
  const scoped = plan({
    target_units: 30,
    target_pages: 30,
    range_start_page: 1,
    range_end_page: 30,
    milestone_mode: 'juz',
    start_date: '2026-08-01',
    end_date: '2026-09-30',
  });
  const progress = engine.calculateProgress({
    plan: scoped,
    studentId: 'student-1',
    recitations: [rec({ start: 1, end: 21 })],
    today: '2026-08-31',
  });
  assert.equal(progress.assignment.kind, 'test');
  assert.equal(progress.assignment.milestone.key, 'juz:1');
  assert.equal(progress.assignment.endPage, 21);

  const approved = engine.calculateProgress({
    plan: scoped,
    studentId: 'student-1',
    recitations: [rec({ start: 1, end: 21 })],
    events: [{ event_type: 'milestone_approved', payload: { milestone_key: 'juz:1' } }],
    today: '2026-08-31',
  });
  assert.notEqual(approved.assignment.kind, 'test');
  assert.equal(approved.nextPage, 22);
});

test('student-specific plan overrides the halaqa plan of the same type', () => {
  const student = { id: 'student-1', halaqa_id: 'halaqa-1' };
  const group = plan({ id: 'group', scope_type: 'halaqa', student_id: null, updated_at: '2026-08-20T00:00:00Z' });
  const override = plan({ id: 'override', parent_plan_id: 'group', updated_at: '2026-08-19T00:00:00Z' });
  assert.deepEqual(engine.effectivePlans([group, override], student, '2026-08-31').map(x => x.id), ['override']);
});

test('near review uses newest pages and far review rotates without overlap', () => {
  const recitations = [];
  for (let page = 1; page <= 30; page += 1) recitations.push(rec({ start: page, date: `2026-08-${String(page).padStart(2, '0')}`, id: `p${page}` }));
  const suggestion = engine.reviewSuggestions({ studentId: 'student-1', recitations, nearPages: 7, farPages: 10, today: '2026-08-31' });
  assert.deepEqual(suggestion.nearPages, [24, 25, 26, 27, 28, 29, 30]);
  assert.equal(suggestion.farPages.length, 10);
  assert.equal(suggestion.farPages.some(page => suggestion.nearPages.includes(page)), false);
});

test('catch-up day adds no new target and only carries the existing deficit', () => {
  const catchUpPlan = plan({ catch_up_weekday: 4, end_date: '2026-09-10' });
  const progress = engine.calculateProgress({ plan: catchUpPlan, studentId: 'student-1', today: '2026-09-03' });
  assert.equal(new Date('2026-09-03T00:00:00Z').getUTCDay(), 4);
  assert.ok(progress.assignment.pages > 0);
  assert.equal(progress.assignment.isCatchUp, true);
  assert.ok(progress.assignment.pages <= progress.dailyCap);
});

test('three consecutive unfinished working days make the plan red', () => {
  const progress = engine.calculateProgress({ plan: plan({ end_date: '2026-09-10' }), studentId: 'student-1', today: '2026-09-02' });
  assert.ok(progress.consecutiveMissed >= 3);
  assert.equal(progress.health, 'red');
  assert.equal(progress.paceLabel, 'متأخر');
});

test('category plan overrides halaqa plan while student plan has highest precedence', () => {
  const student = { id: 'student-1', halaqa_id: 'halaqa-1', category_id: 'cat-1' };
  const halaqa = plan({ id: 'halaqa-plan', scope_type: 'halaqa', student_id: null, updated_at: '2026-08-30T00:00:00Z' });
  const category = plan({ id: 'category-plan', scope_type: 'category', student_id: null, category_id: 'cat-1', updated_at: '2026-08-29T00:00:00Z' });
  const individual = plan({ id: 'student-plan', scope_type: 'student', student_id: 'student-1', category_id: null, updated_at: '2026-08-28T00:00:00Z' });
  assert.deepEqual(engine.effectivePlans([halaqa, category], student, '2026-08-31').map(x => x.id), ['category-plan']);
  assert.deepEqual(engine.effectivePlans([halaqa, category, individual], student, '2026-08-31').map(x => x.id), ['student-plan']);
});

test('QCF line plan counts partial pages exactly and never double-counts overlapping recitations', () => {
  const lineKeys = [
    ...Array.from({ length: 15 }, (_, i) => `604:${i + 1}`),
    ...Array.from({ length: 15 }, (_, i) => `603:${i + 1}`),
  ];
  const scoped = plan({
    id: 'line-plan',
    target_units: 2,
    target_pages: 2,
    range_start_page: 603,
    range_end_page: 604,
    settings: { memorization_line_keys: lineKeys, algorithm_version: '2.17.2' },
  });
  const firstPage = {
    ...rec({ start: 604, end: 604, id: 'line-1' }),
    selection_data: { mode: 'ayahs', qcf_line_keys: lineKeys.slice(0, 15), smart_plan_id: null },
  };
  const duplicate = {
    ...rec({ start: 604, end: 604, id: 'line-dup' }),
    selection_data: { mode: 'ayahs', qcf_line_keys: lineKeys.slice(0, 15), smart_plan_id: null },
  };
  const progress = engine.calculateProgress({ plan: scoped, studentId: 'student-1', recitations: [firstPage, duplicate], today: '2026-08-30' });
  assert.equal(progress.linePlan, true);
  assert.equal(progress.completed, 1);
  assert.equal(progress.remaining, 1);
  assert.equal(progress.nextPage, 603);
  assert.equal(progress.completedLineKeys.length, 15);
});

test('reverse line plan does not trigger a Juz 30 exam after memorising only page 604', () => {
  const lineKeys = [
    ...Array.from({ length: 15 }, (_, i) => `604:${i + 1}`),
    ...Array.from({ length: 15 }, (_, i) => `603:${i + 1}`),
  ];
  const scoped = plan({
    id: 'reverse-milestone',
    target_units: 2,
    target_pages: 2,
    range_start_page: 603,
    range_end_page: 604,
    milestone_mode: 'juz',
    settings: { memorization_line_keys: lineKeys, memorization_direction: 'reverse_surahs_forward_ayahs' },
  });
  const progress = engine.calculateProgress({
    plan: scoped,
    studentId: 'student-1',
    recitations: [{
      ...rec({ start: 604, end: 604, id: 'page-604' }),
      selection_data: { qcf_line_keys: lineKeys.slice(0, 15) },
    }],
    today: '2026-08-30',
  });
  assert.notEqual(progress.assignment.kind, 'test');
});
