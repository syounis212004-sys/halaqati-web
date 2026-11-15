---
name: halaqati-app-development
description: Master development skill for the Halaqati (حلقاتي) Quran-circle management app. Use for any Halaqati UI/UX design, feature planning, coding, debugging, Supabase/database work, synchronization, Android/Web/Capacitor builds, GitHub Actions, testing, security, performance, or release work. Enforces Halaqati product invariants, RTL Arabic UX, pages-only memorization logic, two-track rules, smart-plan source-of-truth behavior, root-cause debugging, regression testing, and verified releases.
---

# Halaqati App Development

## Purpose

This skill is the primary operating contract for developing **حلقاتي (Halaqati)**. It coordinates product rules, UI/UX, engineering, database safety, debugging, QA, and releases so that improvements do not silently break stable behavior.

Use it as an **orchestrator**. Do not replace specialized skills; route to them when needed, while keeping Halaqati's product rules authoritative.

## Authority Order

When instructions conflict, use this order:

1. The user's latest explicit instruction for the current task.
2. The actual current codebase, schema, migrations, and deployed behavior after inspection.
3. This skill's Halaqati product contract and reference files.
4. Tool-specific official skills (for example Figma or GitHub instructions).
5. Specialized engineering skills (debugging, testing, security, performance, UI engineering).
6. Generic conventions and personal assumptions.

Never silently override a current user instruction with an older product rule. If the codebase and this skill disagree, identify the discrepancy before modifying behavior.

## Non-Negotiable Product Invariants

Read [references/product-contract.md](references/product-contract.md) before making domain-level changes.

At minimum, preserve these rules unless the user explicitly changes them:

- The app is **Arabic-first and RTL-first**.
- The memorization/progress model is **pages only**. Do not introduce `حزب/أحزاب` as a progress unit.
- There are **exactly two student tracks** in the current product model:
  1. `مسار الحفظ العام`
  2. `مسار التثبيت`
- Do not invent or add a third track.
- Smart-plan assignments are the source of truth for planned memorization/review. Never fabricate a student's next assignment from guessed ayah/page ranges.
- Ranking remains **points-based** unless explicitly changed. Percentage may describe labels such as ممتاز/جيد جدًا/جيد, not replace ranking logic.
- Cross-device totals and progress must derive from synchronized persisted data, not device-local state.
- Destructive account/data deletion requires explicit confirmation and must not be reversible by accidental UI action.

## Required Working Method

### 1. Inspect before changing

Before editing a feature:

- Identify the files/components/functions involved.
- Identify the persisted data and Supabase tables/RPCs/triggers involved.
- Find the existing working pattern elsewhere in the app.
- Check whether the feature is Web-only, Android/Capacitor-specific, or shared.
- Record current expected behavior before changing it.

Do not redesign or refactor unrelated working areas during a focused fix.

### 2. Classify the task

Choose one primary mode:

- **Feature / significant UX change** → spec-driven development.
- **Bug / incorrect behavior / build failure** → systematic debugging first.
- **Pure visual change** → inspect design system + UI engineering + accessibility.
- **Database/schema/sync** → data-flow analysis + security + migration safety.
- **Performance issue** → measure first, then optimize.
- **Release/build issue** → CI/CD diagnosis + reproducible verification.

See [references/skill-routing.md](references/skill-routing.md).

### 3. Define acceptance criteria

Every non-trivial change needs explicit testable outcomes. Include:

- User-visible expected behavior.
- Data/persistence expected behavior.
- Responsive/mobile behavior if UI is touched.
- Regression constraints: what must continue working.
- Verification method.

For small fixes, a short acceptance checklist is enough. Do not create process overhead for trivial text-only changes.

### 4. Implement incrementally

Prefer small vertical changes that can be verified independently.

Rules:

- Preserve stable APIs and schema unless a change is necessary.
- Prefer existing abstractions and components over duplicates.
- Avoid unrelated cleanup in a bug fix.
- For schema changes, create forward migrations and state migration assumptions clearly.
- Do not hide failures with fallback values that make bad data look valid.

### 5. Debug by root cause

For any bug, follow this rule:

> **No fix without root-cause investigation first.**

Required sequence:

1. Reproduce.
2. Trace data/state from source to UI or from workflow to failing step.
3. Compare with a working example.
4. Form one hypothesis.
5. Test the smallest possible change.
6. Fix the source of the defect.
7. Add or update a regression test where practical.
8. Verify the original scenario and neighboring scenarios.

For synchronization bugs, explicitly trace:

`database → query/RPC → transformation → store/cache → component → displayed aggregate`

and test across separate sessions/devices when the bug is cross-device.

### 6. Verify before declaring success

Never say a fix is complete only because code compiles or looks plausible.

Run the most relevant checks available:

- typecheck/lint
- unit/integration tests
- production build
- browser/E2E flow
- responsive inspection
- database query/state verification
- Android/Capacitor build for native-impacting changes
- cross-device/account test for synchronization changes

If a check cannot be performed, state exactly which one is unverified.

## UI/UX Operating Rules

Read [references/ui-ux-contract.md](references/ui-ux-contract.md) for full guidance.

Core rules:

- Arabic RTL layout is the default, not an afterthought.
- Mobile-first for the supervisor's daily workflow.
- Keep high-frequency actions reachable with minimal taps.
- Avoid oversized student rows/cards that force unnecessary scrolling.
- Use clear hierarchy and compact density for long student lists.
- Make loading, empty, error, disabled, selected, and success states explicit.
- Never rely on color alone to communicate attendance/status.
- Maintain accessible touch targets and readable contrast.
- Keep modal/bottom-sheet decisions short and contextual.
- Do not allow decorative redesign to obscure operational speed.

When Figma is involved, use the official Figma skills first and inspect existing components/tokens before creating new ones.

## Smart Plan Rules

Read [references/domain-smart-plans.md](references/domain-smart-plans.md) before modifying plan assignment, progress, ayah/page selection, absence redistribution, or plan counters.

Key rule:

> A session UI may present the planned assignment, but it must not invent it.

The persisted smart-plan engine/state is authoritative.

## Session and Attendance Rules

Read [references/domain-sessions-attendance.md](references/domain-sessions-attendance.md).

Daily workflows should optimize for fast teacher operation. Attendance should remain semantically simple at the first interaction; detailed reason can be collected contextually after marking absence.

## Data, Supabase, and Security

Read [references/data-sync-security.md](references/data-sync-security.md) before database or synchronization changes.

Never:

- weaken RLS merely to make a query work;
- expose service-role keys in frontend code;
- trust client-supplied role/ownership fields without server-side enforcement;
- silently overwrite server state with stale local state;
- run destructive migrations without understanding existing production data.

## Performance

For slow pages such as smart plans or dashboards:

1. Measure first.
2. Determine whether bottleneck is network, query, rendering, repeated fetch, computation, image loading, or state churn.
3. Optimize the bottleneck only.
4. Compare before/after behavior.

Avoid speculative memoization, caching, or pagination unless the measured problem supports it.

## Release Discipline

Read [references/qa-release.md](references/qa-release.md).

A Halaqati release should have:

- known version identifier;
- migration requirements documented;
- web build verified;
- Android/Capacitor impact verified when relevant;
- regression checklist completed for touched flows;
- no secrets embedded in workflow files;
- rollback/recovery awareness for database-impacting releases.

## Definition of Done

A change is done only when:

- Acceptance criteria are satisfied.
- The root cause is understood for bug fixes.
- Relevant persisted data is correct.
- UI states and RTL behavior are correct for touched screens.
- Relevant tests/build checks pass.
- No known regression is introduced in adjacent critical flows.
- Any required Supabase migration or GitHub Actions change is included and documented.
- The final report distinguishes **verified** from **not verified** items.

## Reference Index

Load only the references needed for the task:

- [Product Contract](references/product-contract.md)
- [Architecture & Stack](references/architecture-stack.md)
- [Smart Plans](references/domain-smart-plans.md)
- [Sessions & Attendance](references/domain-sessions-attendance.md)
- [UI/UX Contract](references/ui-ux-contract.md)
- [Data Sync & Security](references/data-sync-security.md)
- [Engineering Workflow](references/engineering-workflow.md)
- [QA & Release](references/qa-release.md)
- [Skill Routing](references/skill-routing.md)
- [Known Regression Risks](references/known-regressions.md)

## Maintenance Rule

This skill is a living product contract. When the user explicitly changes a durable Halaqati rule, update the relevant reference rather than leaving contradictory guidance scattered across conversations.
