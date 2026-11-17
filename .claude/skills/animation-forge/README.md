# Animation Forge

The world's most comprehensive web animation skill for Claude Code. 25+ years of motion design expertise distilled into a system that covers GSAP, Remotion, CSS animations, Motion (formerly Framer Motion), micro-interactions, scroll choreography, page transitions, physics-based animation, and Awwwards-winning motion patterns.

**6,331 lines** of research-verified, copy-pasteable animation knowledge.

## What Makes This Different

This is **not** an API reference. The official GSAP skills (`gsap-core`, `gsap-plugins`, `gsap-scrolltrigger`) already cover that.

Animation Forge is **animation mastery** — the creative judgment, choreographic instinct, and technical craft that separates amateur motion from Awwwards-winning animation. It teaches you *when* to animate, *what* to animate, and *how* to make motion feel alive.

## What's Inside

| File | Lines | Covers |
|------|-------|--------|
| **SKILL.md** | 952 | Disney's 12 principles for web, Four Laws of Motion, Easing Bible, tech decision matrix, stagger principle, scroll architecture, text animation, micro-interaction philosophy, loading choreography, Remotion strategy, Motion Audit, Awwwards 2025 patterns |
| **references/micro-interactions.md** | 712 | Buttons, links, inputs, toggles, tooltips, cards, cursors, navigation — all with full code |
| **references/scroll-choreography.md** | 629 | IntersectionObserver, ScrollTrigger, batch reveals, pinned storytelling, horizontal scroll, parallax, CSS scroll-driven animations |
| **references/page-transitions.md** | 643 | Next.js transitions, loading choreography, skeleton screens, View Transitions API, `@starting-style` |
| **references/gsap-recipes.md** | 667 | Magnetic buttons, custom cursors, text scramble, FLIP, infinite marquee, SVG line draw |
| **references/remotion-motion-graphics.md** | 703 | 3 complete compositions, Remotion v4.x, rendering, server-side personalized video |
| **references/physics-and-3d.md** | 689 | Spring physics, Lenis momentum, 3D transforms, card tilt, `linear()` CSS easing |
| **references/olivier-larose-patterns.md** | 1,336 | 14 production-ready Awwwards patterns: text parallax, sticky cursor, magnetic button, blend mode cursor, side menu, SVG mask transition, pinned gallery, horizontal scroll, and more |

## Research-Verified

Every fact was verified against current (April 2026) official documentation:

- **GSAP 3.14.2** — Verified against gsap.com docs. Fixed: GSAP has no `spring()` ease (uses `elastic`/`back`/`bounce`)
- **Motion 12.38.0** — Updated from "Framer Motion" rebrand. Import: `motion/react`
- **Lenis 1.3.21** — Updated from `@studio-freight/lenis` rename. React: `lenis/react`
- **Remotion 4.0.443** — Rust-based rendering, `@remotion/media`, Tailwind support
- **View Transitions API** — ~90% SPA / ~85% MPA browser support
- **CSS `@starting-style`** — ~89% support, production-ready
- **CSS `linear()` easing** — ~90% support, spring/bounce in pure CSS

## Install

```bash
git clone https://github.com/Eskapeum/animation-forge.git ~/.claude/skills/animation-forge
```

## Usage

The skill triggers automatically on: animate, animation, motion, GSAP, scroll animation, micro-interaction, page transition, hover effect, loading animation, text reveal, parallax, smooth scroll, kinetic typography, motion graphics.

Or run `/animation-forge` directly.

## Works Great With

- **[Design Forge](https://github.com/Eskapeum/design-forge)** — Awwwards-level visual design pipeline
- **[Design Audit](https://github.com/Eskapeum/design-audit)** — Website design quality auditor
- **Official GSAP Skills** — [greensock/gsap-skills](https://github.com/greensock/gsap-skills) for API reference

## Credits

- Animation principles inspired by Disney's 12 Principles of Animation
- Practitioner patterns from [Olivier Larose](https://blog.olivierlarose.com)
- Performance tier list from [motion.dev](https://motion.dev/magazine/web-animation-performance-tier-list)
- Awwwards patterns from 2025 SOTD winners

## License

MIT
