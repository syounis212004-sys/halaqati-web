# RC27 web parity progress
Approved design: 2026-10-19-rc27-web-parity-design.md. User clarified Android → web and delegated routine choices.
Baseline: 41 JS syntax checks, 24 behavior tests pass.
Ruling: work in the fresh dedicated checkout on codex/rc27-web-parity; no second worktree is needed to isolate user work.
Ruling: execute inline and obtain one final independent review, following executing-plans.
Ruling: web build gets its own version; do not edit root Android version.json or APK.

Task 1 implemented: native atomic daily sessions, edit/archival RPCs, confirmed writes. Four new contract tests passed, existing offline VM passed.
Task 2 implemented: central RC24 archive, official issue/revisions/void, metadata snapshots interoperable with Android, preserved legacy local archive and opt-in import. Five server tests passed.
Task 3 implemented: complete paginated insight/program/phase queries, account-bound state, fresh season finalization, RC19 health notification episode keys. Five tests passed.
Task 4 implemented: in-place views without iframe, responsive CSS, PWA install help and update guard. Three view tests passed; browser fixture smoke 45 page/size combinations no errors or document overflow.
Task 5 in progress: source-based Pages build prepared; production Android payload untouched. Full independent review before remote publication.
Ruling: native push and APK forced-update mechanics are platform-specific; expose in-app notifications and browser installation without claiming background Web Push.
Ruling: live authenticated/RLS validation is unavailable without user test sessions; behavior is tested using isolated fixtures and API-contract mocks, never by modifying production data.

Final review: independent whole-change reviewer completed. Nine Important findings addressed: offline close/create deduplication; batch render/retry identities; canonical snapshots after ambiguous issue; transient promise persistence; offline phase cache restore; dashboard account/scope isolation; certificate ranking pagination; native series/visibility/number-position compatibility; canonical void checks. Regression tests and browser behavior checks exercise these paths.
Additional fix: queue revisions preserve edits arriving during an in-flight sync instead of dropping them when the older request succeeds.
Live schema verification: required 11 RPC contracts and authenticated EXECUTE grants confirmed; seven relevant tables have RLS enabled. Read-only metadata queries, no production data mutation.
Final: minor (deferred): custom font files/names are not transported between devices; use supported local fonts.
Final: minor (deferred): legacy import has confirmation rather than a separate historical preview; original local records remain available and release notes disclose reconstruction limitations.

Final verification: 89 Node behavior tests pass, legacy/offline VM pass, offline sync and data-integrity gates pass, all production JavaScript parses. Five viewport sizes and all four account-role fixtures render without page errors/overflow. Browser contract suite verifies ambiguous issuance, voiding, batch export and stable retry IDs. Actual Arabic certificate PDF generated, parsed as one A4 page, and visually checked.
Ruling: browser certificate download uses a 240-DPI browser-shaped image inside PDF because the pre-existing manual vector engine reordered Arabic glyphs. Native Chromium vector and browser printing remain available. Cost: downloaded browser certificate text is not selectable/searchable; release notes disclose it.
Task 5: verification complete; preparing a feature-branch PR, with no automatic main merge or production data mutation.

Remote delivery blocker: GitHub create_tree and create_branch both returned 403 Resource not accessible by integration; list_installations returned an empty list. Repository account permissions from GET do not prove installation write access. No remote branch or PR was created. Preparing complete source overlay, git patch, and production website ZIP so delivery does not depend on reconnecting.
