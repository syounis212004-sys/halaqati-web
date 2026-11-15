# Halaqati Web — agent instructions

## Scope and architecture

This Git root is `syounis212004-sys/halaqati-web`. Android lives in the independent sibling
repository `syounis212004-sys/halaqati-app`. Both have equal priority. Inspect both when
contracts change, and maintain separate Git histories, branches, commits and PRs.
Preserve existing edits and instructions before making changes.

The editable web application is **web-src/**. It uses JavaScript, Vite 8.2.x,
Capacitor 8, a classic legacy runtime and extracted feature modules. Read
`web-src/ARCHITECTURE_V212.md`: `src/main.js` loads core modules and
`src/legacy/app.js`; `src/features/` contains extracted modules. Preserve public
functions used by HTML onclick handlers while extracting features. `src/styles/`
contains theme/token CSS, `scripts/` contains Node tests/checks, and `plugins/`
contains local Capacitor plugins. Existing lockfiles are authoritative.
Root ZIP/APK files and `docs/` are release/deployment artifacts; edit `web-src/`
for application changes. Do not mistake deployment ZIPs for the source root.

## Setup and commands

Use Node 24 LTS (22.12+ also meets Vite's engine requirement), npm and Python 3:

```sh
bash tools/codex/bootstrap.sh
npm --prefix web-src run check:legacy
npm --prefix web-src test
npm --prefix web-src run check:parity
npm --prefix web-src run build
npm --prefix web-src run preview -- --host 127.0.0.1 --port 4173
# In another terminal with the preview running:
BASE_URL=http://127.0.0.1:4173 npm --prefix web-src run check:browser
BASE_URL=http://127.0.0.1:4173 npm --prefix tools/codex run test:visual
python3 tools/codex/workspace.py --root ..
python3 tools/codex/design-parity.py --workspace ..
bash tools/codex/prepare-pr.sh
```

ESLint/Prettier and browser tooling are locked separately in `tools/codex/` so setup does
not change application dependencies or reformat legacy code. From `tools/codex/`, run
`npm run lint` and `npm run format:check`. The application uses JavaScript and
`check:legacy` for syntax checks; do not invent a TypeScript gate.

## Coding and design

Follow existing module/feature boundaries. Prefer small focused changes, preserve offline
queue and startup behavior, validate user input, and use textContent or escaped templates
for untrusted strings. Read relevant installed `.agents/skills/` before specialized work.

Arabic and RTL are first-class. Preserve Cairo, `src/styles/tokens.css`, theme variables,
logical spacing/alignment, mobile navigation, readable density, keyboard focus, accessible
labels and at least 44px web touch targets. Test 360, 390, 768, 1024 and 1440px,
both themes and enlarged text. Reuse current components; no setup-time redesign.
Shared token changes must be checked against Android `design/tokens.json`; see
`tools/codex/UI-QA.md` for screenshots and reviewed visual baselines.

Progress uses pages only. Preserve exactly `مسار الحفظ العام` and `مسار التثبيت`;
persisted smart-plan assignments are authoritative; rankings remain points based.
Cross-device totals derive from persisted synchronized data, not guessed local values.

## Testing and security

Run existing Node tests and relevant checks, production build, then browser tests for UI
changes. Browser fixtures must use synthetic state and block external traffic; never
exercise production Supabase mutations. Do not hide baseline failures; record exact
commands and compare with `tools/codex/VERIFICATION.md`.
Accessibility scans assert WCAG AA; review and fix failures in a separate scoped task.
Screenshot capture and comparison are different checks; comparison requires reviewed
baselines. Service workers are blocked in isolated test contexts.

Never commit tokens, private keys or service-role credentials. Do not apply SQL or
modify production Supabase data during setup. Preserve RLS/ownership enforcement.
Use `tools/codex/sql-check.py` with the bootstrapped SQL venv for local SQL syntax checks;
parsing does not verify database semantics or RLS.

## Git workflow

Use a separate feature/setup branch and PR for this repository; never commit to main,
force-push, or discard user edits. Review diffs and run checks. Push and merge require
explicit user approval. `prepare-pr.sh` generates a local PR body only.
`.github/workflows/codex-checks.yml` validates PRs without publishing; existing Pages
and release workflows are outside this setup's scope. Report Android and Web results
separately for coordinated tasks.
