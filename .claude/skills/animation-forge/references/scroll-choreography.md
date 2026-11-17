# Scroll Choreography — The Definitive Guide

> Scroll is the user's tempo. Your job is to dance to it, not fight it.

This file covers every scroll animation pattern from basic reveals to advanced pinned storytelling. All code is GSAP ScrollTrigger unless otherwise noted.

---

## Foundation: IntersectionObserver (CSS + JS, No Libraries)

Before reaching for ScrollTrigger, know that simple reveals can be done with zero dependencies.

### CSS + IntersectionObserver

```css
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 0;
    transform: none;
    transition: opacity 0.3s ease;
  }
  .reveal.visible {
    opacity: 1;
  }
}
```

```javascript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
```

This handles 80% of scroll reveal needs. Use ScrollTrigger when you need scrubbing, pinning, or fine-grained control.

---

## ScrollTrigger: Core Patterns

### Basic Scroll Reveal

```javascript
gsap.registerPlugin(ScrollTrigger);

gsap.utils.toArray(".section-content").forEach((section) => {
  gsap.from(section, {
    y: 50,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: {
      trigger: section,
      start: "top 85%",
      end: "top 50%",
      toggleActions: "play none none none"
    }
  });
});
```

### toggleActions Explained

Format: `"onEnter onLeave onEnterBack onLeaveBack"`

| Value | Common Use |
|---|---|
| `"play none none none"` | Play once, never reverse (most common for reveals) |
| `"play pause resume reverse"` | Full lifecycle, reverses on scroll back |
| `"play reverse play reverse"` | Ping-pong on scroll direction |
| `"play complete reverse reset"` | Reset to start when scrolling past |

---

## Batch Reveal Pattern (Staggered Grid on Scroll)

The most common Awwwards pattern: a grid of cards that stagger in as each row enters the viewport.

```javascript
ScrollTrigger.batch(".grid-item", {
  onEnter: (batch) => {
    gsap.from(batch, {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: "power2.out"
    });
  },
  start: "top 90%",
  once: true
});
```

### Grid Stagger with Axis

For a wave effect rolling across a grid diagonally:

```javascript
gsap.from(".grid-item", {
  y: 60,
  opacity: 0,
  duration: 0.7,
  stagger: {
    amount: 1.2,
    grid: "auto",
    from: "start",
    axis: "y"
  },
  ease: "power3.out",
  scrollTrigger: {
    trigger: ".grid-container",
    start: "top 75%",
    toggleActions: "play none none none"
  }
});
```

---

## Scrubbed Animation (Scroll Controls Playhead)

The animation progress maps directly to scroll position. The user is literally scrubbing through a timeline.

### Basic Scrub

```javascript
gsap.to(".progress-fill", {
  scaleX: 1,
  ease: "none",
  scrollTrigger: {
    trigger: ".progress-section",
    start: "top center",
    end: "bottom center",
    scrub: 1
  }
});
```

**Critical**: Always use `scrub: 1` (or another number) rather than `scrub: true`. The number is the smoothing factor in seconds. `scrub: true` means zero smoothing, which produces janky 1:1 mapping. `scrub: 1` gives one second of catch-up smoothing, which feels buttery.

### Multi-Step Scrubbed Timeline

```javascript
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".feature-section",
    start: "top top",
    end: "+=3000",
    scrub: 1,
    pin: true
  }
});

tl.from(".feature-1", { opacity: 0, y: 40, duration: 1 })
  .to(".feature-1", { opacity: 0, y: -40, duration: 0.5 }, "+=0.5")
  .from(".feature-2", { opacity: 0, y: 40, duration: 1 })
  .to(".feature-2", { opacity: 0, y: -40, duration: 0.5 }, "+=0.5")
  .from(".feature-3", { opacity: 0, y: 40, duration: 1 });
```

---

## Pinned Storytelling (The Linear.app Technique)

Pin a visual element while the user scrolls through text content. The visual changes as each text section enters. This is the gold standard for feature explanation sections.

```html
<section class="story-section">
  <div class="story-visual">
    <img class="story-image" data-step="1" src="feature-1.png" />
    <img class="story-image" data-step="2" src="feature-2.png" />
    <img class="story-image" data-step="3" src="feature-3.png" />
  </div>
  <div class="story-text">
    <div class="story-step" data-step="1">
      <h3>Feature One</h3>
      <p>Description of feature one...</p>
    </div>
    <div class="story-step" data-step="2">
      <h3>Feature Two</h3>
      <p>Description of feature two...</p>
    </div>
    <div class="story-step" data-step="3">
      <h3>Feature Three</h3>
      <p>Description of feature three...</p>
    </div>
  </div>
</section>
```

```javascript
function initPinnedStory() {
  const section = document.querySelector(".story-section");
  const steps = gsap.utils.toArray(".story-step");
  const images = gsap.utils.toArray(".story-image");

  // Pin the visual column
  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    pin: ".story-visual",
    pinSpacing: false
  });

  // Crossfade images as each step enters center of viewport
  steps.forEach((step, i) => {
    ScrollTrigger.create({
      trigger: step,
      start: "top center",
      end: "bottom center",
      onEnter: () => {
        gsap.to(images, { opacity: 0, duration: 0.4, ease: "power2.out" });
        gsap.to(images[i], { opacity: 1, duration: 0.4, ease: "power2.out" });
      },
      onEnterBack: () => {
        gsap.to(images, { opacity: 0, duration: 0.4, ease: "power2.out" });
        gsap.to(images[i], { opacity: 1, duration: 0.4, ease: "power2.out" });
      }
    });
  });
}
```

---

## Horizontal Scroll Section

Convert vertical scroll into horizontal movement. The section pins while content scrolls horizontally.

```javascript
function initHorizontalScroll() {
  const container = document.querySelector(".horizontal-container");
  const panels = gsap.utils.toArray(".horizontal-panel");

  gsap.to(panels, {
    xPercent: -100 * (panels.length - 1),
    ease: "none",
    scrollTrigger: {
      trigger: container,
      start: "top top",
      end: () => "+=" + container.scrollWidth,
      scrub: 1,
      pin: true,
      snap: {
        snapTo: 1 / (panels.length - 1),
        duration: { min: 0.2, max: 0.4 },
        ease: "power2.inOut"
      },
      invalidateOnRefresh: true
    }
  });
}
```

**Warning**: Horizontal scroll breaks keyboard and trackpad expectations. Use it only when the content is truly a horizontal sequence (portfolio gallery, timeline, before/after comparison). Never use it for content that reads top-to-bottom.

---

## Parallax Depth System

Three layers at minimum for convincing depth: background (slow), midground (normal), foreground (fast).

### CSS-Only Parallax (Simple)

```css
.parallax-container {
  perspective: 1px;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
}

.parallax-bg {
  transform: translateZ(-2px) scale(3);
}

.parallax-mid {
  transform: translateZ(-1px) scale(2);
}

.parallax-fg {
  transform: translateZ(0);
}
```

### GSAP Parallax (Precise Control)

```javascript
function initParallax() {
  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
    // Background layer: moves 30% of scroll speed
    gsap.utils.toArray("[data-parallax-bg]").forEach((el) => {
      gsap.to(el, {
        yPercent: -30,
        ease: "none",
        scrollTrigger: {
          trigger: el.parentElement,
          start: "top bottom",
          end: "bottom top",
          scrub: 1
        }
      });
    });

    // Midground layer: moves 15% of scroll speed
    gsap.utils.toArray("[data-parallax-mid]").forEach((el) => {
      gsap.to(el, {
        yPercent: -15,
        ease: "none",
        scrollTrigger: {
          trigger: el.parentElement,
          start: "top bottom",
          end: "bottom top",
          scrub: 1
        }
      });
    });

    // Foreground layer: moves 5% faster than scroll
    gsap.utils.toArray("[data-parallax-fg]").forEach((el) => {
      gsap.to(el, {
        yPercent: 5,
        ease: "none",
        scrollTrigger: {
          trigger: el.parentElement,
          start: "top bottom",
          end: "bottom top",
          scrub: 1
        }
      });
    });
  });
}
```

---

## Text Reveal on Scroll (SplitText + ScrollTrigger)

### Line-by-Line Paragraph Reveal

```javascript
function initTextReveal() {
  gsap.utils.toArray("[data-text-reveal]").forEach((el) => {
    const split = new SplitText(el, { type: "lines", linesClass: "line" });

    // Wrap each line in a mask container
    split.lines.forEach((line) => {
      const wrapper = document.createElement("div");
      wrapper.style.overflow = "hidden";
      line.parentNode.insertBefore(wrapper, line);
      wrapper.appendChild(line);
    });

    gsap.from(split.lines, {
      yPercent: 100,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
        toggleActions: "play none none none"
      }
    });
  });
}
```

### Character-by-Character Hero Reveal on Scroll

```javascript
function initHeroReveal() {
  const heading = document.querySelector(".hero-heading");
  const split = new SplitText(heading, { type: "chars, words", charsClass: "char" });

  gsap.from(split.chars, {
    yPercent: 100,
    opacity: 0,
    rotateX: -40,
    duration: 0.8,
    stagger: 0.02,
    ease: "power3.out",
    scrollTrigger: {
      trigger: heading,
      start: "top 75%",
      toggleActions: "play none none none"
    }
  });
}
```

---

## Scroll Progress Indicator

A thin bar at the top of the page showing how far the user has scrolled.

```javascript
function initScrollProgress() {
  gsap.to(".scroll-progress-bar", {
    scaleX: 1,
    transformOrigin: "left center",
    ease: "none",
    scrollTrigger: {
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.3
    }
  });
}
```

```css
.scroll-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left center;
  z-index: 9999;
}
```

---

## Scroll-to-Section with Smooth Scroll

```javascript
function initSmoothScrollLinks() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute("href"));

      if (target) {
        gsap.to(window, {
          scrollTo: {
            y: target,
            offsetY: 80
          },
          duration: 1,
          ease: "power2.inOut"
        });
      }
    });
  });
}
```

---

## Responsive Scroll Animations (gsap.matchMedia)

Always scope scroll animations to appropriate screen sizes and motion preferences.

```javascript
function initResponsiveScrollAnimations() {
  const mm = gsap.matchMedia();

  mm.add({
    isDesktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    isTablet: "(min-width: 768px) and (max-width: 1023px) and (prefers-reduced-motion: no-preference)",
    isMobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
    isReduced: "(prefers-reduced-motion: reduce)"
  }, (context) => {
    const { isDesktop, isTablet, isMobile, isReduced } = context.conditions;

    if (isReduced) {
      // Fade only, no movement
      gsap.from("[data-reveal]", {
        opacity: 0,
        duration: 0.3,
        stagger: 0.05,
        scrollTrigger: {
          trigger: "[data-reveal]",
          start: "top 90%"
        }
      });
      return;
    }

    if (isDesktop) {
      // Full parallax + pinned sections
      initParallax();
      initPinnedStory();
      initHorizontalScroll();
    }

    if (isTablet) {
      // Reduced parallax, no pinning
      initParallax(); // with reduced movement
    }

    if (isMobile) {
      // Simple reveals only, no parallax
      gsap.from("[data-reveal]", {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.06,
        scrollTrigger: {
          trigger: "[data-reveal]",
          start: "top 85%"
        }
      });
    }
  });
}
```

---

## Performance Tips for Scroll Animation

1. **Debounce refresh**: Call `ScrollTrigger.refresh()` after layout changes, not on every resize. Use `invalidateOnRefresh: true` on ScrollTriggers that depend on layout dimensions.
2. **Lazy initialization**: Do not create ScrollTriggers for off-screen sections at page load. Use a master IntersectionObserver to init ScrollTriggers as sections approach the viewport.
3. **Kill when done**: For one-shot reveals, call `scrollTrigger.kill()` after the animation completes to free resources.
4. **Avoid nested pins**: Pinning inside a pinned container creates layout chaos. Keep pin structures flat.
5. **Test on low-end devices**: Run Chrome DevTools Performance panel with 4x CPU throttling. If your scroll animations drop below 50fps, simplify.

---

---

## Lenis + GSAP ScrollTrigger Sync (Correct Pattern)

When using Lenis for smooth scrolling alongside GSAP ScrollTrigger, you must sync them properly. Lenis manages the scroll, GSAP reads it.

```javascript
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis();

// Connect Lenis scroll events to ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);

// Use GSAP ticker to drive Lenis (replaces requestAnimationFrame loop)
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

// Disable GSAP's lag smoothing to prevent conflicts
gsap.ticker.lagSmoothing(0);
```

**Important**: Do not use `requestAnimationFrame` to drive Lenis when also using GSAP. Let GSAP's ticker handle it to keep both systems in sync.

---

## CSS Scroll-Driven Animations (Native, No JS)

For simple scroll-triggered reveals, CSS scroll-driven animations run entirely on the compositor thread with ~90% browser support. No JavaScript needed.

```css
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}

.reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

### Scroll Progress Bar (Pure CSS)

```css
@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--accent);
  transform-origin: left;
  animation: grow-progress linear;
  animation-timeline: scroll();
}
```

**When to use CSS scroll-driven animations vs. ScrollTrigger**: Use CSS for simple reveals and progress indicators. Use ScrollTrigger when you need scrubbing, pinning, snapping, or complex choreography. Firefox needs a fallback (feature-detect with `@supports (animation-timeline: scroll())`).

---

*The best scroll animation is one the user does not notice consciously. They just feel that the page is alive, responsive, and pleasant to explore. If they think "cool animation," you succeeded. If they think "I cannot scroll properly," you failed.*
