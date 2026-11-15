# Data Sync & Security

## Persistence Principle

Server-backed Supabase data is authoritative for shared circle state.

Local state may improve responsiveness, but must not become an independent source of truth for:

- completed pages
- review totals
- attendance
- plan progress
- rankings
- roles/permissions

## Cross-Device Synchronization

For a discrepancy where one device shows stale totals:

1. Confirm the write reached the database.
2. Confirm the second account/device has permission to read the new row/state.
3. Inspect query filters and date/circle/student identifiers.
4. Inspect cached queries/store invalidation.
5. Inspect aggregate calculation.
6. Verify refresh/realtime strategy.
7. Test with a clean second session.

Do not fix display totals with local arithmetic if the persisted model is wrong.

## RLS and Roles

- RLS is a security boundary, not an obstacle to bypass.
- Enforce circle membership/role/ownership in policies or trusted server functions as appropriate.
- Do not rely solely on hidden UI buttons for authorization.
- Test supervisor/teacher/guardian/student access separately when roles exist.

## Secrets

Never commit or expose:

- service-role keys
- private signing secrets
- API secrets
- keystore passwords

Frontend may use only keys intended for public client use under properly configured RLS.

## Migrations

Before applying schema changes:

- inspect current schema and existing migrations;
- understand production rows that may violate new constraints;
- make migrations rerun-safe only when intentionally designed as such;
- avoid destructive `DROP`/rewrite operations without backup/recovery awareness;
- document whether migration runs once or can be safely repeated.

## Aggregates

For totals such as pages memorized/reviewed:

- define canonical source rows;
- prevent duplicate event counting;
- avoid mixing archived/deleted/session-draft records unintentionally;
- use consistent decimal/rounding behavior across DB and UI.
