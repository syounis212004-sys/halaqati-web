# Local-first loading + shared motion components — plan

> Execute task by task (superpowers:executing-plans). Nothing here is implemented yet.

**Goal:** pages open instantly from local data and refresh quietly in the background; every control and surface uses one shared set of motion components.

**Architecture:** (A) a stale-while-revalidate data layer under every loader, scoped refresh instead of full `loadAll`; (B) motion contract applied by element role (not by class list) plus a few shared components (menu, sheet, tabs, list, content swap).

**Spec:** the 2026-11-18 report in the session (root causes below). Evidence: `web-src/.artifacts/inventory.json`, source lines cited.

## Global constraints
- Do not change: halaqa/student/plan logic, role permissions, Supabase schema/RLS, save/delete operations, visual identity.
- Layouts change only when motion needs it.
- Reduced motion keeps every state transform (lesson of 2.91.4); the generic fixed-element guard stays green.
- No publish, no `version.json` edit, no release package until asked.
- Every task: failing check first (RED), then fix (GREEN), full `motion-check` on the production build before any push.

## Root causes (confirmed in code)
1. `rc50/runtime.js` render wrapper does `box.innerHTML = skeleton` **before** every await on 23 server-driven pages (support, awards, chats, observer requests...). Only 10 RPC names are cached (`rc86/parity.js` STORED), cached until the 20:00 Gaza cycle, no revalidate; every other RPC hits the network each visit.
2. `loadAll()` = full pipeline every time (`core/performance-runtime.js`): halaqas, all students (paged), 120 sessions, dashboard, smart plans, operational window (up to 10,000 attendance + 10,000 notes rows), role extras, signed photo URL per student. It runs at every launch (`refreshFromServer`), after every save/delete (`await loadAll()` in ~10 places) and on reconnect. No delta (`updated_at`).
3. `cacheSnapshot()` JSON-stringifies the whole state into localStorage on every write (main-thread jank, 5 MB cap) besides IndexedDB.
4. 41 places replace `#content` via `innerHTML` with skeleton/new markup, so the continuity layer (FLIP, crossfade) cannot run there.
5. Motion contract (`motion.css`) is a class list; of 9,248 visible interactive elements in the inventory, ~7,850 are outside it (drawer rows `dtile`, `d86-fav`, section headers, bell, sync badge, `h86-more`, `ns-ib`, `dn-plus`, presets, student cards...). The donor/support layer (`dn-btn`, `dn-seg`, `dn-pills`, `dn-card`, `d86-donor`) has 0 rules.
6. Service worker is `registerType: 'prompt'`, `skipWaiting: false`: a device keeps the old build until the update prompt is accepted. **Unverified** as a cause of "no smooth motion"; check what build the user's device runs.

## Measured (2026-11-18, production build 2.91.7, mocked network at 700 ms per request, 390x844)
- RC50 pages for admin (13): 8 show the skeleton for the whole network time on **every** visit (awards, matrix, weekly, visits 1.4 s, supervision 1.4 s, observer_requests, chats, exams: ~704-1447 ms); 5 are cached (support, team, org, insights, staff: 0 ms on the 2nd visit). First visits: 720-1440 ms of skeleton on 11 of 13.
- One `loadAll(true)`: 30 requests (25 distinct endpoints) = 3.5 s at 700 ms latency. The `loadAll()` that follows every save/delete: 26 requests = 4.3 s. (12 students in the mock; real students are paged by 100.)
- `cacheSnapshot()` under 4x CPU: ~255-433 ms per call with 1,500 students + 120 sessions + 10,000 attendance rows (2.8 MB); 3 ms with a small state. One call per `loadAll`. So item 3 above matters for large organisations only.
- Press response (mouse held down, computed scale): responds: notification bell, `h86-more`, mobile-nav buttons, `.menu-btn`, `.dn-btn`. Does NOT respond: student card (`nst-card-main`), support tabs (`.dn-seg button`), drawer rows (`dtile`), favourite star (`d86-fav`), drawer section headers (`d86-gh`), logout. The earlier "85% of elements are outside the contract" was by class name and overstated; by measurement the non-responding groups are the ones above (drawer rows are ~5,800 of the inventory's instances because the drawer repeats on every page). Controls not present in the mock data (`.nx-btn`, `.ns-ib`, `.dn-pills`, `.d86-donor`...) were not measured.

## Tasks

### Task 1: One data layer — `HalaqatiData.swr`
**Files:** create `src/core/swr-store.js`; modify `src/main.js` (load order); test `scripts/data-check.mjs`.
**Interfaces — Produces:** `swr(key, loader, { ttl, onFresh }) -> { cached, fresh: Promise }`: returns the stored value synchronously (IndexedDB mirrored in memory), starts one deduplicated background refresh, calls `onFresh(value)` only if the data changed (deep-equal), keeps per-user keys, honours offline.
- [ ] Test: first call returns no cache + loader runs once for two concurrent callers; second call returns cache immediately and refreshes; unchanged data does not call `onFresh`; offline returns cache without error; a different user id never sees the other's data.
- [ ] Implement; fall back to memory-only when IndexedDB is unavailable.

### Task 2: RC50 pages stop clearing to a skeleton
**Files:** modify `src/features/rc50/runtime.js` (render wrapper), `src/features/rc86/parity.js` (STORED → use `swr` for **all** read RPCs; writes still invalidate).
- [ ] Test (RED first): navigate to `support` twice; second visit must have **zero** frames with `.dn-skel`; first visit shows skeleton only after 200 ms and only if nothing cached; data refresh updates in place with no layout jump.
- [ ] Implement: paint cached HTML immediately, revalidate, swap with the shared content swap (Task 7).

### Task 3: Scoped refresh instead of full `loadAll`
**Files:** modify `src/core/performance-runtime.js`, callers in `sessions/runtime.js`, `students/runtime.js`, `native/management.js`.
**Interfaces — Produces:** `refreshData(['sessions'|'students'|'halaqas'|'ops'|'plans'])`; `loadAll()` keeps full semantics for login only.
- [ ] Test: after deleting a session only the `sessions` (and dependent stats) queries run (assert on mocked request log); students/photos are not refetched.
- [ ] Implement: students/sessions incremental by `updated_at` where the column exists (verify per table, otherwise fall back); operational window 120 days → 30 days with paging; signed photo URLs lazy per visible card and cached with expiry.

### Task 4: Snapshot writes off the hot path
**Files:** modify `src/core/runtime.js` (`cacheSnapshot`).
- [ ] Test: 20 rapid writes produce one IndexedDB write; localStorage copy removed once IndexedDB is confirmed.
- [ ] Implement debounce (250 ms) + keep flush on `visibilitychange`/`pagehide`.

### Task 5: Motion contract by role
**Files:** modify `src/styles/motion.css`; test in `scripts/motion-check.mjs`.
- [ ] Test (RED): sampled press scale on `dtile`, `notification-bell`, `h86-more`, `ns-ib`, `dn-btn`, `dn-seg button`, `nst-card-main`, `d86-donor` must reach the press floor and spring back (today: no change).
- [ ] Implement: zero-specificity `:where(button, [role=button], summary, a[href], label.nx-switch)` baseline (press, hover-lift for fine pointers, disabled, focus); variants (`--hm-press`) only refine. Same reduced-motion guard.

### Task 6: Shared components
**Files:** create `src/core/hm-components.js`; modify call sites gradually.
**Interfaces — Produces:** `HM.swap(container, html, { key })` (skeleton/old → new, crossfade + FLIP of keyed blocks), `HM.list.enter/exit` (row add/remove with height collapse), `HM.tabs(container)` (sliding indicator for `.dn-seg`, `.dn-pills`, `.tab`), `HM.sheet` (enter/exit for any dialog/drawer, drag-to-dismiss), `HM.menu` (the kebab behaviour for every popup).
- [ ] One test per component with frame sampling (monotone progress, interrupt/reverse, cleanup, reduced motion).
- [ ] Migrate: RC50 pages, student cards, session rows, notifications list, tabs, then the remaining `innerHTML` loaders (41 sites) by priority of traffic.

### Task 7: Verification and release gate
- [ ] Production build: full `motion-check` + new `data-check`; 4x CPU perf before/after (long tasks, dropped frames) on pages: home, students, support, sessions.
- [ ] Record clips (CDP screencast) of: page → page, support tabs, menu open/close, student card expand, save button states; inspect intermediate frames.
- [ ] Confirm the build the device runs (SW update path) before judging "feel".
- [ ] Ask before publishing.

## Review focus (inputs likely to bite)
- Cached data shown after the user's role/account changed (per-user keys, clear on sign-out).
- Stale cache shown after a write on another device (revalidate on focus; writes invalidate).
- Two refreshes racing (dedupe, last-writer token).
- Offline first visit with no cache (clear message, no endless skeleton).
- Huge lists (10k students): no full re-render on refresh; keyed FLIP capped.
