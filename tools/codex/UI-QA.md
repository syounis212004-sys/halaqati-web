# UI and visual QA

Setup preserves the existing UI. Use installed UI/UX Pro Max and frontend design skills
for future design tasks; use Android design/Compose guidance for native screens.

## Shared tokens and Arabic

Android's archived `design/tokens.json` already matches Web's
`web-src/src/styles/tokens.css` (28 values). Run
`python3 tools/codex/design-parity.py --workspace <parent-of-both-repositories>`.
For future token changes, edit the Android source JSON, use its existing
`scripts/gen-tokens.py`, review the generated CSS/Kotlin reference, and apply the
matching web change in its own branch. Token checks do not prove every screen consumes
those tokens. Do not introduce a new design system during setup.

Test Arabic text and bidirectional numbers/Latin strings, logical start/end placement,
navigation icons, Cairo font fallback, long student names, loading/empty/error states,
keyboard focus, contrast, 200% web text zoom and Android font scaling. Preserve light
and dark themes. Web touch targets should be at least 44px; Android at least 48dp.
Use existing theme colors rather than hardcoded replacements.

## Web screenshots and visual regression

From the independent web checkout:

```sh
npm --prefix web-src run build
# Start a preview, then run checks from another terminal:
npm --prefix web-src run preview -- --host 127.0.0.1 --port 4173
BASE_URL=http://127.0.0.1:4173 npm --prefix web-src run check:browser
BASE_URL=http://127.0.0.1:4173 npm --prefix tools/codex run test:visual
```

The existing browser suite uses synthetic admin/teacher/supervisor/guardian data and
checks navigation, certificates, PDF export, update safety, and five widths. New checks
capture the login in both themes at 360/390/768/1024/1440px, assert Arabic RTL and no
horizontal overflow, and run axe WCAG AA. External traffic and service workers are
blocked. HTML reports and failure traces are in `tools/codex/playwright-report/`;
open them with `tools/codex/node_modules/.bin/playwright show-report tools/codex/playwright-report`.

Screenshot capture runs by default. Pixel comparison is opt-in until a human reviews
the first baseline. To create a candidate in a consistent CI OS/browser/font environment:

```sh
VISUAL_BASELINE=1 BASE_URL=http://127.0.0.1:4173 npm --prefix tools/codex run test:visual:update
# Review tests/rtl.spec.mjs-snapshots/ images, then commit the accepted baseline.
VISUAL_BASELINE=1 BASE_URL=http://127.0.0.1:4173 npm --prefix tools/codex run test:visual
```

Never update baselines automatically to hide regressions. Accessibility assertions remain
active during baseline creation. Existing failures are documented in VERIFICATION.md.

## Android device verification

Native debug assembly and Android Lint are available through `gradle.py`. Existing
Compose instrumentation tests live in `app/src/androidTest`. This Cloud machine has no
attached device or `/dev/kvm`; no Android emulator/screenshot execution is verified.
From the Android checkout, on a disposable authorized test device or emulator, run:

```sh
source tools/codex/env.sh
adb devices -l
ANDROID_SERIAL=<test-device-serial> bash tools/codex/android-ui.sh
```

This installs/runs the existing instrumentation suite and captures the visible screen.
Use test accounts and a staging backend; do not attach a personal production installation
for destructive test flows. Exercise RTL, font scale, both themes, navigation and process
recreation. Report device UI checks separately from static/build checks.
