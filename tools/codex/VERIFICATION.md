# Web environment verification — 2026-11-15 UTC

Repository: https://github.com/syounis212004-sys/halaqati-web

Application source tested: `c1d76348c5de1ea41d8b5e26b252f966b79a35ef`.
Setup branch: `chore/codex-development-environment`. Application source and its lockfile
are unchanged. Both repositories were cloned and accessed in one Cloud task.

| Check | Status | Evidence |
|---|---|---|
| Connected GitHub access and permissions | PASS | API reported read/push/admin; GitHub CLI authenticated; HTTPS clone and ls-remote succeeded |
| Independent checkout, branch, file reading/editing | PASS | Separate Git root and origin; setup branch created; disposable file read/write probe |
| Dependency installation | PASS | Existing web-src lockfile installed by npm ci; repeated bootstrap completed |
| Production build | PASS | npm --prefix web-src run build; Vite 8.2.2, offline/PWA output and Pages fallback generated |
| JavaScript syntax | PASS | Existing check:legacy command |
| Application unit tests | FAIL | 89 tests: 84 passed, 5 failed (two smart-plan extension-date assertions; three view harness navigator errors) |
| Application ESLint | FAIL | Existing unreachable code at web-src/src/features/plans/runtime.js:333; classic and ES module parsing configured separately |
| Existing browser parity/behavior | PASS | check:browser; five widths, roles, navigation, certificate/PDF idempotency, void protection and update guards |
| New responsive/theme screenshots | PASS | Ten login captures, Arabic RTL/no overflow, 360/390/768/1024/1440px, light/dark |
| WCAG AA browser scan | FAIL | aria-hidden-focus on #drawer at 360/390/768px; desktop widths passed; new suite totals 12 passed / 3 failed |
| Pixel regression comparison | NOT AVAILABLE | Configured but no reviewed screenshot baseline; capture is not comparison |
| Local SQL parsing | PASS | pglast parsed 23 SQL files; no database connection or migration execution |
| Shared design-token comparison | PASS | All 28 current Android JSON/Web CSS tokens match |
| Tooling lint/Prettier and script/config checks | PASS | ESLint, Prettier, Python compilation, bash syntax and TOML parsing |
| Codex skill installation | PASS | 15 complete SKILL.md entry points and declared support files; UI/UX search executes; 39 UI/UX core tests passed |
| Playwright MCP | PASS | Actual stdio initialize/tools-list/navigation/snapshot; 38 tools; CLI registration verified |
| Connected Supabase/Figma | PASS | Read-only project/table metadata and Figma account identity; no data/file mutations |
| Optional standalone remote MCP authentication | NOT AVAILABLE | CLI entries disabled until independently enabled/authenticated; current connected plugins already work |
| Dependency audit | FAIL | Application: 19 advisories (3 low, 8 moderate, 4 high, 4 critical); setup tooling: zero |
| New GitHub workflow static validation | PASS | actionlint 1.7.12; PR-only/manual checks, contents:read, no deployment |
| GitHub-hosted workflow execution | NOT AVAILABLE | Branch has not been pushed; approval required |
| PR preparation | PASS | Local PR body generated separately; no remote branch or PR created |
| Push/merge | NOT AVAILABLE | Awaiting the user's explicit approval, as requested |
| Published reusable Cloud snapshot | NOT AVAILABLE | Task has no source configuration ID and no draft/publish tool; bootstrap and workspace scripts provide the portable alternative |

The failing application tests, lint findings, accessibility issue and dependency advisories
are preserved for separate scoped fixes. No tests/rules were disabled to hide failures.
Two incomplete legacy animation skill packages were excluded from Codex discovery because
of absent helper scripts; original Android .claude content remains intact. Accessibility
and performance guidance is present in the installed frontend/performance skills.

See README.md for tools, integration boundaries, future-task commands and persistence;
see UI-QA.md for visual baselines and Android device verification.
