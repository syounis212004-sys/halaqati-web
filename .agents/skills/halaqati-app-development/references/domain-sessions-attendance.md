# Sessions & Attendance

## Daily Session Goal

The teacher/supervisor should be able to operate a daily session quickly without opening multiple screens per student.

A high-value daily workflow may expose, per student:

- present / absent
- memorization / recitation action
- review action
- note

Do not force deep navigation for routine actions.

## Quick Memorization

Rules for quick memorization UI:

- Use compact student rows/cards; long lists should fit efficiently on the screen.
- Do not make each student entry unnecessarily tall.
- The planned content shown for a student must come from the smart plan.
- Icons and labels must render consistently; never leave a broken/missing icon while reserving unexplained empty space.

## Attendance

The primary attendance action should remain simple:

- `حاضر`
- `غائب`

If the product needs absence classification, collect it contextually after marking absent, for example:

- غائب بعذر
- غائب بدون عذر

Do not overload the first row with multiple absence buttons if that harms scanning speed.

## Session Persistence

A session save should persist enough information to reconstruct:

- session identity/date/circle
- student attendance
- recitation/review entries
- progress quantities/pages
- notes where applicable
- points/events if scoring is affected

Derived aggregate totals displayed on a second device must not depend on local-only cache from the first device.

## Idempotency and Duplicate Protection

Where a save/retry can occur:

- avoid duplicate recitation/progress events;
- define a stable session/entry identity;
- treat network retry behavior explicitly.
