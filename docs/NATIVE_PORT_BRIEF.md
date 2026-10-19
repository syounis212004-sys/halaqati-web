# RC27.40 — Native-parity screens for the Halaqati web app (brief for every porting agent)

## Why
The user (Arabic-speaking owner of Halaqati) looked at the web app and said, in effect: *"the menus/screens are old and not like the
Android app — especially the sessions screens and the icons. Everything is built on the original early web version, not on the
Android version you built. I want official work."*
Our current web screens are the **legacy v2.x HTML pages** (text buttons, rows of small action buttons, emoji/text icons, old card
markup) with a thin skin on top. The Android app (Kotlin / Jetpack Compose, Material 3, RTL) has completely different screens,
components, flows and icons. **Your job: rebuild one group of screens so they are the web twin of the Compose screens** —
same structure, same components, same Material icons, same Arabic strings, same states/empty states/menus/dialogs, same
behaviour — plus a *real* desktop composition (not a stretched phone layout).

## Sources of truth
* Latest native source (RC27.39): `/tmp/w/app39/Halaqati_Native_Kotlin_v2.50.0_RC15/app/src/main/java/com/mohammedsamir/halaqati/`
  (screens under `ui/screens/`, components under `ui/components/`, theme under `ui/theme/`, rules under `plans/`, `sessions/`,
  data layer `data/HalaqatiRepository.kt`). **Read the Compose code of your screens completely** and list every element
  before you write anything (header, tabs, chips, search, cards, per-item menus, dialogs, sheets, empty states, snackbars,
  confirmation texts, error texts, loading skeletons, role-based visibility). Copy Arabic strings verbatim.
* Web app source (this tree): `/home/user/work/web39` (Vite, classic global scripts). Legacy page functions live in
  `src/legacy/app.js` and `src/features/*/runtime.js` (e.g. `sessionsPage()`, `studentsPage()`, `sessionRosterPage()`); the
  RC27 layer is in `src/features/rc27/*.js` (programs, scope, phases, dashboard, insights, desktop…). Global `state`, `db`
  (Supabase client), `render()`, `go(page)`, `toast()`, `esc()`, `fmt()` etc. are available.

## Hard rules
1. **No database / Supabase schema or data changes.** Only call the same tables / RPCs the Android repository calls
   (`HalaqatiRepository.kt` shows the exact `select=` strings and RPC names). Reuse the existing web handlers
   (`openSessionRoster`, `quickAttendance`, `openPlan`, `saveStudent`… grep first) wherever they exist so data behaviour,
   offline queue, permissions and live-sync keep working; build new handlers only when the screen has no web equivalent.
2. **Replace, don't skin.** Assign the global page function in your own file after the legacy one
   (e.g. `sessionsPage=function(){ …return html }`), generate native-structured markup with the NX kit, and delete nothing in
   shared legacy files. Never leave legacy buttons rows/markup visible on your screens.
3. **Icons**: every icon is the Material icon the Kotlin code uses: `Icons.Default.MenuBook` → `mi('MenuBook',24)`;
   the nav icons (`GoldenNavIcon`, `ic_gm_*`) already exist as `iconFor(key)` / `window.RC27_ICONS` in `src/features/rc27/icons.js`.
   No emoji, no letters-as-icons. All 146 icons used by the app are in `src/features/native/icons.js`.
4. **Component kit**: use `window.NX` (`src/features/native/nx.js`, styles `src/styles/nx.css`) — read both files first.
   It mirrors Components.kt / UnifiedCards.kt / HalaqatiInsightKit.kt: `NX.btn` (filled/tonal/outlined/text), `NX.iconBtn`,
   `NX.chip(s)` (FilterChip), `NX.pill` (StatusPill), `NX.card`, `NX.metric(s)`, `NX.hero` (GoldenFeatureHero), `NX.insight`
   (InsightCardShell), `NX.search`, `NX.field/select/switchRow`, `NX.kebab` (DropdownMenu on "⋮"), `NX.dialog`
   (bottom sheet on phone, centred dialog on desktop), `NX.confirm`, `NX.empty`, `NX.skeleton`, `NX.notice`, `NX.progress`.
   If a component you need is missing, implement it **inside your own JS/CSS file** (prefix your classes, e.g. `.ns-…` for
   sessions) — do not edit `nx.js`, `nx.css`, `icons.js`, `main.js`.
5. **Tokens**: radii 12/16/20/22/24/26, screen padding 14, touch target 48, action height 52, card = surface + 1px hairline
   border (`--line`) + radius 16–22 (session cards use radius 22 + `--outline` border), text scale from `CairoTypography`
   (titleLarge 19/28 bold, titleMedium 16/24, bodyMedium 14/20, bodySmall 12/18, labelMedium 12/18). Colours only via the CSS
   variables of `apk.css` (`--green --card --ink --muted --line --outline --mint --mint2 --primary-container --st-ok-bg…`)
   so light **and** dark (`body.dark`, true black) work. Respect `prefers-reduced-motion`.
6. **RTL & Arabic** everywhere (logical properties: `inline-start/end`, `margin-inline`). Digits Latin (the app converts them).
7. **Roles**: honour the same role/permission gating as the Kotlin code (admin / supervisor / teacher / guardian) using the
   existing web helpers (`roleCanManage()`, `canManageStudents()`, `isOwner()`, `state.profile.role` …).
8. **Offline/online**: keep the existing offline behaviour (cached `state`, offline queue); show the same offline notices.
9. Phone layout = the Compose phone layout. **Desktop (`html[data-view="desktop"]`, ≥1024px) must be a real desktop
   composition** for your screens: use the width (two/three column grids, master–detail, data tables with sticky headers
   and hover row actions, side panels instead of full-screen sheets, wide centred dialogs, keyboard friendliness) while using
   the same NX components, icons and strings. Write desktop rules in your own css file under `html[data-view="desktop"]`.
   The shell (sidebar, top bar, search, scope switcher) is already desktop-ready (`src/features/rc27/desktop.js`,
   `src/styles/desktop.css`): its generic post-render grid/home/students/sessions hooks may be **removed/neutralised for your
   screens** with small edits to the part that belongs to you (students agent: `studentsTable()`/`studentsPage` wrapper;
   sessions agent: `sessionsPage` wrapper; home agent: `restructureHome`) — edit only that block.
10. Do not run git commands that change history; **do not commit or push** — the lead integrates and publishes.

## Files you own (and only these)
| Agent | JS | CSS |
|---|---|---|
| sessions | `src/features/native/sessions.js` | `src/styles/native-sessions.css` |
| roster | `…/roster.js` | `…/native-roster.css` |
| students | `…/students.js` | `…/native-students.css` |
| plans | `…/plans.js` | `…/native-plans.css` |
| phases | `…/phases.js` | `…/native-phases.css` |
| management | `…/management.js` | `…/native-management.css` |
| community | `…/community.js` | `…/native-community.css` |
| reports | `…/reports.js` | `…/native-reports.css` |
| certificates | `…/certificates.js` | `…/native-certificates.css` |
| tools | `…/tools.js` | `…/native-tools.css` |
| home | `…/home.js` | `…/native-home.css` |
All of them are already imported and loaded by `src/main.js` after the legacy and RC27 layers (so your overrides win). They are classic
scripts (IIFE, no imports/exports; use globals). You may add new helper files only inside your own file.

## Build, run, test (use your OWN output dir and port; other agents work in parallel in the same tree)
```sh
cd /home/user/work/web39
npx vite build --outDir /tmp/dist-<agent>            # transient errors from another agent's half-edited file: just retry
node scripts/postbuild.mjs  # not needed for testing
cd /tmp/dist-<agent> && python3 -m http.server <PORT> &   # PORT: sessions 8801, roster 8802, students 8803, plans 8804, phases 8805,
                                                          # management 8806, community 8807, reports 8808, certificates 8809, tools 8810, home 8811
```
Browser tests: Playwright is global: `export NODE_PATH=/opt/node22/lib/node_modules` then `require('playwright')` (chromium is
preinstalled; do not run `playwright install`). A working mock harness is `/home/user/work/shots/shoot.cjs` (routes
`**/rest/v1/**` to mock JSON, injects `state` and calls `render()`); copy and adapt it to your screens: mock the tables your
screen reads and `page.route` the RPCs it calls so the screen shows realistic data (several students, sessions, plans…).
Screenshot at 390×844 (phone, `/?view=mobile`), 1440×900 (desktop, `/?view=desktop`) and a dark-mode shot; **open every PNG
with the Read tool and critically compare with what the Compose code produces; fix until it genuinely looks like the app.**
Also click through the interactions (menus, dialogs, tabs, filters, save/cancel) and check there are no `pageerror`s.
Also run `npm run -s check:browser` at the end (needs `npx vite preview --port 4173` and `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`)
only if you touched shared behaviour — otherwise skip.

## Deliverable
Working code in your files, plus a final report (max ~40 lines): screens/dialogs ported, legacy handlers reused, anything you
could not port and why (be honest), files touched outside your own (should be none or tiny), and how you verified.
