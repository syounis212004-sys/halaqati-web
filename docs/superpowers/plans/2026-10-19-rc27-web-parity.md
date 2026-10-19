# RC27 Web Parity Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement tasks inline.

**Goal:** Port missing Android RC27.39 behavior to the existing web app and make one responsive, installable website.
**Architecture:** Preserve the existing classic runtime contracts. Add tested helpers for server sessions, certificates, and complete paginated queries; wire them into existing screens. Keep Android updater metadata separate from the web version.
**Tech Stack:** JavaScript, Vite, Supabase, IndexedDB, browser PWA, Node tests, Playwright.
**Spec:** ../specs/2026-10-19-rc27-web-parity-design.md

## Global Constraints
- Preserve role permissions, account isolation, local archives, and offline queues.
- No production DDL, no APK changes, no fabricated server success or official numbering.
- One source, Arabic RTL, responsive at 360/390/768/1024/1440px.

## Review Focus
- Session creation races and local-to-server ID mappings.
- Certificate retries, revision identity, old archives and server failure.
- Account switch during pending requests.
- Supabase page caps causing incomplete competition results.
- OAuth and service-worker updates while local work is pending.

### Task 1: Native session contracts
Files: src/features/sessions/server.js, src/core/runtime.js, src/features/sessions/runtime.js; scripts/native-sessions.test.mjs.
Interfaces: HalaqatiSessionServer.save(db, op, existing) returns confirmed server session; archive(db, id, archived) returns confirmed row.
- [x] Write and run tests for atomic create, edit RPC, archive JSON preservation, and rejected writes.
- [x] Implement RPC helpers and wire offline operation mappings and session UI.
- [x] Run new tests and existing offline behavior checks.

### Task 2: Central certificate archive
Files: src/features/certificates/server.js and runtime.js; scripts/certificates-server.test.mjs.
Interfaces: HalaqatiCertificateServer provides list, issue, revise, void, revisions, importLegacy; confirmed metadata drives existing renderer.
- [x] Write failing tests for official numbering, idempotent UUID, snapshot whitelist, revision identity, error propagation.
- [x] Implement server adapter and editor/archive UI while retaining old local archive.
- [x] Run tests including existing certificate renderer checks.

### Task 3: Complete insights and plan health
Files: src/features/rc27/data.js, insights.js, programs.js, phases.js; scripts/rc27-data.test.mjs.
Interfaces: HalaqatiData.all(makeQuery) paginates independently of server page cap; account generation guards discard late results.
- [x] Test capped pages and stable sorting/error propagation before implementation.
- [x] Wire queries and health RPC into established flows; invalidate derived caches after structural session mutations.
- [x] Run new and existing plan/report tests.

### Task 4: Responsive layout and PWA
Files: src/core/view.js, pwa.js, src/styles/responsive.css, index.html, public/mobile.html, public/desktop.html, public/manifest.webmanifest.
- [x] Test view selection and URL/hash preservation.
- [x] Remove iframe, fix desktop/mobile layout, keyboard/focus, add browser install UI and safe update behavior.
- [x] Browser-check key pages at all target sizes, including long names, dark mode and dialogs.

### Task 5: Build and delivery
Files: package.json, src/main.js, .github/workflows/halaqati_update_and_pages.yml, release documentation.
- [x] Run syntax, meaningful behavior suites, production build and browser smoke checks.
- [x] Prepare source-based Pages workflow preserving APK updater files.
- [x] Fresh whole-branch review, fix important findings, create reviewable branch/PR or downloadable package if remote write is unavailable.
