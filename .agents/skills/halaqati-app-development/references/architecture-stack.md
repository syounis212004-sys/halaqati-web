# Architecture & Stack

## Current Known Stack

Treat these as the current baseline until the repository proves otherwise:

- Frontend: Vite-based web application.
- Android packaging/runtime: Capacitor.
- Backend/data/auth: Supabase / PostgreSQL.
- Source control and CI: GitHub + GitHub Actions.
- Web distribution: web/PWA flow; exact current host/deploy mechanism must be inspected in the repository/workflow before changes.

Do not assume framework/library versions. Read `package.json`, lockfile, Capacitor config, Supabase migrations, and workflow files first.

## Architectural Priorities

1. Shared business logic should not diverge between Web and Android without a platform reason.
2. Platform-specific behavior should be isolated behind clear boundaries.
3. Persisted progress is server-backed; device state is not authoritative.
4. Derived counters should be reproducible from persisted records or a clearly defined aggregate source.
5. Migrations are versioned and safe for existing production data.

## Repository Inspection Checklist

Before a significant update, locate:

- `package.json` and lockfile
- `src/` entry points and routing
- state/store/query layer
- Supabase client setup
- migration folder / SQL migration files
- Capacitor configuration and Android directory if present
- `.github/workflows/`
- web build/export/publish scripts
- test framework/configuration

## Dependency Policy

- Prefer existing libraries before adding a new dependency.
- Do not add large UI/state packages for a one-component problem.
- Check bundle and native implications of new dependencies.
- Pin/update dependencies deliberately; do not mix broad dependency upgrades into an unrelated feature fix.
