# Skill Routing

This file maps Halaqati tasks to supporting skills from the user's supplied skill libraries. The Halaqati product contract remains authoritative for domain behavior.

## UI / Figma

Use when relevant:

- `ui-ux-pro-max` — primary UI/UX design intelligence and design-system guidance.
- `figma-use` — mandatory rules before Figma manipulation.
- `figma-implement-design` — implement Figma design in code.
- `figma-generate-design` — create/edit Figma design from app/page intent.
- `figma-generate-library` — create/update design system in Figma.
- `frontend-ui-engineering` — production-quality frontend implementation.
- `mobile-app-design` — mobile UX heuristics when full source is available.
- localization/UX-writing skills — Arabic/RTL microcopy and localization when available.

Avoid running multiple generic design skills as equal authorities. Use one primary design direction, then specialized checks.

## Feature Planning

- `spec-driven-development`
- `planning-and-task-breakdown` when available
- `incremental-implementation`

## Debugging

Primary:

- `systematic-debugging`

Supporting:

- `debugging-and-error-recovery`
- `verification-before-completion`

Do not jump to generic refactoring before root cause.

## Testing

- `test-driven-development`
- `browser-testing-with-devtools`
- OpenAI frontend testing/debugging or Playwright skill when available
- `verification-before-completion`

## Review / Quality

- `code-review-and-quality`
- code simplification skill only after correctness is established

## Security

- `security-and-hardening`
- OpenAI `security-best-practices`

For Supabase-specific work, also follow Supabase tool/skill rules and inspect RLS.

## Performance

- `performance-optimization`

Measure first; do not apply generic optimization recipes blindly.

## Interfaces / Data

- `api-and-interface-design`
- `observability-and-instrumentation`

## Git / CI / Release

- `git-workflow-and-versioning`
- `ci-cd-and-automation`
- `gh-fix-ci` for GitHub Actions failures when available
- `shipping-and-launch`

## Conflict Resolution Example

If a generic UI skill suggests a third navigation category that maps to a new student track, reject that product-level change because Halaqati currently has exactly two tracks unless the user explicitly changes the model.
