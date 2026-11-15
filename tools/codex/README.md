# Reusable Codex development setup

This toolkit configures one independent repository. The same setup branch in the other
Halaqati repository provides its own instructions, skills, lockfile and PR checks.
Application source, versions, lockfiles, production data and release workflows are preserved.

## Start here

```sh
# Run from either repository root. Existing checkouts/branches are preserved.
python3 tools/codex/workspace.py --root <workspace-parent>
bash tools/codex/bootstrap.sh
python3 tools/codex/check.py
# With the web preview running, from the web checkout:
BASE_URL=http://127.0.0.1:4173 python3 tools/codex/check.py --browser
```

Launch standalone Codex from the intended repository root to load `.codex/config.toml`
and `.agents/skills/`. Trust a checkout only after reviewing it. On this machine both
checkouts are registered as trusted. This does not grant remote write permissions.
`check.py` retains logs and exit codes under `.codex-work/checks/`; it runs all independent
checks and returns failure if any failed or were unavailable. Existing failures remain
visible. See VERIFICATION.md for the measured baseline.

## Tools and versions

- Existing shared runtime: Git 2.52.0, GitHub CLI, Node 24.22.1, npm 11.9.0, Python 3.12.14.
- Android: Temurin JDK 17.0.21+9, Gradle 8.13, command-line tools 23.0, SDK platform 36,
  build-tools 36.0.0 (AGP also installs 35.0.0), platform-tools/adb 37.0.1.
  Kotlin/Compose compiler 2.2.21 and AGP 8.13.2 are supplied by existing Gradle plugins.
- Web: the application lockfile installs Vite 8.2.2 and Playwright 1.64.1.
- Separate locked tooling: ESLint 10.15.0, Prettier 3.10.1, Playwright Test 1.64.1,
  Playwright MCP 0.0.85, axe 4.11.1, Supabase CLI 3.1.0.
- Local PostgreSQL parser: pglast 8.8 in `$HOME/.local/share/halaqati/sql-venv`.

The Android installer supports Linux x64, downloads official archives with pinned
checksums, and installs in `$HOME/.local/share/halaqati` (override `HALAQATI_TOOLS`).
It does not require root. Keep inherited proxy and CA settings. `gradle.py` adapts Java
to those settings without disabling TLS or changing application dependencies.
Node is provided by this Cloud runtime; use Node 24 LTS in a new environment.
The web bootstrap uses the existing lockfile with `npm ci`; it never runs audit fix.
Tooling lint/format commands run from `tools/codex/`. The web checkout additionally has
`npm --prefix tools/codex run lint:app`, respecting classic scripts and actual ES modules.

## Android configuration for local checks

For Android without a private Firebase binding, use the explicit offline check mode:
`HALAQATI_OFFLINE_ANDROID_TEST=1 python3 tools/codex/check.py`. Its synthetic Firebase
fixture is restricted to debug compilation, Android Lint and local unit tests. The file
is removed after the process, including on build failure. Normal builds accept the
`HALAQATI_FIREBASE_GOOGLE_SERVICES_JSON` / `_BASE64` environment bindings; no values are
stored in configuration. See AGENTS.md for the distinction from Firebase runtime testing.

## Trusted skills

Codex's supported project mechanism is `.agents/skills/<name>/SKILL.md`:
<https://developers.openai.com/codex/skills/>.
The folder contains the user's Halaqati, frontend engineering, debugging, review,
testing, CI, performance and security skills, official Supabase/PostgreSQL guidance,
OpenAI browser guidance, and adapters for existing repository design skills.
Design adapters include UI/UX Pro Max, frontend design, native Android/Compose design,
mobile design and Compose guidance. Accessibility and performance are covered by the
frontend engineering and performance skills. Arabic RTL and token rules are
covered by Halaqati's full references and AGENTS.md. See SKILL-SOURCES.json.

Android adapters preserve `.claude/skills/`. Web adapters install a checksum-verified
snapshot from the user-owned Android repository into ignored `.codex-work/skills/`;
they work without a sibling checkout. Bootstrap before launching Codex. No third-party
marketplace or arbitrary remote shell installer is used. Skills remain guidance, not
authorization to push, merge, publish, or mutate production.

## MCP and connected services

There are two distinct integration surfaces:

1. This ChatGPT/Codex task's connected GitHub, Supabase and Figma plugins. GitHub metadata
   and permissions were checked for both repositories; Supabase project/table metadata
   and Figma account identity were verified using read-only calls. No production writes
   or Figma file edits were performed. Figma has a View seat; no file-specific edit
   permission has been verified.
2. Standalone Codex CLI configuration in `.codex/config.toml`. Local Playwright is enabled,
   pinned, isolated and headless; run `python3 tools/codex/mcp-check.py` to verify MCP
   initialization, tool discovery, actual navigation and snapshot capture. Protocol
   verification exposed 38 tools, including browser debugging. Restart Codex after setup.

Optional GitHub read-only, project-scoped Supabase read-only, and Figma remote entries
are deliberately disabled in CLI configuration. Existing plugin OAuth sessions cannot
be copied into a standalone CLI. If using CLI remote integrations, enable the relevant
entry and authenticate there (`codex mcp login supabase` / `codex mcp login figma`).
GitHub's entry references GH_TOKEN by name; no credential value is stored. Validate its
token permissions against the remote MCP service separately. Authentication in one
surface does not establish authentication in the other. No extra OAuth is needed for
the already-connected plugins in this task.

References: [GitHub MCP](https://github.com/github/github-mcp-server),
[Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp),
[Playwright MCP](https://github.com/microsoft/playwright-mcp),
[Figma MCP](https://developers.figma.com/docs/figma-mcp-server/).

## Cross-repository tasks and PRs

Inspect both Git roots, AGENTS.md files and current branches. Plan shared database/API
or token changes together. Implement and test each repository independently. Use
`design-parity.py --workspace <parent>` for existing shared token parity. Report both
repositories even if one requires no changes. See UI-QA.md for responsive, accessibility,
screenshots, visual baselines and Android device checks.

Use a short-lived branch in each repository. Run `bash tools/codex/prepare-pr.sh` to
prepare `.codex-work/pr-body.md`. Review staged diffs and checks, then request push
approval. After approval, push each branch independently and use `gh pr create --draft
--base main --body-file .codex-work/pr-body.md` inside that repository. Never merge or
publish without authorization. PR checks have read-only repository permissions and
do not run release/deployment automation.

## Cloud persistence boundary

Both repositories work in this single task. The task's Cloud status has no source
configuration ID, and no environment draft/publish tool is exposed. Local files and
tool installation do not prove that a future Cloud task inherits this machine.
Commit/review these setup branches, then select both repositories in a reusable Cloud
environment if offered, or clone the sibling with `workspace.py`. Run bootstrap in
each root. If the platform offers Promote/Publish, review and save the configuration;
verify persistence in a fresh task. Otherwise use two repository-specific environments
with matching setup branches and separate PRs. No single-repository limitation was
observed in this task.
