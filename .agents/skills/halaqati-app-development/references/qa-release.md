# QA & Release

## Minimum Regression Matrix

Choose relevant rows for the release:

| Area | Verify |
|---|---|
| Authentication | login/session persists correctly |
| Circle data | correct circle/role scope |
| Students | list loads and core details are correct |
| Attendance | present/absent save and reload |
| Quick memorization | assignment comes from smart plan |
| Recitation/review | saved pages reload on another session/device where applicable |
| Smart plans | active assignment, counters, archive behavior |
| Reports | correct track separation and totals |
| Ranking | points ordering remains correct |
| RTL UI | no title/button overlap on phone |
| Web build | production build succeeds |
| Android | Capacitor/native build when touched |
| Supabase | migration/policies/queries verified when touched |

## Build Verification

Use actual repository commands. Do not invent commands when `package.json` or workflow defines them.

Typical categories:

- install
- lint
- typecheck
- test
- production web build
- Capacitor sync/build
- GitHub Actions workflow validation

## Release Notes

For each version record:

- version
- user-visible changes
- bug fixes
- migration required: yes/no + filename
- known limitations
- verification performed

## Claim Discipline

Use these labels internally/final report:

- **Verified** — actually executed/observed.
- **Code-reviewed** — inspected logically but not run.
- **Not verified** — environment/tool access did not permit execution.

Never label code-reviewed behavior as fully tested.
