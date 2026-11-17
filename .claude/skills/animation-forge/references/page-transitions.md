# Page Transitions and Loading Choreography

> The space between pages is not empty. It is an opportunity.

This file covers route transitions in SPAs, loading choreography, skeleton screens, and the View Transitions API.

---

## Next.js Page Transitions with Motion (formerly Framer Motion)

### Layout-Level AnimatePresence

In Next.js App Router, use `template.tsx` to wrap page content with AnimatePresence. Templates re-mount on navigation (unlike layouts), making them the right place for page transitions.

```tsx
// app/template.tsx
"use client";

import { motion, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
      when: "beforeChildren",
      staggerChildren: 0.08
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.3,
      ease: [0.7, 0, 0.84, 0]
    }
  }
};

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Important: AnimatePresence Modes

| Mode | Behavior | Use Case |
|---|---|---|
| `"wait"` | Old page exits completely, then new page enters | Clean, sequential, no overlap |
| `"sync"` | Both animate simultaneously | Crossfade, layered transitions |
| `"popLayout"` | Exiting element pops out of layout flow | Prevents layout jump during exit |

For most sites, `mode="wait"` is the safest choice. Use `"sync"` for crossfade effects where both pages are visible briefly.

---

## Loading Choreography: The Orchestrated Entrance

The page load sequence should feel like a curtain rising, not a light switch flipping.

### The Entrance Timeline

```javascript
function initPageEntrance() {
  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const tl = gsap.timeline({
      defaults: { ease: "power2.out" }
    });

    // Phase 1: Navigation (appears first, anchors the page)
    tl.from(".nav", {
      y: -20,
      opacity: 0,
      duration: 0.4
    })

    // Phase 2: Hero headline (the star of the show)
    .from(".hero-headline", {
      y: 40,
      opacity: 0,
      duration: 0.6,
      ease: "power3.out"
    }, "-=0.1")

    // Phase 3: Hero subtitle and supporting text
    .from(".hero-subtitle", {
      y: 20,
      opacity: 0,
      duration: 0.5
    }, "-=0.3")

    // Phase 4: CTA with spring for emphasis
    .from(".hero-cta", {
      scale: 0.9,
      opacity: 0,
      duration: 0.5,
      ease: "back.out(1.7)"
    }, "-=0.2")

    // Phase 5: Secondary content fades in
    .from(".hero-secondary > *", {
      y: 20,
      opacity: 0,
      duration: 0.4,
      stagger: 0.06
    }, "-=0.2");
  });

  // Reduced motion: everything fades in simply
  mm.add("(prefers-reduced-motion: reduce)", () => {
    gsap.from(".nav, .hero-headline, .hero-subtitle, .hero-cta, .hero-secondary", {
      opacity: 0,
      duration: 0.3,
      stagger: 0.05
    });
  });
}
```

### React Component Version

```tsx
"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export function HeroSection() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      tl.from("[data-anim='headline']", {
        y: 50, opacity: 0, duration: 0.7, ease: "power3.out"
      })
      .from("[data-anim='subtitle']", {
        y: 25, opacity: 0, duration: 0.5
      }, "-=0.35")
      .from("[data-anim='cta']", {
        scale: 0.9, opacity: 0, duration: 0.5, ease: "back.out(1.7)"
      }, "-=0.2");
    });
  }, { scope: container });

  return (
    <section ref={container}>
      <h1 data-anim="headline">Build something great</h1>
      <p data-anim="subtitle">The platform for modern web development.</p>
      <button data-anim="cta">Get Started</button>
    </section>
  );
}
```

---

## Skeleton Screens with Shimmer

Skeletons feel faster than spinners because they show the shape of what is loading. The shimmer gives the impression of activity.

### CSS-Only Skeleton Shimmer

```css
.skeleton {
  background: #e5e7eb;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.5),
    transparent
  );
  animation: shimmer 1.5s infinite linear;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.skeleton-text {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-text:last-child {
  width: 60%;
}

.skeleton-title {
  height: 24px;
  width: 50%;
  margin-bottom: 16px;
}

.skeleton-image {
  width: 100%;
  aspect-ratio: 16/9;
}
```

### Skeleton to Content Crossfade

When content loads, crossfade from skeleton to real content. Never just swap — the jump is jarring.

```javascript
function revealContent(skeletonEl, contentEl) {
  gsap.to(skeletonEl, {
    opacity: 0,
    duration: 0.2,
    ease: "power2.in",
    onComplete: () => {
      skeletonEl.style.display = "none";
      contentEl.style.display = "block";
      gsap.from(contentEl, {
        opacity: 0,
        y: 10,
        duration: 0.4,
        ease: "power2.out"
      });
    }
  });
}
```

---

## Blur-Up Image Loading

Show a tiny (20px wide) blurred placeholder, then crossfade to the full image. This is the Medium/Vercel technique.

```tsx
"use client";

import { useState } from "react";

export function BlurUpImage({ src, blurSrc, alt, ...props }: {
  src: string;
  blurSrc: string;
  alt: string;
  [key: string]: any;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="blur-up-container" style={{ position: "relative", overflow: "hidden" }}>
      {/* Blurred placeholder */}
      <img
        src={blurSrc}
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(20px)",
          transform: "scale(1.1)",
          opacity: loaded ? 0 : 1,
          transition: "opacity 500ms ease"
        }}
      />

      {/* Full image */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          transition: "opacity 500ms ease"
        }}
        {...props}
      />
    </div>
  );
}
```

---

## Route Transition Patterns

### Crossfade (Universal Default)

The safest page transition. Old page fades out, new page fades in.

```tsx
const crossfade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, transition: { duration: 0.3, ease: [0.7, 0, 0.84, 0] } }
};
```

### Slide (Directional Navigation)

New page slides in from the direction of navigation. Great for tab-based interfaces.

```tsx
function getSlideDirection(pathname: string, prevPathname: string): number {
  // Implement based on your navigation structure
  // Return 1 for forward (slide from right), -1 for back (slide from left)
  return 1;
}

const slide = (direction: number) => ({
  initial: { x: direction * 100 + "%", opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    x: direction * -50 + "%",
    opacity: 0,
    transition: { duration: 0.3, ease: [0.7, 0, 0.84, 0] }
  }
});
```

### Clip-Path Reveal

New page reveals through an expanding circle or rectangle. Bold, geometric, editorial.

```tsx
const clipReveal = {
  initial: {
    clipPath: "circle(0% at 50% 50%)"
  },
  animate: {
    clipPath: "circle(150% at 50% 50%)",
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    clipPath: "circle(0% at 50% 50%)",
    transition: { duration: 0.5, ease: [0.7, 0, 0.84, 0] }
  }
};
```

### Cover Transition

New page slides over the old one like a physical sheet. The old page stays in place or parallaxes slightly backward.

```tsx
// In template.tsx, layer both pages
const cover = {
  initial: { y: "100%" },
  animate: {
    y: 0,
    transition: { duration: 0.6, ease: [0.83, 0, 0.17, 1] }
  },
  exit: {
    y: 0,
    transition: { duration: 0.3 }
  }
};
```

---

## View Transitions API (Browser-Native, ~90% SPA Support)

The View Transitions API enables smooth transitions between page states without JavaScript animation libraries. It works for both SPAs (~90% support) and multi-page applications (~85% MPA support).

### Basic SPA Usage

```javascript
async function navigateTo(url) {
  if (!document.startViewTransition) {
    // Fallback: just update the DOM
    await updateDOM(url);
    return;
  }

  const transition = document.startViewTransition(async () => {
    await updateDOM(url);
  });

  await transition.finished;
}
```

### CSS for View Transitions

```css
/* Default crossfade (applied automatically) */
::view-transition-old(root) {
  animation: fade-out 300ms cubic-bezier(0.7, 0, 0.84, 0);
}

::view-transition-new(root) {
  animation: fade-in 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Shared element transition: hero image morphs between pages */
.product-card img {
  view-transition-name: product-hero;
}

.product-detail img {
  view-transition-name: product-hero;
}

/* Custom transition for the hero element */
::view-transition-old(product-hero) {
  animation: none;
  mix-blend-mode: normal;
}

::view-transition-new(product-hero) {
  animation: none;
  mix-blend-mode: normal;
}
```

### Next.js + View Transitions

```tsx
"use client";

import { useRouter } from "next/navigation";

export function TransitionLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();

    if (!("startViewTransition" in document)) {
      router.push(href);
      return;
    }

    (document as any).startViewTransition(() => {
      router.push(href);
    });
  }

  return (
    <a href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
```

---

## Exit Animations Before Navigation

In SPAs, the exiting page should animate out before the new page enters. This requires intercepting navigation.

### Pattern: Exit Animation with Navigation Callback

```javascript
function navigateWithExit(url) {
  const content = document.querySelector(".page-content");

  const tl = gsap.timeline({
    onComplete: () => {
      window.location.href = url; // or router.push(url) in React
    }
  });

  tl.to(".page-content > *", {
    y: -20,
    opacity: 0,
    duration: 0.3,
    stagger: 0.04,
    ease: "power2.in"
  })
  .to(".page-content", {
    opacity: 0,
    duration: 0.2
  }, "-=0.1");
}

// Attach to all internal links
document.querySelectorAll('a[href^="/"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navigateWithExit(link.getAttribute("href"));
  });
});
```

---

## Full Page Intro / Loader

For brand-heavy sites that justify a loading screen (portfolios, agencies, luxury brands). Most content sites should NOT use this — show content immediately.

```javascript
function initPageLoader() {
  const loader = document.querySelector(".page-loader");
  const counter = document.querySelector(".loader-counter");
  const progress = { value: 0 };

  // Simulate or track loading progress
  const tl = gsap.timeline({
    onComplete: () => {
      // Loader exit
      gsap.to(loader, {
        yPercent: -100,
        duration: 0.8,
        ease: "power3.inOut",
        onComplete: () => {
          loader.style.display = "none";
          initPageEntrance(); // Trigger the entrance choreography
        }
      });
    }
  });

  // Counter animation
  tl.to(progress, {
    value: 100,
    duration: 2,
    ease: "power2.inOut",
    onUpdate: () => {
      counter.textContent = Math.round(progress.value) + "%";
    }
  })
  .to(".loader-bar", {
    scaleX: 1,
    duration: 2,
    ease: "power2.inOut"
  }, 0);
}
```

---

## Transition Performance Rules

1. **Never transition layout properties during page change.** Stick to opacity, transform, clip-path, and filter.
2. **Keep transitions under 800ms total.** Users are waiting to interact with the new page. Respect their time.
3. **Prefetch the next page.** Use `<link rel="prefetch">` or framework-level prefetching so the new page content is ready before the transition starts.
4. **Test on slow connections.** If your transition depends on the next page being fully loaded, what happens on 3G? Have a fallback.
5. **Avoid transition on first load.** The user did not navigate — they arrived. The entrance choreography is different from a route transition.

---

---

## Next.js Experimental View Transitions (Since 15.2)

Next.js 15.2+ has experimental support for the View Transitions API:

```javascript
// next.config.js
module.exports = {
  experimental: {
    viewTransition: true
  }
};
```

With this enabled, Next.js automatically wraps route changes in `document.startViewTransition()` when supported. You still define the CSS animations — Next.js just provides the integration.

---

## CSS `@starting-style` for Enter Animations (~89% Support)

For CSS-only enter animations without JavaScript, `@starting-style` defines the initial state for elements entering the DOM. Combined with `transition-behavior: allow-discrete`, it enables animating `display: none` to `display: block`.

```css
.dialog {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s ease, transform 0.3s ease,
              display 0.3s allow-discrete;

  @starting-style {
    opacity: 0;
    transform: translateY(20px);
  }
}

.dialog[hidden] {
  opacity: 0;
  transform: translateY(20px);
  display: none;
}
```

This is a powerful alternative to Motion/AnimatePresence for simple enter/exit animations when you do not need complex choreography.

---

*The best page transition is invisible. The user should feel like they moved through space, not that they watched an animation. If someone compliments your transition, it might be too much. If they say "this site feels smooth," you nailed it.*
