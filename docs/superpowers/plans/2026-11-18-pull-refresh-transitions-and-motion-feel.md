# Pull-to-refresh in the drawer, screen transitions, press feedback and motion pace — reference report + plan

> Execute task by task (superpowers:executing-plans). Nothing in this document is implemented yet. Measured on production build 2.91.8, Chromium, 390x844; network mocked (latency stated per row).

**Goal:** (1) the refresh gesture never fires or blocks scrolling inside the drawer; (2) screen changes feel quick on weak phones; (3) every control answers a press visibly; (4) motion is slower and softer where it is now too quick.

**Spec:** user report 2026-11-18 (screenshot: "جاري تحديث البيانات…" over the open drawer; slow screen changes; some buttons without live motion; motion too fast).

## Global constraints
- No change to data logic, roles, Supabase, save/delete. Layout only where motion needs it.
- Reduced motion keeps every state transform (2.91.4 lesson); the generic fixed-element guard stays green.
- Each task: failing check first, then fix, then `motion-check` + `loading-check` + `press-check` on the production build before any push.
- No publish without being asked; `version.json` untouched.

## Evidence

### E1. Pull-to-refresh fires inside the drawer and blocks scrolling (REPRODUCED)
Source: `src/core/startup.js` (`hfPullAllowed`, touchstart/touchmove/touchend, "v2.44.0 mobile pull-to-refresh").
`hfPullAllowed(target)` only checks that the **window** is scrolled to the top and that the target is not inside `dialog,input,textarea,select,[contenteditable],[data-no-pull-refresh]`. The drawer is a separate scroller on top of the page; the page behind it is at the top, so a downward drag on the drawer is accepted. After 8px `touchmove` calls `preventDefault()`, so the drawer's own scroll is cancelled.

Measured with real touch events (CDP), drawer open:
| Case | Pull indicator | touchmove prevented | Drawer list scrollTop |
|---|---|---|---|
| Drawer closed, page at top (intended) | armed | yes | n/a |
| Drawer open, list at top, drag down 300px | **armed -> refresh runs on release** | yes | 0 |
| Drawer open, list scrolled 400px (the screenshot), drag down to scroll back up | **armed -> refresh runs on release** | yes (12/12) | **stays 400: cannot scroll up by dragging** |

Cost of one accidental release: `refreshFromServer` -> `loadAll(true)` (30 requests, ~3.5 s at 700 ms latency) plus a toast.

### E2. Screen changes (0 ms network, 800 students, 60 sessions)
| CPU | page | content swapped | first visible | all blocks visible | worst frame |
|---|---|---|---|---|---|
| 1x | home / sessions / halaqas / ranking | 13-64 ms | 13-95 ms | 69-176 ms | 35-64 ms |
| 1x | students / reports / plans | 11-21 ms | 11-21 ms | 321-403 ms | 75-143 ms |
| 4x | home | 80 ms | 80 ms | 630 ms | 250 ms |
| 4x | students | 47-65 ms | 47-65 ms | 868-1015 ms | **514-648 ms** |
| 4x | plans / ranking / reports | 62-72 ms | 62-72 ms | 520-745 ms | 156-374 ms |
Long tasks during a change at 4x: 206-769 ms (students 723-769 ms). So the wait on a weak phone is **synchronous render work** (one `innerHTML` of every card), then, for server pages, the network (E3 of the earlier report: 8 of 13 server pages waited 0.7-1.4 s on every visit before 2.91.8).
`content-visibility:auto` exists only for a few lists (`app.css:315`); the student cards (`.nst-card`) have none.

### E3. Press feedback (49 distinct visible control signatures on 26 admin pages, outside drawer/nav/dialogs)
44 move on press, 1 only recolours, **3 show no change**: `summary` accordion headers (reports, ranking) and the switch (its thumb is a pseudo-element, so this reading is a limit of the measurement). 1 not measurable. Dialog contents, drawer rows and roles other than admin were measured earlier or not at all (see "Not measured").
What "no live motion" most likely is: the press depth is `scale(.975)` = 2.5% (1.4 px on a 56 px button) and the release spring is 420 ms; on a phone that reads as almost nothing. Hover does not exist on touch.

### E4. Motion pace (tokens in `motion.css`)
`--hm-dur-instant 90ms · fast 160ms · base 240ms · slow 380ms · hero 640ms`. Page change: old fade 160 ms + new fade 160 ms. Entrance cascade: `step = min(34ms, 230/n)` "the whole cascade stays under ~0.25s" (`motion-system.js:246`). Menu exit 110 ms (hard-coded in `nx.js`). Guidance used by the motion skills: micro 100-200 ms, component 200-400 ms, section 400-700 ms, page 600-1000 ms. The component/section/page values here sit at or below the bottom of those ranges, which matches the "too fast" report.

### Not measured / unverified
Real phone, real network, other roles for press coverage, dialog contents, whether the installed app runs 2.91.8 (service worker updates on the next open or from the update banner), the ripple idea on a device.

## Tasks

### Task 1: The refresh gesture respects the drawer and inner scrollers
**Files:** modify `src/core/startup.js` (`hfPullAllowed`, `touchmove`); test `scripts/pull-check.mjs` (new, CDP touch events).
- [ ] Test first (RED on 2.91.8): (a) drawer open + list at top + drag down: no armed indicator, no refresh request; (b) drawer open + list scrolled 400: drawer `scrollTop` decreases and `touchmove` is not prevented; (c) closed drawer + page at top: indicator arms (regression guard); (d) a scrolled inner scroller (e.g. a long table container) blocks the gesture.
- [ ] Implement: `hfPullAllowed` returns false when `.drawer.open` exists or when any scrollable ancestor of the target (overflow-y auto/scroll, scrollHeight > clientHeight) has `scrollTop > 0`; only call `preventDefault()` when the page itself is the scroller.

### Task 2: Pace — slower, softer, still interruptible
**Files:** `src/styles/motion.css` (tokens), `src/core/motion-system.js` (line ~246 cascade, hard-coded `T.fast*1000-10`), `src/features/native/nx.js` (menu exit 110 ms), `scripts/motion-check.mjs` (thresholds).
Proposed values (decide on a device, then freeze): instant 90->120, fast 160->220, base 240->320, slow 380->480, hero 640->760; page fades 160->260 each; cascade `min(34, 230/n)` -> `min(55, 420/n)` ms (still capped at ~0.45 s total); menu exit 110->170; press release spring 420->520.
Interaction feedback stays immediate: the press floor is still reached within 120 ms; only arrivals, releases and exits slow down.
- [ ] Update the timing assertions first (they encode the old numbers), see them fail on the old code, then change the tokens.
- [ ] Reduced motion unchanged (tiering and the fixed-element guard stay green).

### Task 3: Visible press everywhere
**Files:** `src/styles/motion.css`; optionally `src/core/motion-system.js` (ripple).
- [ ] Add `summary` (and the pseudo-element switch) to the press contract; test: sampled scale/transform changes on press for every signature in the E3 list (`scripts/press-check.mjs` extended to the full signature sweep used here).
- [ ] Depth: `--hm-press` .975 -> .96 for filled/primary/large rows, .90 for icon buttons.
- [ ] Decision gate (ask the user after trying Task 2/3 on the phone): add a touch ripple/state layer (one delegated `pointerdown` handler + `::after` radial fill, 450 ms, transform/opacity only) only if the deeper press still does not read as "alive".

### Task 4: Weak-phone render cost
**Files:** `src/styles/*.css` (student cards), then measure.
- [ ] RED: worst frame on `students` at 4x with 800 students > 300 ms (today 514-648 ms).
- [ ] `content-visibility:auto; contain-intrinsic-size:auto 120px` on `.nst-card` (same pattern as `app.css:315`); GREEN when the worst frame drops and no layout shift is introduced (differential CLS check already in `motion-check`).
- [ ] If still heavy: render the first ~30 cards, the rest in idle time.

### Task 5: Make the running build visible
**Files:** Settings screen (read-only line), `scripts/…`.
- [ ] Show the web build number in Settings so "which version am I on?" is answerable from the phone. Ask before changing the service-worker update policy (`registerType: 'prompt'`).

### Backlog from the previous plan (not started)
Scoped refresh instead of the full `loadAll` after a save (26 requests), `updated_at` deltas, shared `HM.swap/list/tabs/sheet` components, IndexedDB-backed read cache.

## Review focus
- Pull gesture on every other inner scroller (tables, long lists inside dialogs) and in RTL.
- Slower tokens must not make the app feel laggy on interaction: keep press and focus feedback <= 120 ms.
- `content-visibility` and anchor/scroll restoration on the students list.
- Reduced motion after the token change (no state transform removed).
