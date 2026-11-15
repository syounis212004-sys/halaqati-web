# Smart Plans Domain Rules

## Purpose

Smart plans determine the student's planned memorization/review workload. They are a domain engine, not merely a UI convenience.

## Source of Truth

The next assignment displayed in quick memorization, daily session, student detail, or dashboard must come from the student's actual smart plan / persisted plan state.

**Never generate an assignment from arbitrary page/ayah guesses.**

Example of an invalid behavior:

- UI displays “from ayah 25” because it inferred the next number from a previous visible value while the smart plan specifies another range.

Correct behavior:

- Resolve the active plan.
- Resolve today's/next assigned segment according to plan state.
- Display that exact segment.

## Daily Minimum

The user has defined the daily minimum concept as derived from plan target and attendance days, not a universal fixed one-page minimum.

Conceptually:

`daily target = relevant target quantity / configured attendance days`

Examples previously given by the user:

- 20 pages/month across 20 attendance days → 1 page/day.
- 10 pages/month across 20 attendance days → 0.5 page/day.

Do not reintroduce a hard-coded `1 page minimum` unless explicitly requested.

## Absence Redistribution

If the plan is configured to compensate for missed attendance:

- absence affects remaining workload according to the existing plan logic;
- redistribution must update persisted plan state or deterministic derived state;
- do not double-count missed assignments;
- avoid silently changing historical completed assignments.

## Surah / Ayah Selection

Known rules:

- Within a selected surah, ayah range must move in ascending order.
- The broader memorization path may be configured in the user's direction (previously described as progressing from الناس toward البقرة).
- Do not confuse within-surah ayah ordering with global surah-path ordering.
- Quran metadata/ayah counts used for selection should remain available offline where the current product supports that behavior.

## Page and Juz Boundary Images

If the app displays Quran page imagery and one page spans a juz boundary, preserve the user's established rule that the full page image can appear in the relevant views rather than cropping data semantically at the boundary.

## Counters

Plan counters must have unambiguous definitions.

For any counter such as `completed / target`:

- document numerator source;
- document denominator source;
- define whether archived/cancelled/reassigned records count;
- make totals consistent across dashboard, plan list, student detail, and reports.

Avoid displaying internal normalization/base/ceiling values to ordinary users unless they are deliberately part of the UX.

## Archive

The existing product direction includes archived plans.

Expected capabilities:

- archive a plan intentionally;
- view archived plans;
- restore when valid;
- permanently delete only with explicit confirmation and appropriate data safety.

Archived plans must not accidentally become active assignments.
