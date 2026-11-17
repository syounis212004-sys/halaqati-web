---
name: animation-forge
description: "The world's most comprehensive web animation skill. 25+ years of motion design expertise covering GSAP, Remotion, CSS animations, Motion (formerly Framer Motion), micro-interactions, scroll choreography, page transitions, physics-based animation, and Awwwards-winning motion patterns. Triggers on: animate, animation, motion, GSAP, scroll animation, micro-interaction, page transition, hover effect, loading animation, text reveal, parallax, smooth scroll, kinetic typography, motion graphics, or any request to add movement to a web interface. This is the animation director's brain — not just what to call, but WHEN to animate, WHAT to animate, and HOW to make motion feel alive."
---

# Animation Forge — 25 Years of Motion Mastery

> "Animation is not about making things move. It's about making things feel alive."

This skill is the definitive guide to web animation. It doesn't teach you API calls (that's what gsap-core, gsap-plugins, and gsap-scrolltrigger are for). It teaches you **animation thinking** — the creative judgment, choreographic instinct, and technical craft that separates amateur motion from Awwwards-winning animation.

Before animating ANYTHING, read Part 1. Before writing animation code, check the technology decision matrix in Part 3. Before shipping, run the motion audit in Part 10.

| Reference File | When to Read |
|---|---|
| `references/micro-interactions.md` | Hover states, button feedback, input focus, toggles, tooltips |
| `references/scroll-choreography.md` | Scroll reveals, parallax, pinning, scrub, horizontal scroll |
| `references/page-transitions.md` | Route changes, loading choreography, skeleton screens, view transitions |
| `references/gsap-recipes.md` | Creative GSAP patterns: text reveals, morphing, magnetic elements, cursor effects |
| `references/remotion-motion-graphics.md` | Programmatic video, kinetic typography, data visualization videos |
| `references/physics-and-3d.md` | Spring animations, momentum, 3D transforms, perspective, tilt effects |
| `references/olivier-larose-patterns.md` | Production recipes: text parallax, magnetic buttons, sticky cursors, blend mode, side menus, pinned galleries |

---

## Part 1: The Philosophy of Motion

### Disney's 12 Principles — Adapted for the Web

These twelve principles were codified by Disney animators Frank Thomas and Ollie Johnston in 1981. They are the foundation of all motion that feels alive. Here is every single one, reinterpreted for the screen you ship to.

#### 1. Squash and Stretch — Scale Transforms on Buttons and Cards

**Original**: Objects deform when force is applied, preserving volume. A bouncing ball squashes on impact and stretches in flight.

**Web adaptation**: Interactive elements should respond to force. A button pressed compresses slightly along the Y axis. A card dragged stretches toward the drag direction. The key constraint: preserve perceived volume by scaling inversely on the opposing axis.

```css
.button:active {
  transform: scaleY(0.95) scaleX(1.02);
  transition: transform 100ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

**Common mistake**: Scaling uniformly (scale(0.95)) looks like the element is shrinking, not being pressed. Always squash one axis and stretch the other.

#### 2. Anticipation — The Wind-Up Before the Action

**Original**: A character crouches before jumping. The audience reads this and expects the action.

**Web adaptation**: Before a big motion, give a small counter-motion. A delete button shrinks slightly before the item flies off screen. A modal scales to 0.95 for 100ms before springing to 1.0. The user's eye registers "something is about to happen."

```javascript
gsap.timeline()
  .to(".modal", { scale: 0.95, duration: 0.1, ease: "power2.in" })
  .to(".modal", { scale: 1, duration: 0.4, ease: "back.out(1.7)" });
```

**Common mistake**: Making anticipation too slow. On the web, wind-up should be 50-150ms. Any longer and it feels sluggish.

#### 3. Staging — Visual Hierarchy Through Motion

**Original**: Pose the character and scene so the audience's eye goes to the important action.

**Web adaptation**: What animates first draws the eye. If your hero headline and a sidebar widget both animate at once, neither has focus. Animate the most important element first, then cascade secondary elements with stagger. Motion IS your visual hierarchy.

```javascript
gsap.timeline()
  .from(".hero-headline", { y: 40, opacity: 0, duration: 0.6, ease: "power3.out" })
  .from(".hero-subtitle", { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.3")
  .from(".hero-cta", { y: 20, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.2");
```

**Common mistake**: Animating everything at once with the same stagger. Instead, group elements by importance and animate groups sequentially.

#### 4. Straight Ahead vs. Pose to Pose — Procedural vs. Keyframed

**Original**: "Straight ahead" draws frame by frame for organic motion. "Pose to pose" defines key positions and fills between.

**Web adaptation**: Procedural animation (physics simulations, particle systems, generative art) produces organic, unpredictable motion. Keyframed animation (GSAP timelines, CSS keyframes) produces controlled, choreographed motion. Use procedural for ambient decoration, keyframed for intentional storytelling.

```css
/* Procedural: ambient floating (straight ahead) */
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  33% { transform: translateY(-10px) rotate(2deg); }
  66% { transform: translateY(-5px) rotate(-1deg); }
}

.ambient-element {
  animation: float 6s ease-in-out infinite;
}
```

**Common mistake**: Using procedural techniques for UI animation where precision matters. Users need predictable motion for interactive elements.

#### 5. Follow Through and Overlapping Action — Stagger and Elastic Overshoot

**Original**: Not everything stops at the same time. Hair follows the head, a coat follows the body.

**Web adaptation**: When a card enters, its shadow follows slightly after. When a list appears, items cascade with stagger. When a modal arrives at its position, the content inside overshoots slightly then settles. Child elements should lag behind their parent.

```javascript
gsap.timeline()
  .to(".card", { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" })
  .from(".card-content > *", {
    y: 15, opacity: 0, duration: 0.4,
    stagger: 0.06, ease: "power2.out"
  }, "-=0.2");
```

**Common mistake**: Having all child elements arrive with their parent. The 50-100ms delay for children is what makes motion feel physical, not digital.

#### 6. Slow In, Slow Out — Easing Curves (THE Most Important Principle)

**Original**: Objects accelerate and decelerate rather than moving at constant speed.

**Web adaptation**: This is the single most important principle for the web. NEVER use linear easing for UI animation. Every element should accelerate into motion and decelerate to a stop, just like a physical object. See Part 2: The Easing Bible for the complete guide.

```css
/* BAD: linear feels robotic */
.element { transition: transform 300ms linear; }

/* GOOD: ease-out feels like natural arrival */
.element { transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1); }
```

**Common mistake**: Using CSS `ease` (the default). It's technically an easing curve, but it's generic and characterless. Define your own cubic-bezier for brand personality.

#### 7. Arc — Motion Paths, Not Straight Lines

**Original**: Natural motion follows arced trajectories. A thrown ball moves in a parabola, not a straight line.

**Web adaptation**: When moving an element from point A to point B, consider whether a curved path feels more natural. Notifications sliding in from the corner should arc slightly. Elements being repositioned (FLIP animations) should follow a subtle curve rather than a rigid diagonal.

```javascript
gsap.to(".element", {
  motionPath: {
    path: [{ x: 0, y: 0 }, { x: 150, y: -50 }, { x: 300, y: 0 }],
    curviness: 1.5
  },
  duration: 0.8,
  ease: "power2.inOut"
});
```

**Common mistake**: Overusing arcs. For simple reveals (fade up, slide in from bottom), straight motion is correct. Arcs are for repositioning and lateral movement.

#### 8. Secondary Action — Background Motion While Primary Action Happens

**Original**: While a character walks (primary action), their arms swing (secondary action).

**Web adaptation**: While the main content transitions (primary), the background subtly shifts or blurs (secondary). While a form validates (primary), the submit button pulses with a subtle glow (secondary). Secondary actions reinforce the primary action without competing for attention.

```javascript
gsap.timeline()
  .to(".page-content", { opacity: 0, y: -20, duration: 0.3 })
  .to(".page-bg", { scale: 1.02, filter: "blur(4px)", duration: 0.4 }, 0)
  .set(".page-content", { clearProps: "all" });
```

**Common mistake**: Making secondary actions too prominent. They should be barely noticeable — felt, not seen.

#### 9. Timing — The Duration Hierarchy

**Original**: The speed of an action defines its weight and mood.

**Web adaptation**: Duration is not one-size-fits-all. A button color change needs 150ms. A page transition needs 600ms. A cinematic hero reveal needs 1200ms. Consistent duration hierarchy across your project creates rhythm — the user subconsciously learns the pacing of your interface.

| Scope | Duration | Example |
|---|---|---|
| Micro | 100-200ms | Button color, icon swap, checkbox |
| Component | 200-400ms | Card expand, dropdown, accordion |
| Section | 400-700ms | Scroll reveal, image transition |
| Page | 600-1000ms | Route change, hero entrance |
| Cinematic | 1000-2000ms | Full-page intro, brand moment |
| Never | >2000ms | Nothing should take this long (except intentional art) |

**Common mistake**: Using the same duration for everything. If a button and a page transition both take 300ms, the button feels sluggish and the page feels rushed.

#### 10. Exaggeration — Scale and Position Amplification

**Original**: Push the action beyond reality for emphasis.

**Web adaptation**: Overshoot. A notification counter that jumps from 3 to 4 should scale up to 1.2 then settle to 1.0. A toggle that snaps to its new position should overshoot by 10% then rubber-band back. The exaggeration is small (5-20%) but it transforms mechanical motion into living motion.

```javascript
gsap.to(".counter", {
  scale: 1.2,
  duration: 0.15,
  ease: "power2.out",
  yoyo: true,
  repeat: 1
});
```

**Common mistake**: Exaggerating everything equally. Reserve strong exaggeration (elastic, bounce) for moments of delight. Subtler overshoot (back easing) for everyday interactions.

#### 11. Solid Drawing — 3D Transforms, Perspective, Depth

**Original**: Give characters weight and volume through solid, three-dimensional drawing.

**Web adaptation**: Elements should feel like they exist in space. Use perspective and 3D transforms to give cards depth when tilted. Use shadow scaling to reinforce the illusion of lift. The z-axis is your friend.

```css
.card-container { perspective: 1000px; }

.card:hover {
  transform: rotateY(5deg) rotateX(-3deg) translateZ(20px);
  box-shadow: -10px 10px 30px rgba(0,0,0,0.15);
  transition: all 400ms cubic-bezier(0.25, 1, 0.5, 1);
}
```

**Common mistake**: Forgetting `perspective` on the parent container. Without it, 3D transforms look flat. 800-1200px is the sweet spot for subtle 3D.

#### 12. Appeal — The Je Ne Sais Quoi

**Original**: The character must be interesting to watch, not necessarily beautiful.

**Web adaptation**: Motion should have personality. Is your brand playful? Use spring easing and elastic overshoot. Is it corporate? Use smooth power easing with no overshoot. Is it luxurious? Use slow, deliberate timing with long easing curves. The personality of your motion IS the personality of your brand.

**Common mistake**: Defaulting to "safe" animation. Generic ease-in-out on everything is technically correct but has zero personality. Pick a vibe and commit.

---

### The Four Laws of Web Motion

**Law 1: Motion Must Have Purpose**
Every animation serves exactly ONE of: Orientation (where am I?), Focus (what should I look at?), Feedback (what just happened?), or Delight (that felt good). If it serves none, delete it. If it serves two, simplify — one purpose per motion.

**Law 2: The Eye Follows Motion**
Animation is a directorial tool. Whatever moves, the user looks at. This means: animate what matters, still what doesn't. Never animate two things equally — one must lead, others must follow.

**Law 3: Physics Creates Trust**
Humans live in a physical world. When digital elements obey physical laws (momentum, gravity, friction, elasticity), they feel trustworthy. When they teleport or move linearly, they feel alien. Use easing. Always. No exceptions.

**Law 4: Less Motion, More Emotion**
The amateur animates everything. The master animates one thing perfectly. A single, perfectly-timed text reveal with the right easing curve creates more impact than a page full of flying elements. The Linear.app homepage proves this — minimal motion, maximum impact.

### The "Would It Win SOTD?" Motion Test

Five questions before shipping:
1. Does every animation have a clear purpose? (orientation / focus / feedback / delight)
2. Is the timing hierarchy consistent? (micro < component < section < page)
3. Do all easing curves match the brand personality?
4. Does it respect `prefers-reduced-motion`?
5. Does the motion FEEL like something? (weight, momentum, personality)

If you answer "no" to any of these, go back and fix it. Ships that win Site of the Day pass all five.

---

## Part 2: The Easing Bible

This is the MOST important section of the entire skill. Easing is to animation what tone of voice is to writing. Wrong easing = wrong feeling, no matter how perfect your timing and choreography are.

### The Easing Personality Chart

| Easing | CSS Value | Feeling | Use For |
|---|---|---|---|
| ease-out-expo | `cubic-bezier(0.16, 1, 0.3, 1)` | Confident arrival | Elements entering viewport, dropdowns opening, hero reveals |
| ease-out-quart | `cubic-bezier(0.25, 1, 0.5, 1)` | Gentle landing | Subtle reveals, fade-ins, tooltip appearances |
| ease-out-back | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful bounce | Modals, toasts, notifications, playful UI elements |
| ease-in-out-quint | `cubic-bezier(0.83, 0, 0.17, 1)` | Smooth morph | Size changes, color transitions, repositioning |
| ease-in-expo | `cubic-bezier(0.7, 0, 0.84, 0)` | Quick exit | Elements leaving viewport, closing panels, dismissal |
| ease-in-out-cubic | `cubic-bezier(0.65, 0, 0.35, 1)` | Professional neutral | General-purpose, safe default for brand-agnostic motion |
| ease-out-circ | `cubic-bezier(0, 0.55, 0.45, 1)` | Mechanical precision | Progress indicators, meter fills, data visualization |
| ease-in-quart | `cubic-bezier(0.5, 0, 0.75, 0)` | Gathering speed | Wind-up before a big action, anticipation |
| elastic.out(1, 0.5) | GSAP elastic | Natural bounce | Buttons, toggles, interactive elements |
| elastic.out(1, 0.3) | GSAP elastic | Playful overshoot | Badges, counters, gamification elements |
| power4.out | GSAP power | Professional arrival | Corporate/fintech hero animations, landing page reveals |
| back.out(1.7) | GSAP back | Confident overshoot | Modals, dialogs, popovers that need presence |

### The Cardinal Rules of Easing

1. **NEVER** use `linear` for UI animation. Linear = robotic. (Exception: progress bars, infinite marquees, loading spinners.)
2. **NEVER** use CSS `ease` (the default). It is generic and characterless. Define your own cubic-bezier.
3. Entrances use **ease-OUT** (fast start, gentle stop — the element arrives).
4. Exits use **ease-IN** (gentle start, fast end — the element departs).
5. In-place changes use **ease-IN-OUT** (gentle start and stop — the element morphs).
6. Pick **ONE** primary easing curve for your project and use it for 80% of animations. Consistency creates brand identity in motion.
7. Match easing to brand: playful brands use back/elastic, corporate brands use power/expo, luxury brands use slow quint/circ.

### CSS Custom Properties for Easing (Project Setup)

Every project should define these once and use them everywhere:

```css
:root {
  /* Primary easing — used for 80% of animations */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.83, 0, 0.17, 1);

  /* Special purpose */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-gentle: cubic-bezier(0.25, 1, 0.5, 1);

  /* Duration scale */
  --duration-micro: 150ms;
  --duration-component: 300ms;
  --duration-section: 500ms;
  --duration-page: 800ms;
}
```

### The Duration Hierarchy (CRITICAL)

| Scope | Duration | Example |
|---|---|---|
| Micro | 100-200ms | Button color, icon swap, checkbox, toggle |
| Component | 200-400ms | Card expand, dropdown open, accordion, tab switch |
| Section | 400-700ms | Scroll reveal, image cross-fade, content entrance |
| Page | 600-1000ms | Route transition, hero entrance, loading sequence |
| Cinematic | 1000-2000ms | Full-page intro, brand moment, video-like sequence |
| Illegal | >2000ms | Nothing. Ever. (Unless it is literal art.) |

Rule: Users perceive delays >400ms as "slow." Keep interactive feedback under 200ms. If you make a user wait for an animation to finish before they can interact, you have failed.

---

## Part 3: Technology Decision Matrix

### When to Use What

| Scenario | Best Tool | Why |
|---|---|---|
| Simple hover/focus states | CSS transitions | Zero JS overhead, GPU-accelerated |
| Keyframe loops (no interaction) | CSS @keyframes | Declarative, runs on compositor thread |
| Complex sequenced animations | GSAP Timeline | Best choreography API, reversible, precise |
| Scroll-linked animation | GSAP ScrollTrigger | Most flexible scroll animation library |
| React component mount/unmount | Motion (formerly Framer Motion) | AnimatePresence handles exit animations |
| Physics/spring animations | Motion spring | Best spring physics API (stiffness, damping, mass). React Spring as alternative |
| Text splitting/character reveal | GSAP SplitText | Most robust text splitting, handles resize |
| Programmatic video generation | Remotion | React components render to MP4/WebM |
| SVG morphing | GSAP MorphSVG | Only reliable cross-browser SVG morph |
| Drag interactions | GSAP Draggable | Momentum, snap, bounds, inertia |
| Smooth scrolling library | Lenis | Best momentum scrolling feel |
| View transitions (MPA) | View Transitions API | Native browser, progressive enhancement |
| CSS scroll-driven animations | `animation-timeline: scroll()` | Runs on compositor thread, ~90% browser support. Firefox needs fallback |
| Interactive motion graphics | Rive | State machines, cross-platform, used by Spotify/Duolingo |
| DOM enter/exit animations | CSS `@starting-style` + `transition-behavior: allow-discrete` | ~89% browser support, no JS needed |
| Spring/bounce in pure CSS | `linear()` easing function | ~90% browser support, generate via linear-easing-generator |
| Zero-config list animations | AutoAnimate | Single function, framework-agnostic |
| 3D transforms | CSS transforms + GSAP | CSS for static hover, GSAP for animated sequences |
| Data visualization animation | D3 + GSAP | D3 calculates, GSAP animates |
| Responsive animation | GSAP matchMedia | Media-query-scoped animations with proper cleanup |

### The "Can CSS Do It?" Test

Before reaching for JavaScript, answer these questions in order:

1. Is it a simple state change? (hover, focus, active) --> **CSS transition**
2. Is it a looping ambient animation? --> **CSS @keyframes**
3. Does it need to respond to scroll position? --> **GSAP ScrollTrigger**
4. Does it need to be sequenced or choreographed? --> **GSAP Timeline**
5. Does it need to be interruptible or reversible? --> **GSAP or Motion (formerly Framer Motion)**
6. Does it need physics or spring behavior? --> **Motion spring or GSAP**
7. Does it need to animate on mount AND unmount in React? --> **Motion AnimatePresence**

If your answer was #1 or #2, keep it in CSS. The browser's compositor thread handles these without touching the main thread. More performant, less code, fewer bugs.

---

## Part 4: The Stagger Principle

Staggering is the single most impactful technique in web animation. It transforms a flat, lifeless page into a choreographed performance. If you learn one thing from this skill, let it be staggering.

### The Rules of Stagger

1. Siblings should **NEVER** enter simultaneously. Always stagger by 50-100ms.
2. Stagger direction should follow reading direction (LTR cultures: left to right, top to bottom).
3. Stagger delay should be **SHORTER** than individual animation duration (creates overlap, feels fluid).
4. Maximum total stagger time for a group: approximately 500ms. Beyond that, users get impatient.
5. The FIRST element should have 0 delay. Do not make users wait for the stagger to begin.
6. Stagger amounts should DECREASE for larger sets. 10 items at 100ms = 1 second wait. Use 50ms for 10+ items.

### Stagger Patterns

#### Linear Stagger (Default)
Equal delay between each element. Simple, reliable, works for lists and grids.

```javascript
gsap.from(".list-item", {
  y: 30,
  opacity: 0,
  duration: 0.5,
  stagger: 0.08,
  ease: "power2.out"
});
```

#### Center-Out Stagger
Elements from the center animate first, edges animate last. Creates a radial explosion effect. Excellent for grids and galleries.

```javascript
gsap.from(".grid-item", {
  y: 40,
  opacity: 0,
  duration: 0.6,
  stagger: {
    amount: 0.8,
    grid: "auto",
    from: "center"
  },
  ease: "power2.out"
});
```

#### Random Stagger
Adds an organic, natural feeling. Mimics how things appear in the real world — never perfectly ordered.

```javascript
gsap.from(".particle", {
  scale: 0,
  opacity: 0,
  duration: 0.4,
  stagger: {
    each: 0.05,
    from: "random"
  },
  ease: "back.out(1.7)"
});
```

#### Axis Stagger (The Awwwards Move)
Stagger by both X and Y position in a grid. Creates a wave that rolls diagonally across the grid. This is what you see on award-winning portfolio sites.

```javascript
gsap.from(".grid-item", {
  y: 60,
  opacity: 0,
  duration: 0.7,
  stagger: {
    amount: 1,
    grid: [4, 3],
    axis: "y",
    from: "start"
  },
  ease: "power3.out"
});
```

---

## Part 5: Scroll Animation Architecture

See `references/scroll-choreography.md` for full code recipes. This section covers the strategic thinking.

### The Scroll Animation Spectrum

From least to most complex (and risk):

1. **Scroll-triggered reveal** — Fade in when visible. IntersectionObserver or ScrollTrigger with `toggleActions`.
2. **Staggered scroll reveal** — Multiple elements cascade in on scroll. The bread and butter of modern web design.
3. **Scrubbed animation** — Animation progress tied 1:1 to scroll position. The user controls the playhead.
4. **Pinned animation** — Element pins in place while scroll drives through a sequence. The Linear.app feature section technique.
5. **Horizontal scroll** — Vertical scroll converts to horizontal movement. Impressive but use with care.
6. **Parallax layers** — Elements at different depths move at different speeds. Creates spatial depth.
7. **Scroll-jacking** — Full sections snap into place. Controversial. Use only when the content model demands it.

### The Golden Rule of Scroll Animation

**Scroll animation should ENHANCE comprehension, not obstruct it.** If the user has to scroll to "unlock" content they could simply read, you have failed. The best scroll animations reveal content at the natural pace of reading — they make scrolling more engaging, not more frustrating.

### Performance Rules for Scroll

- ALWAYS use `scrub: true` with a numeric value (like `scrub: 1`) for buttery smooth scrubbed animations. `scrub: true` (boolean) is instant and looks janky.
- Pin as few elements as possible. Each pin creates a layout shift that the browser must manage.
- Parallax on mobile: either disable it or reduce the movement by 50%. Mobile GPUs and battery life cannot handle aggressive parallax.
- Use `gsap.matchMedia()` to disable heavy scroll animations on mobile/reduced-motion.

---

## Part 6: Text Animation Mastery

See `references/gsap-recipes.md` for full code. This section covers which text animation to use and when.

### The Typography Animation Spectrum

Ranked by impact (and complexity):

1. **Fade up** — Words or lines slide up and fade in. Works everywhere, always looks good. The workhorse.
2. **Clip reveal** — Text slides up from behind a clip-path or overflow:hidden mask. More polished than fade. Used on every Awwwards SOTD.
3. **Character reveal** — Characters appear one by one with stagger. High impact for hero headlines.
4. **Scramble/decode** — Characters scramble before resolving to the final text. Tech/hacker aesthetic.
5. **Kinetic typography** — Letters physically move, bounce, scale independently. Full creative expression.
6. **Morphing text** — One word transforms into another via SVG path morphing. Maximum technical complexity.

### When to Use Each

| Context | Technique | Why |
|---|---|---|
| Body text / paragraphs | Fade up by line | Readable, non-distracting, enhances flow |
| Hero headline | Character reveal or clip reveal | High impact, sets the tone |
| Navigation links | Individual fade + stagger | Quick, functional, establishes nav hierarchy |
| Data / statistics | Counter roll + snap | Numbers feel dynamic, creates urgency |
| Brand name / logo type | Scramble or kinetic | Strong identity moment |
| Transitioning between states | Morphing text | Conceptual connection between states |

### The Golden Rule of Text Animation

Never animate text that the user needs to read urgently. Error messages, form validation, critical alerts — these appear instantly. Animation is for storytelling, not for gatekeeping information.

---

## Part 7: Micro-Interaction Philosophy

See `references/micro-interactions.md` for the full library. This section covers the thinking.

### What Makes a Micro-Interaction Premium

The difference between a site that charges $50/hr and one that charges $500/hr? Micro-interactions. They are the fingerprints of quality — individually tiny, collectively transformative.

### The Four Stages (Dan Saffer's Model)

1. **Trigger** — User action (hover, click, focus) or system event (load, error, success)
2. **Rules** — What happens in response (animation plays, state changes, data updates)
3. **Feedback** — Visual/audio confirmation that the action registered (color change, scale, sound)
4. **Loops and Modes** — What happens on repeat, and how does state affect behavior?

### The Interactive Element Contract

Every interactive element MUST have these states, and each transition between states must be animated:

| State | Visual Treatment | Transition Duration |
|---|---|---|
| Rest | Default appearance | — |
| Hover | Subtle lift, color shift, cursor change | 150ms ease-out |
| Focus | Visible ring, enhanced contrast | 150ms ease-out |
| Active/Pressed | Compress, color darken, inner shadow | 100ms ease-in |
| Disabled | Reduced opacity, no cursor change | 200ms ease-in-out |
| Loading | Shimmer, spinner, pulsing opacity | 300ms ease-in-out loop |
| Success | Green flash, checkmark, scale pulse | 300ms ease-out |
| Error | Red flash, shake, error icon | 300ms ease-out |

### The Delight Budget

You get 2-3 delightful micro-interactions per page. The rest should be invisible — smooth, professional, expected. If every interaction tries to delight, nothing delights. Pick your moments:

- The first interaction (hero CTA hover)
- A completed action (form submission success)
- An Easter egg (logo click, Konami code)

Everything else? Smooth, fast, professional. No one needs a delightful checkbox.

---

## Part 8: Loading and Page Transition Choreography

See `references/page-transitions.md` for full code. This section covers the strategy.

### The First 3 Seconds

The page load IS the first impression. Here is the choreography that award-winning sites use:

| Timestamp | What Happens | Technique |
|---|---|---|
| 0ms | Critical CSS renders, layout visible | Inline critical CSS |
| 0-200ms | Navigation fades in | CSS animation, no JS dependency |
| 200-500ms | Hero headline reveals word by word | GSAP SplitText + stagger |
| 400-700ms | Hero image loads with blur-up | Low-res placeholder, progressive load |
| 600-900ms | Primary CTA scales in with spring | GSAP or Motion spring |
| 900ms+ | Below-fold content ready for scroll | IntersectionObserver lazy init |

### The Rules of Load Choreography

1. **Nothing waits for JavaScript.** Critical layout renders from CSS. JS animations enhance, not gate.
2. **Above the fold first.** Never animate below-fold content during page load. Nobody sees it.
3. **Content before chrome.** The headline appears before the decorative elements.
4. **Progressive enhancement.** Without JS, the page is fully readable. With JS, it is choreographed.
5. **No loading screens for content sites.** If users came to read, show them text immediately. Loading screens are for apps, not content.

### Route Transition Patterns

| Pattern | Visual | Best For |
|---|---|---|
| Crossfade | Old page fades out, new fades in | Universal safe default, content-heavy sites |
| Slide | New page slides in from the direction of navigation | Lateral navigation (tabs, categories) |
| Shared element | An element morphs between pages | Product cards to product pages, avatars |
| Cover | New page slides over old like a physical sheet | Dramatic, editorial, portfolio sites |
| Clip reveal | New page reveals through an expanding clip-path | Bold, geometric, design-forward sites |

---

## Part 9: Remotion — When Animation Becomes Video

See `references/remotion-motion-graphics.md` for full compositions. This section covers when and why.

### When to Use Remotion vs. Web Animation

| Question | Web Animation | Remotion |
|---|---|---|
| Is it interactive? | Yes | No (rendered to video) |
| Does the user control it? | Yes (scroll, hover, click) | No (plays linearly) |
| Will it be shared as a file? | No (lives in browser) | Yes (MP4, WebM, GIF) |
| Does it need to be pixel-perfect across devices? | Hard (responsive) | Yes (fixed resolution) |
| Can it be programmatic/data-driven? | Yes but complex | Yes, natively |

### Remotion Use Cases

- Social media content (Instagram reels, TikTok, Twitter video)
- Product demo videos (feature walkthroughs, onboarding)
- Data visualization videos (animated charts, infographics)
- Personalized video (customer name, data in the video)
- Presentations (animated slides with code-level control)
- Animated OG images / social cards

---

## Part 10: The Motion Audit

Run this before every ship. Print it. Tape it to your monitor.

### Performance Audit

- [ ] Only animating `transform`, `opacity`, `filter`, `clip-path` (compositor-friendly properties)
- [ ] No layout-triggering properties animated (width, height, top, left, margin, padding, border)
- [ ] `will-change` applied only to elements about to animate, removed after
- [ ] Animations hit 60fps on a mid-tier Android device (not just your M3 MacBook)
- [ ] Total animation JavaScript under 50KB gzipped (GSAP core = ~28KB, reasonable budget)
- [ ] No forced synchronous layouts in animation loops (read then write, never interleave)
- [ ] `gsap.ticker` or `requestAnimationFrame` used instead of `setInterval`/`setTimeout`

### Motion.dev Performance Tier List

| Tier | Properties | Why |
|---|---|---|
| **S-Tier** (compositor-only) | `transform`, `opacity`, `filter`, `clip-path` | Runs entirely on GPU compositor thread, zero layout or paint cost |
| **A-Tier** (JS-driven compositor) | JS animations updating compositor styles (GSAP, rAF) | Main thread calculates, compositor executes — smooth if not blocked |
| **B-Tier** (FLIP technique) | Layout change with `Flip.from()` / manual FLIP | One layout read + one layout write, then compositor animates |
| **C-Tier** (paint triggers) | `background-color`, `color`, `border-radius`, CSS custom property animations via `@property` | Triggers paint but not layout. Note: `@property` animations are C-tier — they trigger paint, NOT GPU-accelerated |
| **D-Tier** (layout triggers) | `width`, `height`, `margin`, `top`, `left`, `padding`, `display` | Forces layout recalculation, causes reflow on every frame |

### Accessibility Audit

- [ ] All animations wrapped in `@media (prefers-reduced-motion: no-preference) { }`
- [ ] Reduced motion fallback provides the same information without motion (fade instead of slide)
- [ ] No flashing content (maximum 3 flashes per second per WCAG 2.3.1)
- [ ] Focus states do not rely solely on animation (always have a static visual indicator)
- [ ] Screen reader content is not altered mid-animation
- [ ] Auto-playing animations have a pause mechanism (WCAG 2.2.2 Level A: auto-playing >5s must be pausable)
- [ ] No content triggers seizures (WCAG 2.3.3 Level AAA: no more than 3 flashes in any 1-second period)
- [ ] Parallax disabled for `prefers-reduced-motion: reduce`

### The "No-Motion-First" Pattern (Recommended)

Instead of adding `prefers-reduced-motion: reduce` as an afterthought, start with no motion and add it only for users who accept it:

```css
/* Base: no motion — works for everyone */
.element {
  opacity: 1;
}

/* Add motion only if user accepts it */
@media (prefers-reduced-motion: no-preference) {
  .element {
    animation: fadeIn 0.3s ease;
  }
}
```

This is more inclusive than wrapping everything in reduce overrides — it makes motion the enhancement, not the default.

### Implementation Pattern for Reduced Motion

```javascript
// GSAP: use matchMedia for clean conditional animation
const mm = gsap.matchMedia();

mm.add("(prefers-reduced-motion: no-preference)", () => {
  gsap.from(".hero-text", {
    y: 60, opacity: 0, duration: 0.8,
    stagger: 0.1, ease: "power3.out"
  });
});

mm.add("(prefers-reduced-motion: reduce)", () => {
  gsap.from(".hero-text", {
    opacity: 0, duration: 0.3
  });
});
```

```css
/* CSS: wrap motion in media query */
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    transform: translateY(30px);
    opacity: 0;
    transition: transform 0.5s var(--ease-out), opacity 0.5s var(--ease-out);
  }
  .reveal.visible {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .reveal.visible {
    opacity: 1;
  }
}
```

### Quality Audit

- [ ] Every animation has a clear purpose (orientation, focus, feedback, or delight)
- [ ] Duration hierarchy is consistent across the entire site
- [ ] Easing curves match brand personality (defined in CSS custom properties)
- [ ] Stagger is applied to every group of sibling elements that reveal
- [ ] No animation runs longer than 2 seconds (unless intentional cinematic moment)
- [ ] Page load choreography is intentional and sequenced
- [ ] Scroll animations enhance rather than obstruct content
- [ ] Exit animations exist (things do not just vanish)
- [ ] All GSAP animations use `gsap.context()` or `useGSAP()` in React for cleanup

### The Squint Test for Motion

Close your eyes. Open them for exactly one second while the page loads. What moved? If everything moved, nothing matters. If one thing moved perfectly, that is mastery.

---

## Part 11: Common Mistakes (25 Years of Seeing Them)

| Mistake | Why It Hurts | The Fix |
|---|---|---|
| Animating everything | Nothing stands out, cognitive overload | Animate 20% of elements, still 80% |
| Using `linear` easing | Robotic, unnatural, screams amateur | Custom cubic-bezier, always |
| Same duration for everything | No hierarchy, monotonous rhythm | Follow the duration hierarchy table |
| Animations longer than 1s for UI | Users feel trapped, cannot interact | Keep interactive feedback under 400ms |
| No stagger on siblings | Elements popping in simultaneously looks broken | Always stagger by 50-100ms |
| Ignoring `prefers-reduced-motion` | Accessibility failure, potential legal liability | Wrap ALL motion in media query |
| Scroll-jacking | Users lose scroll control, feel frustrated | Enhance scroll, never hijack it |
| Animating layout properties | Janky 15fps animation, layout thrashing | Only animate transform + opacity |
| No exit animations | Things vanish unnaturally, breaks spatial model | Exit = reverse of entrance |
| Heavy parallax on mobile | Battery drain, janky on low-end devices | Disable or reduce 50% on mobile |
| Too many springs | Interface feels like gelatin, loses professionalism | 1-2 springs for delight, rest use ease-out |
| Not cleaning up animations | Memory leaks crash SPAs after navigation | `gsap.context()` or `useGSAP()` in React |
| Animating with JS when CSS suffices | Unnecessary complexity, worse performance | Use the "Can CSS Do It?" test |
| Forgetting will-change cleanup | Browser keeps layers promoted, eats memory | Add before animation, remove after |
| Mixing animation libraries | Conflicting transforms, unpredictable behavior | One library per element |

---

## Part 12: The Toolbox — Quick Reference

### GSAP Defaults (Set Once, Use Everywhere)

```javascript
gsap.defaults({
  ease: "power2.out",
  duration: 0.5
});

gsap.config({
  nullTargetWarn: false
});
```

### The Universal Reveal Pattern

This pattern works for any element entering the viewport. Copy it, customize the values, ship it.

```javascript
// Vanilla JS with GSAP
function initReveals() {
  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      gsap.from(el, {
        y: 40,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none"
        }
      });
    });

    gsap.utils.toArray("[data-reveal-stagger]").forEach((container) => {
      const children = container.children;
      gsap.from(children, {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: {
          trigger: container,
          start: "top 85%",
          toggleActions: "play none none none"
        }
      });
    });
  });
}
```

### React + GSAP Setup

```jsx
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function AnimatedSection({ children }) {
  const container = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(container.current.querySelectorAll("[data-reveal]"), {
        y: 40,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: {
          trigger: container.current,
          start: "top 80%"
        }
      });
    });
  }, { scope: container });

  return <section ref={container}>{children}</section>;
}
```

### Motion (formerly Framer Motion) Defaults

```jsx
const fadeUp = {
  initial: { y: 30, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: {
    duration: 0.5,
    ease: [0.16, 1, 0.3, 1]
  }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

function Section() {
  return (
    <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true, margin: "-15%" }}>
      <motion.h2 variants={fadeUp}>Headline</motion.h2>
      <motion.p variants={fadeUp}>Body text here.</motion.p>
      <motion.div variants={fadeUp}>
        <Button>Call to Action</Button>
      </motion.div>
    </motion.div>
  );
}
```

### Lenis Smooth Scroll Setup

```javascript
import Lenis from "lenis";

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: "vertical",
  smoothWheel: true
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Integrate with GSAP ScrollTrigger
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);
```

---

## Part 13: Awwwards 2025 Patterns

### The Award-Winning Stack (2025)

2025 SOTD winners predominantly use this technology combination:

- **WebGL + Three.js + GSAP** as the standard award stack for immersive experiences
- **Rive** for interactive motion graphics (state machines, cross-platform — used by Spotify, Duolingo)
- **Scroll-triggered shader animations** for visual storytelling sections
- **Lenis** for smooth scrolling paired with GSAP ScrollTrigger

**2025 SOTY**: Lando Norris site — WebGL + GSAP + Rive + Webflow integration

### Olivier Larose — The Practical Implementation Bridge

Olivier Larose (blog.olivierlarose.com) is one of the most influential web animation educators working today. His patterns are the practical, copy-pasteable implementations of the principles taught throughout this skill — text parallax, magnetic buttons, sticky cursors, blend mode cursors, pinned galleries, horizontal scroll, and perspective transitions. See `references/olivier-larose-patterns.md` for full production-ready code for 14 award-winning patterns.

### What Judges Notice

1. **Choreography over effects** — Sequenced, purposeful motion beats flashy isolated effects
2. **Custom cursors with context** — Cursor that changes based on what it hovers over
3. **Scroll-driven storytelling** — Content that unfolds as a narrative through scroll
4. **WebGL integration** — 3D elements that respond to user interaction, not just spinning
5. **Performance under load** — Smooth 60fps even with complex visual effects

---

## Appendix: The Animation Director's Cheat Sheet

When you need to make a motion decision fast:

| "I need to..." | Do This |
|---|---|
| Reveal content on scroll | Fade-up + stagger, ScrollTrigger start: "top 85%" |
| Make a button feel alive | Scale 1.03 on hover, scale 0.97 on press, spring easing |
| Transition between pages | Crossfade with 300ms overlap, ease-in-out-quint |
| Create a hero moment | SplitText character reveal + stagger 30ms, ease-out-expo |
| Add depth to a card | translateZ + rotateX/Y on hover, box-shadow scales with lift |
| Make a number count up | gsap.to with snap:1, ease power2.out, duration based on magnitude |
| Build a sticky scroll section | ScrollTrigger pin + scrub:1, split into timeline sections |
| Add a loading state | Skeleton shimmer (CSS only), 1.5s linear gradient animation |
| Make text feel premium | Letter-spacing animation (-0.02em to 0em), clip-path reveal |
| Create a smooth marquee | GSAP horizontal loop, duplicate content, seamless wrap |

---

*This skill is a living document. When you encounter a new animation pattern worth remembering, add it to the appropriate reference file. The goal is not comprehensiveness for its own sake — it is having the right answer when inspiration is needed.*
