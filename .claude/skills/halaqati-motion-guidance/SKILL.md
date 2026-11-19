---
name: halaqati-motion-guidance
description: Halaqati project rules for motion and animation. Load before adding, changing or reviewing any animation, transition or motion in the Halaqati app. Sets which motion skill to use (native Compose vs web), and the project constraints for RTL, reduced motion, performance, battery and dependencies. Project rules override the generic motion skills.
---

# Halaqati motion guidance

This file is project policy. It does not replace the installed motion skills; it says which one applies and which limits win when they disagree.

## Which skill to use

| Target | Use |
|---|---|
| Native Android app (Kotlin, Jetpack Compose, Material 3). **Primary target.** | `wnb-compose-animation` |
| Legacy Vite / JavaScript web app (`migration/legacy-*`), a secondary reference only | `micro-interaction`, `60fps-animation`, `accessible-animation`, `lottie-animation` |

- Do not apply the web skills (CSS, Framer Motion, GSAP, `@lottiefiles/*`, `npx playwright`) to Kotlin code.
- Use `android-design` and `mobile-android-design` for what the motion should look like. Use `wnb-compose-animation` for whether and how to animate.

## Rules

1. **Compose first.** Native Compose animation APIs only: `AnimatedVisibility`, `animate*AsState`, `updateTransition`/`rememberTransition`, `AnimatedContent`, `Crossfade`, `animateContentSize`, `Animatable`. Pick the smallest API that fits.
2. **No new libraries.** Never add an animation-related dependency (Lottie, Rive, Accompanist, motion or physics libraries, and so on) without explicit approval from the project owner. The web skills' `npm i` lines never apply to the Android app.
3. **RTL.** Halaqati is Arabic and RTL by default. Directional motion (slides, swipes, shared-axis transitions, progress and carousel direction, enter/exit offsets) must follow `LocalLayoutDirection`: "forward" means leftward in RTL. Never hard-code a left or right sign for a slide offset.
4. **Reduced motion.** Honor the system "remove animations" setting (`ANIMATOR_DURATION_SCALE` = 0 and the platform's reduce-motion setting). When it is on, replace movement with an instant change or a plain fade. State changes must still be visible.
5. **Subtle and purposeful.** Animate only to explain a state change, keep spatial context, or give feedback. If an animation has no job, remove it. Keep durations short, using Material 3 motion tokens where available.
6. **No wasteful motion.**
   - No infinite or repeating animations unless they communicate ongoing work, and they must stop when the screen is off, hidden or the work is done.
   - Do not read frame-updating state in a composable body. Defer reads to `graphicsLayer {}`, `drawBehind`, or lambda-based modifiers so the animation does not recompose every frame.
   - Keep animation out of long `LazyColumn` or `LazyRow` item content unless it is bounded and needed.
   - Target mid-range Android devices and battery life. Prefer animating `graphicsLayer` properties (alpha, scale, translation) over layout-changing ones.
7. **Preserve behavior.** Motion must not change business logic, navigation graph, back-stack, deep links, role-based destinations or sync behavior. An animation is never a reason to delay an action or block input.
8. **Labels and testing.** Give animations a `label`. Test with `mainClock.advanceTimeBy`, never `Thread.sleep`.

## Conflicts

If a generic motion skill disagrees with this file, follow this file. If this file disagrees with accessibility or Android platform behavior, follow accessibility and the platform.
