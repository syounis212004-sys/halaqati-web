# Halaqati Product Contract

## Product Identity

**حلقاتي (Halaqati)** is a Quran-circle management product for day-to-day teacher/supervisor operation, student progress, memorization/review planning, attendance, reports, ranking, and parent/student-facing information where applicable.

The current product targets:

- Android through a Vite + Capacitor application flow.
- Web/PWA, including iPhone access through the web version.
- Shared persisted data through Supabase.

## Core Domain Invariants

### Progress Unit

- Use **pages** as the progress/accounting unit.
- Do not switch progress, targets, totals, statistics, or circle settings to `أحزاب`.
- Fractional pages are allowed where the product already supports them.
- Do not infer a new rounding scheme without checking existing implementation and user instruction.

### Tracks

There are currently exactly two tracks:

1. **مسار الحفظ العام** — general memorization path; may include memorization and سرد workflows according to the app's existing model.
2. **مسار التثبيت** — intended for completers / stabilization workflow.

Rules:

- Reuse the existing track records/values already present in the application.
- Do not create duplicate track values simply to satisfy UI labels.
- Reports and leaderboards should be separable by track when requested.
- Do not add a third track unless the user explicitly changes the product model.

### Ranking

- Student ranking remains **points-based** by default.
- Percentage/progress ratios may be used for descriptive labels, not silently replace points ranking.
- Any change to scoring must preserve historical data semantics or include a migration strategy.

### Student Profile Fields

Current durable preferences include:

- No unnecessary weekly-goal field when the smart-plan model supersedes it.
- Do not add student phone number fields back if removed by product decision.
- Track membership should be represented using the existing two-track model.

### Account Deletion

- Permanent account deletion must require a clear confirmation step.
- The UI must distinguish permanent deletion from ordinary logout/archive/remove-from-list actions.

## Operating Schedule

The user's current circle operating schedule has been described as:

- Sunday–Thursday: ordinary memorization.
- Friday: سرد.
- Saturday: off.

Treat this as **configurable operational context**, not a hard-coded universal rule. If the app already stores schedule settings, use those values as source of truth.

## Stable-Feature Protection

When adding a feature:

- Do not rewrite stable modules merely for stylistic consistency.
- Preserve backward compatibility where feasible.
- If a stable behavior must change, make the change explicit in acceptance criteria.
- Do not remove user data because the UI no longer displays a field unless a migration is intentionally required.

## Source-of-Truth Principle

For any domain value, use the most authoritative persisted source available:

- smart plan for planned assignment;
- session/recitation records for completed activity;
- attendance records for presence/absence;
- persisted points/events for rankings;
- database-backed roles/ownership for permissions.

The UI must not invent domain state to fill missing data.
