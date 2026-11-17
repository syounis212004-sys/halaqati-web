# Physics-Based Animation and 3D Transforms

> The real world has no linear easing. Everything has mass, momentum, and friction. Bring that truth to your interfaces.

This file covers spring physics, momentum scrolling, elastic behavior, 3D transforms, perspective, and tilt effects.

---

## Spring Physics

Springs are the most natural form of animation because they model how real objects move: they overshoot, oscillate, and settle. Three parameters control everything.

### The Three Parameters

| Parameter | What It Controls | Low Value | High Value |
|---|---|---|---|
| **Stiffness** | How quickly the spring reaches its target | Slow, lazy (50) | Snappy, instant (500) |
| **Damping** | How quickly oscillation stops | Bouncy, wobbly (5) | No overshoot (40) |
| **Mass** | How heavy the object feels | Light, responsive (0.5) | Heavy, weighty (3) |

### Motion (formerly Framer Motion) Spring Presets

```tsx
// Snappy toggle (light switch feel)
const snappy = { type: "spring", stiffness: 500, damping: 30, mass: 0.5 };

// Gentle arrival (card entering viewport)
const gentle = { type: "spring", stiffness: 120, damping: 20, mass: 0.8 };

// Bouncy (notification badge, playful elements)
const bouncy = { type: "spring", stiffness: 300, damping: 10, mass: 0.8 };

// Heavy (dragging a large element, modal settle)
const heavy = { type: "spring", stiffness: 200, damping: 25, mass: 2 };

// Elastic (rubber band snap-back)
const elastic = { type: "spring", stiffness: 400, damping: 8, mass: 0.5 };
```

### Motion (formerly Framer Motion) Spring Examples

```tsx
import { motion } from "motion/react";

// Toggle switch with spring
function Toggle({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 52,
        height: 28,
        borderRadius: 14,
        background: isOn ? "#22c55e" : "#e5e7eb",
        padding: 3,
        cursor: "pointer",
        display: "flex",
        justifyContent: isOn ? "flex-end" : "flex-start",
        transition: "background 200ms ease"
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
        }}
      />
    </div>
  );
}

// Modal with spring entrance
function Modal({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="modal"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              mass: 0.8
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### GSAP Spring Equivalent

```javascript
// GSAP does not have a built-in spring type like Motion (formerly Framer Motion),
// but elastic and back easing approximate spring behavior

// Elastic: oscillating overshoot (like a bouncy spring)
gsap.from(".element", {
  scale: 0,
  duration: 0.8,
  ease: "elastic.out(1, 0.3)"
});

// Back: single overshoot then settle (like a stiff spring)
gsap.from(".element", {
  y: 50,
  duration: 0.5,
  ease: "back.out(1.7)"
});

// Custom spring-like behavior with CustomEase
gsap.registerPlugin(CustomEase);

CustomEase.create("customSpring",
  "M0,0 C0.2,0.8 0.15,1.35 0.4,1.1 0.6,0.92 0.7,1.02 0.8,1 0.9,0.99 1,1 1,1"
);

gsap.from(".element", {
  y: 50,
  duration: 0.7,
  ease: "customSpring"
});
```

---

## Momentum and Deceleration

When a user flicks, scrolls, or throws an element, it should decelerate naturally, not stop instantly.

### Lenis Momentum Scrolling

```javascript
import Lenis from "lenis";

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: "vertical",
  gestureOrientation: "vertical",
  smoothWheel: true,
  touchMultiplier: 2
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
```

### GSAP Inertia (Throw/Flick)

```javascript
gsap.registerPlugin(InertiaPlugin);

// After a drag ends, continue with momentum
Draggable.create(".card", {
  type: "x,y",
  inertia: true,
  bounds: ".container",
  edgeResistance: 0.65,
  snap: {
    x: gsap.utils.snap(200),
    y: gsap.utils.snap(200)
  }
});
```

### Custom Deceleration

```javascript
function applyMomentum(el, velocityX, velocityY, friction = 0.95) {
  let vx = velocityX;
  let vy = velocityY;
  let x = gsap.getProperty(el, "x");
  let y = gsap.getProperty(el, "y");

  function step() {
    vx *= friction;
    vy *= friction;
    x += vx;
    y += vy;

    gsap.set(el, { x, y });

    if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}
```

---

## Elastic Overshoot — When and How Much

Elastic overshoot makes elements feel alive by exceeding their final position before settling back. But too much overshoot makes the interface feel unreliable.

### The Overshoot Budget

| Context | Max Overshoot | Easing |
|---|---|---|
| Button press return | 5% | `back.out(1.4)` |
| Modal entrance | 10% | `back.out(1.7)` |
| Notification badge | 15% | `elastic.out(1, 0.4)` |
| Playful / gamification UI | 20% | `elastic.out(1, 0.3)` |
| Never (data, forms, critical UI) | 0% | `power2.out` |

### Example: Badge Counter Update

```javascript
function updateBadgeCount(el, newCount) {
  const tl = gsap.timeline();

  tl.to(el, {
    scale: 0.8,
    duration: 0.1,
    ease: "power2.in"
  })
  .call(() => {
    el.textContent = newCount;
  })
  .to(el, {
    scale: 1,
    duration: 0.5,
    ease: "elastic.out(1, 0.4)"
  });
}
```

---

## 3D Transforms

### Perspective (The Foundation)

Without `perspective` on a parent, 3D transforms appear flat. Think of perspective as the camera distance from the element.

```css
/* Parent container needs perspective */
.scene {
  perspective: 1000px;       /* Camera distance: 800-1200px is the sweet spot */
  perspective-origin: 50% 50%; /* Camera position: center by default */
}

/* Children can now rotate in 3D */
.card {
  transform-style: preserve-3d; /* Required if card has 3D children */
  transition: transform 400ms cubic-bezier(0.25, 1, 0.5, 1);
}

.card:hover {
  transform: rotateY(10deg) rotateX(-5deg);
}
```

### Perspective Values and Their Feel

| Value | Feel | Use For |
|---|---|---|
| 400-600px | Dramatic, distorted perspective | Hero moments, theatrical reveals |
| 800-1200px | Natural, comfortable depth | Card tilts, subtle 3D |
| 1500-2000px | Subtle, barely noticeable 3D | Light depth enhancement |
| 3000px+ | Nearly flat, isometric feel | Architectural, technical UI |

### The Card Flip

```css
.flip-card {
  perspective: 1000px;
  width: 300px;
  height: 400px;
}

.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 600ms cubic-bezier(0.83, 0, 0.17, 1);
  transform-style: preserve-3d;
}

.flip-card:hover .flip-card-inner {
  transform: rotateY(180deg);
}

.flip-card-front,
.flip-card-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 12px;
}

.flip-card-back {
  transform: rotateY(180deg);
}
```

---

## Card Tilt Effect (Mouse-Tracking 3D Rotation)

The card tilts toward the cursor, creating a 3D parallax effect. This is the technique used on Stripe's product cards and Apple's product showcases.

### Vanilla JS Implementation

```javascript
class TiltCard {
  constructor(el, options = {}) {
    this.el = el;
    this.settings = {
      maxTilt: options.maxTilt || 10,
      perspective: options.perspective || 1000,
      scale: options.scale || 1.02,
      speed: options.speed || 400,
      glare: options.glare || false,
      maxGlare: options.maxGlare || 0.25
    };

    this.el.style.perspective = this.settings.perspective + "px";
    this.el.style.transformStyle = "preserve-3d";
    this.el.style.transition = `transform ${this.settings.speed}ms cubic-bezier(0.25, 1, 0.5, 1)`;

    if (this.settings.glare) {
      this.initGlare();
    }

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.el.addEventListener("mousemove", this.onMouseMove);
    this.el.addEventListener("mouseleave", this.onMouseLeave);
  }

  initGlare() {
    this.glareEl = document.createElement("div");
    this.glareEl.style.cssText = `
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background: linear-gradient(
        135deg,
        rgba(255,255,255,${this.settings.maxGlare}) 0%,
        rgba(255,255,255,0) 60%
      );
      opacity: 0;
      transition: opacity ${this.settings.speed}ms ease;
    `;
    this.el.style.position = "relative";
    this.el.style.overflow = "hidden";
    this.el.appendChild(this.glareEl);
  }

  onMouseMove(e) {
    const rect = this.el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const tiltX = (this.settings.maxTilt * (0.5 - y)).toFixed(2);
    const tiltY = (this.settings.maxTilt * (x - 0.5)).toFixed(2);

    this.el.style.transform = `
      rotateX(${tiltX}deg)
      rotateY(${tiltY}deg)
      scale3d(${this.settings.scale}, ${this.settings.scale}, ${this.settings.scale})
    `;

    if (this.glareEl) {
      const glareAngle = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI) + 90;
      this.glareEl.style.background = `
        linear-gradient(
          ${glareAngle}deg,
          rgba(255,255,255,${this.settings.maxGlare}) 0%,
          rgba(255,255,255,0) 80%
        )
      `;
      this.glareEl.style.opacity = "1";
    }
  }

  onMouseLeave() {
    this.el.style.transform = "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";

    if (this.glareEl) {
      this.glareEl.style.opacity = "0";
    }
  }

  destroy() {
    this.el.removeEventListener("mousemove", this.onMouseMove);
    this.el.removeEventListener("mouseleave", this.onMouseLeave);
    if (this.glareEl) {
      this.glareEl.remove();
    }
  }
}

// Usage
document.querySelectorAll("[data-tilt]").forEach((el) => {
  new TiltCard(el, {
    maxTilt: 8,
    glare: true,
    maxGlare: 0.2
  });
});
```

### React Implementation

```tsx
import { useRef, useCallback } from "react";

function useTilt(maxTilt = 10) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (maxTilt * (0.5 - y)).toFixed(2);
    const tiltY = (maxTilt * (x - 0.5)).toFixed(2);

    ref.current.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.02, 1.02, 1.02)`;
  }, [maxTilt]);

  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
  }, []);

  return { ref, handleMouseMove, handleMouseLeave };
}

function TiltCard({ children }: { children: React.ReactNode }) {
  const { ref, handleMouseMove, handleMouseLeave } = useTilt(8);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transition: "transform 400ms cubic-bezier(0.25, 1, 0.5, 1)",
        transformStyle: "preserve-3d"
      }}
    >
      {children}
    </div>
  );
}
```

---

## Parallax Depth with Perspective

Create depth by placing elements at different Z positions within a perspective container. Closer elements move more on scroll.

```javascript
function initPerspectiveParallax() {
  const scene = document.querySelector(".depth-scene");
  const layers = gsap.utils.toArray(".depth-layer");

  layers.forEach((layer) => {
    const depth = parseFloat(layer.dataset.depth); // 0 = back, 1 = front
    const movement = depth * 100; // Front layers move more

    gsap.to(layer, {
      y: -movement,
      ease: "none",
      scrollTrigger: {
        trigger: scene,
        start: "top bottom",
        end: "bottom top",
        scrub: 1
      }
    });
  });
}
```

```html
<section class="depth-scene" style="perspective: 1000px; overflow: hidden;">
  <div class="depth-layer" data-depth="0.1" style="transform: translateZ(-200px) scale(1.2);">
    <!-- Background: mountains, clouds -->
  </div>
  <div class="depth-layer" data-depth="0.5" style="transform: translateZ(-100px) scale(1.1);">
    <!-- Midground: trees, buildings -->
  </div>
  <div class="depth-layer" data-depth="1" style="transform: translateZ(0);">
    <!-- Foreground: content, text -->
  </div>
</section>
```

---

## CSS @property for Animatable Custom Properties

CSS custom properties (`--my-var`) cannot be animated by default because the browser does not know their type. `@property` registers them with a syntax, making them animatable.

### Animated Gradient Angle

```css
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.gradient-border {
  background: conic-gradient(
    from var(--gradient-angle),
    #3b82f6,
    #8b5cf6,
    #ec4899,
    #3b82f6
  );
  animation: rotate-gradient 3s linear infinite;
}

@keyframes rotate-gradient {
  to { --gradient-angle: 360deg; }
}
```

### Animated Color

```css
@property --glow-color {
  syntax: "<color>";
  initial-value: #3b82f6;
  inherits: false;
}

.glow-element {
  box-shadow: 0 0 30px var(--glow-color);
  transition: --glow-color 500ms ease;
}

.glow-element:hover {
  --glow-color: #ec4899;
}
```

### Animated Number (for counter effects in CSS)

```css
@property --count {
  syntax: "<integer>";
  initial-value: 0;
  inherits: false;
}

.counter {
  counter-reset: count var(--count);
  animation: count-up 2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.counter::after {
  content: counter(count);
}

@keyframes count-up {
  to { --count: 100; }
}
```

---

## Gravity and Throw Physics

When you drag and release an element, it should continue with momentum and optionally fall under gravity.

```javascript
function throwWithGravity(el, velocityX, velocityY) {
  const gravity = 0.5;
  const friction = 0.99;
  const bounce = 0.6;
  const ground = window.innerHeight - 100;

  let vx = velocityX;
  let vy = velocityY;
  let x = gsap.getProperty(el, "x");
  let y = gsap.getProperty(el, "y");

  function step() {
    vy += gravity;
    vx *= friction;
    vy *= friction;

    x += vx;
    y += vy;

    // Bounce off ground
    if (y > ground) {
      y = ground;
      vy = -vy * bounce;
    }

    // Bounce off walls
    if (x < 0 || x > window.innerWidth - 100) {
      vx = -vx * bounce;
      x = Math.max(0, Math.min(x, window.innerWidth - 100));
    }

    gsap.set(el, { x, y });

    // Stop when velocity is negligible and element is near ground
    if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1 || y < ground - 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}
```

---

## Performance Notes for 3D and Physics

1. **3D transforms are GPU-accelerated.** `transform: rotateX()`, `rotateY()`, `translateZ()` all run on the compositor. No layout thrashing.
2. **Perspective costs memory.** Each element in a perspective container gets its own compositor layer. Do not put perspective on large lists.
3. **`will-change: transform`** on elements that will animate in 3D. Remove it after animation ends.
4. **Disable 3D on mobile** unless the effect is essential. Mobile GPUs handle 3D transforms but drain battery aggressively.
5. **Spring animations** are computed per frame. In React, Motion (formerly Framer Motion) handles this efficiently. In vanilla JS, keep the number of concurrent spring animations under 10 for 60fps on mid-tier devices.
6. **`backface-visibility: hidden`** on elements that rotate. Without it, the back face renders, wasting GPU cycles.

---

---

## Spring and Bounce in Pure CSS with `linear()` Easing

The CSS `linear()` easing function (~90% browser support) allows you to define arbitrary easing curves by specifying output values at evenly-spaced points. This enables spring and bounce effects in pure CSS without JavaScript.

```css
/* Spring easing generated via https://linear-easing-generator.netlify.app/ */
.spring {
  transition: transform 0.5s linear(
    0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%,
    0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%,
    1.015 55%, 1.017 63.9%, 1.001 85.5%, 1
  );
}

/* Bounce easing */
.bounce {
  transition: transform 0.6s linear(
    0, 0.004, 0.016, 0.035, 0.063, 0.098, 0.141 13.6%, 0.25, 0.391,
    0.563, 0.765, 1 30.3%, 0.891 35.6%, 0.848, 0.813, 0.785, 0.766,
    0.754, 0.75, 0.754, 0.766, 0.785, 0.813, 0.848, 0.891 60.6%,
    1 66.7%, 0.946, 0.908, 0.885, 0.875, 0.885, 0.908, 0.946,
    1 83.3%, 0.969, 0.953, 0.953, 0.969, 1
  );
}
```

Use [linear-easing-generator](https://linear-easing-generator.netlify.app/) to convert spring parameters to `linear()` values. This is a C-tier performance option (triggers paint for some properties) but works without any JavaScript.

---

*Physics-based animation is not about mathematical accuracy. It is about perceptual accuracy. The user does not know the exact spring constant — they know whether the motion felt natural or robotic. Tune by feel, not by formula.*
