# Web vs native app parity + Back button / screen linking review

Sources: the app's knowledge graph (`halaqati-app/.ua/knowledge-graph.json`, 1,327 nodes, 12 layers, commit 4fc1576, analysed 2026-11-16), the app source (`source/app/.../*.kt`, 191 files, read-only) and this repository. The graph was only read; no analysis tool was run. Nothing in the "Differences" section is implemented yet: it waits for approval.

## 1. Done in 2.91.11 (clear bugs, tested RED -> GREEN)

### 1.1 "Delete session" was in the menu but invisible
`nx.css` draws danger menu items with `color:var(--st-bad-fg)`. `rc54.css` redefines `--st-*-fg` as the text colour for **solid** status pills (`--st-bad-fg:#fff` on `--st-bad-bg:#C62828`), so on a white menu the text was white on white (measured contrast 1.00). Same defect on 24 other rules that use the token as text on a normal surface: form/validation error text (`.nc-err`, `.nh-err`, `.ngm-err`, `.nr-pick-err`, `.ns-del-err`), delete icons/buttons (`.nc-del`, `.nr-del`, `.nr-del-btn`, `.ngm-del`), "late"/"rejected"/"bad" values, and the delete button of the management dialog (white text on a white background). Fix: new `--st-bad-text` token (dark red in light mode, light red in dark mode) used by every text-on-surface rule; solid pills keep `--st-bad-fg`. Check: stability S9 (contrast >= 3:1 for 17 text classes + the dialog button, light and dark).

### 1.2 Back button left the web app from almost everywhere
`rc27/ui.js` only handled pages opened from the side menu (history entry per page). Back from the open drawer, any dialog or menu, an open session (roster), or a bottom-bar page left the app. New model (one handler, a sentinel history entry above the base entry): Back closes the top dialog -> menu -> drawer -> the visible in-page "رجوع" arrow (session roster, student profile, follow-up...) -> the page this one was opened from -> the home screen -> only then leaves. Check: stability S10a-f (drawer, dialog, session -> list, bar page -> home, menu page -> origin, home -> leaves).
This is about the phone's **system Back** (button/gesture), not an in-app arrow: Android Chrome, the installed PWA and the WebView all deliver it as browser history Back, which is why the app needs history entries to intercept it.
Chrome skips history entries a page adds without a user gesture when Back is pressed (history-manipulation intervention), so the sentinel is added on the person's first touch or key press, not at load (stability S10g); a Back pressed before any touch behaves as before.
Known limits: after a page reload the first Back from home may reload the app once before leaving (the older history entry belongs to the discarded document); the test browser cannot reproduce Chrome's skip rule, so the gesture rule is verified by history length only, not on a phone.

## 2. Differences app vs web (for approval)

Method: (a) role navigation (`RoleNavigationPolicy.kt` vs `DRAWER` in `rc86/parity.js`), (b) every Supabase RPC and table used by the app vs the web, (c) app screen files and function summaries vs web keyword/feature search.

### 2.1 Same
- Drawer items and labels per role (admin 25, supervisor 16, teacher 16, guardian 10, observer 7): identical to `drawerItems()`.
- Session actions: edit, upload+finish, archive/restore, cancel, delete (needs 1.1), "deleted sessions (restore)" for admin, quick "start today's session".
- Backup export (ZIP), restore, sync centre (as a dialog), exams, org, staff, donors, support, awards, insights, Quran calculator, import/export, smart plans + phases + range rebase, student profile (4-week progress, follow-up note, data health).
- 84 of the 96 RPCs the app uses are also used by the web; the web also uses 13 the app does not (`delete_halaqa_cascade`, guardian-link requests, visit queue...).

### 2.2 Backend capabilities the app uses and the web never calls (12 RPCs, 3 tables)
| App | Meaning | Web today |
|---|---|---|
| `rc15_create_smart_plan_bundle` | create several plans for a student at once | one plan at a time |
| `rc112_reconcile_plan_phase_states`, `rc112_capabilities`, `rc113_capabilities` | keep phase states consistent; capability flags | not called |
| `rc152_roll_tathbit_months`, `rc15_tathbit_consistency_issues` | roll consolidation (تثبيت) months; consistency issues | not called |
| `rc19_sard_target_pages`, `rc171_latest_activity_anchor` | sard target pages; latest activity anchor for plan start | computed in the browser instead |
| `rc_broadcast_detail`, `rc_broadcast_stats` | broadcast details and delivery stats | broadcast sending only |
| `rc121_issue_certificate`; tables `certificate_series`, `certificate_templates` | certificate issuing with series/templates ("studio") | simpler certificates |
| table `exam_examiners` | examiners management sheet | absent (no UI strings found) |
| `guardian_children` | guardian's children list | read through other queries |

### 2.3 Screens/features present in the app and not found in the web (keyword + file search)
Absence streaks card, inactive students card, monthly comparison, weekly timeline (Sat-Fri) in the student profile, bulk plan cycles sheet, examiners sheet, certificate studio (templates/series), broadcast stats/details, forced-update gate (app only, not applicable to web), Seasons share image (only a word match found: needs a closer look).
Unverified: keyword search can miss a feature that exists under another name; each item needs a quick screen-level check before building.

### 2.4 Differences that are intentional or not applicable
Native Google sign-in, push (FCM), forced update, native file export (web uses its own), Room database (web uses IndexedDB/localStorage).

## 3. Navigation model (how screens are linked) — findings
- Root cause of "there is no single mechanism": `go()` is redefined 4 times (core, rc27 stack, ops skeleton timer, students profile reset) and `render()` is wrapped about 19 times (rc27 desktop/scope/motion/insights/dashboard, rc50, rc53, rc54 view transitions, rc85, rc86, native approvals/students/tools/home/sessions, ops, performance, motion-system). Each feature added its own layer on the previous one; no layer owns navigation, history or transitions, so they stack (two page transitions, skeleton races, no history entries).
- Pages: `go(id)` -> `render()`; wrappers add the page stack (rc27), the skeleton timer (ops), the transition layer (motion-system). Bottom-bar pages reset the stack; side-menu pages stack over their origin.
- Sub-views are not pages: `state.sessionView` (session roster), student profile (`NSS`), follow-up, plan details, dialogs and sheets. They had no history entry, hence the exit on Back (fixed generically by clicking the visible "رجوع" arrow).
- Sub-views without an in-page "رجوع" control cannot be reached by Back: none found in the screens checked, but only the session roster, student profile and follow-up screens were verified.
- Deep links/OAuth: `history.replaceState` in `auth/runtime.js` runs after load and does not conflict with the sentinel.
- Not done: "press Back again to exit" at home (the browser/PWA leaves immediately), and Back inside the native Capacitor shell was not run on a device.

## 4. Proposed next steps (need approval)
1. Verify each 2.3 item on screen, then implement in this order: bulk plan cycles, absence/inactive cards, weekly timeline, examiners sheet, certificate studio, broadcast stats.
2. "Press Back again to exit" at home (one toast, 2 s window).
3. Replace the other `--st-*-fg` text uses in inline styles (none found in JS) and add the contrast check to the release gate (done: S9).
