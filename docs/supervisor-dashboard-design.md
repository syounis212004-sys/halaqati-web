# Supervisor web redesign

User request: redesign the supervisor screen shown in the screenshot, repair avatar placement and inconsistent Arabic text, modernize icons/menus, and publish the updated Web version. Existing setup PRs and Android remain independent.

Design decision: preserve Halaqati emerald/gold identity and Cairo. Use a contained profile/welcome header, a compact daily summary, three legible statistics, a neutral attention panel with amber/red used for status only, and clear circle cards with stable actions. Use a consistent set of small outline SVG icons; no new dependency. Modernize supervisor-only navigation with explicit labels and a grouped drawer. Keep the current data queries, role authorization and action handlers.

Alternatives considered: a CSS-only patch would repair clipping but keep fragmented hierarchy; a full application-shell rewrite would affect unrelated roles. Selected: supervisor-specific dashboard markup and scoped styling, with small navigation changes gated by supervisor role.

Acceptance: photo/fallback stays inside the welcome card; long Arabic names and labels wrap without one-letter buttons or horizontal overflow; all actions retain existing handlers; three status states and empty data render correctly; phone/tablet/desktop and dark mode work; other roles retain existing markup. Data/network tests use synthetic fixtures and block remote traffic.

Plan: (1) capture the existing supervisor fixture and failing geometry checks; (2) implement role-scoped dashboard and shell; (3) run targeted behavior/geometry/a11y and existing relevant browser checks plus production build; (4) package Web-only release with rollback ZIP and source provenance; (5) push an independent feature branch, request approval for the feature PR merge required by the main-only Pages policy, then publish and verify served asset hashes. Do not merge the setup PRs or modify the Android APK/update manifest.


## Verification and release

- Source base: `c1d76348c5de1ea41d8b5e26b252f966b79a35ef` (GitHub `main`).
- Web package: `2.90.3-web.1`; deployable archive: `Halaqati-v2.90.3-web.zip`.
- Archive SHA-256: `5ebd26cc3b64106de2d3874af6148a4d29a918a461d6193133384e1ceec9fc42`; all 109 files match `web-src/dist` byte for byte.
- Production build, legacy syntax checks and changed-source ESLint passed.
- Six focused unit tests passed, including escaped teacher names and unchanged action arguments.
- Playwright passed at 360, 390, 768, 1024 and 1440px: contained fallback/photo, long Arabic names, no horizontal overflow, 200% text, authorized menu coverage, existing alert/visit dialogs and role isolation.
- Ten scoped axe WCAG A/AA scans (dashboard, both themes at five widths): zero violations. This is not an audit of all existing application screens.
- Existing `check:browser` passed: navigation/responsiveness and certificate/PDF/update-guard behavior.
- Fixtures block all remote requests and use synthetic data; no production accounts or database writes are involved.
- Gitleaks 8.30.1 found no secrets in the staged feature diff. Application dependencies, Android APK/update metadata, release workflow and setup branches are unchanged.

Reproduce after `npm ci` in `web-src`: `npm run build`, `npm run preview -- --host 127.0.0.1 --port 4182`, then `BASE_URL=http://127.0.0.1:4182 npm run check:supervisor`. Set `CHROMIUM_PATH` if Chromium is installed elsewhere. Optional `AXE_MODULE` points to the installed `@axe-core/playwright` module for dashboard scans; screenshots are written to `ARTIFACTS_DIR` (default `.artifacts/supervisor`).

Before: [phone screenshot](screenshots/supervisor-before-390.png). After: [light](screenshots/supervisor-after-390.png), [dark](screenshots/supervisor-dark-390.png), [menu](screenshots/supervisor-menu-390.png). These use synthetic Arabic profile and circle data.

Publication gate: the existing GitHub Pages environment accepts only `main`. The feature PR must be explicitly approved for merging before the new ZIP can be deployed. Existing setup PRs remain separate. Keep `Halaqati-v2.90.2-web.zip` as the previous release; rollback requires an explicit reviewed revert of this feature commit (including the newer ZIP), followed by the existing Pages workflow.
