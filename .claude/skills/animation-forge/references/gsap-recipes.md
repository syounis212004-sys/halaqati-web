# GSAP Creative Recipes

> This is NOT an API reference (see gsap-core, gsap-plugins, gsap-scrolltrigger for that). This is the cookbook — creative patterns that win awards.

Every recipe here is a complete, copy-pasteable implementation. No "[...]", no "etc.", no "add your code here."

---

## Magnetic Button

The button subtly pulls toward the cursor when it's nearby, then springs back when the cursor leaves. Seen on almost every Awwwards SOTD.

```javascript
class MagneticButton {
  constructor(el) {
    this.el = el;
    this.text = el.querySelector(".btn-text");
    this.boundingRect = null;
    this.strength = 0.35;
    this.textStrength = 0.5;

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onResize = this.onResize.bind(this);

    this.init();
  }

  init() {
    this.calculateBounds();
    this.el.addEventListener("mousemove", this.onMouseMove);
    this.el.addEventListener("mouseleave", this.onMouseLeave);
    window.addEventListener("resize", this.onResize);
  }

  calculateBounds() {
    this.boundingRect = this.el.getBoundingClientRect();
  }

  onMouseMove(e) {
    const { left, top, width, height } = this.boundingRect;
    const x = e.clientX - left - width / 2;
    const y = e.clientY - top - height / 2;

    gsap.to(this.el, {
      x: x * this.strength,
      y: y * this.strength,
      duration: 0.4,
      ease: "power2.out"
    });

    if (this.text) {
      gsap.to(this.text, {
        x: x * this.textStrength,
        y: y * this.textStrength,
        duration: 0.4,
        ease: "power2.out"
      });
    }
  }

  onMouseLeave() {
    gsap.to(this.el, {
      x: 0,
      y: 0,
      duration: 0.7,
      ease: "elastic.out(1, 0.3)"
    });

    if (this.text) {
      gsap.to(this.text, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "elastic.out(1, 0.3)"
      });
    }
  }

  onResize() {
    this.calculateBounds();
  }

  destroy() {
    this.el.removeEventListener("mousemove", this.onMouseMove);
    this.el.removeEventListener("mouseleave", this.onMouseLeave);
    window.removeEventListener("resize", this.onResize);
    gsap.killTweensOf([this.el, this.text]);
  }
}

// Usage
document.querySelectorAll("[data-magnetic]").forEach((el) => {
  new MagneticButton(el);
});
```

---

## Custom Cursor

A custom cursor that follows the mouse smoothly, scales up on interactive elements, and changes shape on specific targets.

```javascript
class CustomCursor {
  constructor() {
    this.cursor = document.querySelector(".cursor");
    this.cursorDot = document.querySelector(".cursor-dot");
    this.mouseX = 0;
    this.mouseY = 0;
    this.isVisible = false;

    this.init();
  }

  init() {
    document.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;

      if (!this.isVisible) {
        gsap.set([this.cursor, this.cursorDot], { autoAlpha: 1 });
        this.isVisible = true;
      }
    });

    // Smooth follow for outer ring
    gsap.ticker.add(() => {
      gsap.to(this.cursor, {
        x: this.mouseX,
        y: this.mouseY,
        duration: 0.5,
        ease: "power3.out"
      });
    });

    // Instant follow for inner dot
    gsap.ticker.add(() => {
      gsap.set(this.cursorDot, {
        x: this.mouseX,
        y: this.mouseY
      });
    });

    // Scale up on interactive elements
    document.querySelectorAll("a, button, [role='button'], input, textarea, select").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        gsap.to(this.cursor, { scale: 2, duration: 0.3, ease: "power2.out" });
        gsap.to(this.cursorDot, { scale: 0, duration: 0.3, ease: "power2.out" });
      });

      el.addEventListener("mouseleave", () => {
        gsap.to(this.cursor, { scale: 1, duration: 0.3, ease: "power2.out" });
        gsap.to(this.cursorDot, { scale: 1, duration: 0.3, ease: "power2.out" });
      });
    });

    // Hide on mouse leave window
    document.addEventListener("mouseleave", () => {
      gsap.to([this.cursor, this.cursorDot], { autoAlpha: 0, duration: 0.2 });
      this.isVisible = false;
    });
  }
}

// CSS for the cursor
/*
.cursor, .cursor-dot {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, -50%);
  opacity: 0;
}

.cursor {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  mix-blend-mode: difference;
}

.cursor-dot {
  width: 6px;
  height: 6px;
  background: black;
  border-radius: 50%;
  mix-blend-mode: difference;
}
*/
```

---

## Text Scramble / Decode Effect

Characters scramble through random glyphs before resolving to the final text. The hacker terminal aesthetic.

```javascript
function scrambleText(el, finalText, duration = 1.5) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const length = finalText.length;
  let frame = 0;
  const totalFrames = duration * 60; // Assuming 60fps

  function update() {
    const progress = frame / totalFrames;
    let result = "";

    for (let i = 0; i < length; i++) {
      if (finalText[i] === " ") {
        result += " ";
        continue;
      }

      // Characters resolve left to right
      const charProgress = progress * length;
      if (i < charProgress - 2) {
        result += finalText[i]; // Resolved
      } else if (i < charProgress + 3) {
        result += chars[Math.floor(Math.random() * chars.length)]; // Scrambling
      } else {
        result += finalText[i] === finalText[i].toUpperCase()
          ? chars[Math.floor(Math.random() * 26)]
          : chars[Math.floor(Math.random() * 26) + 26]; // Not yet reached
      }
    }

    el.textContent = result;
    frame++;

    if (frame <= totalFrames) {
      requestAnimationFrame(update);
    } else {
      el.textContent = finalText;
    }
  }

  requestAnimationFrame(update);
}

// Usage
const heading = document.querySelector(".scramble-heading");
scrambleText(heading, "Welcome to the Future", 1.2);
```

### GSAP ScrambleText Version (Simpler)

```javascript
gsap.to(".scramble-heading", {
  duration: 1.2,
  scrambleText: {
    text: "Welcome to the Future",
    chars: "upperCase",
    revealDelay: 0.3,
    speed: 0.5
  },
  ease: "none"
});
```

---

## FLIP Animation (Layout Change with Smooth Transition)

FLIP (First, Last, Invert, Play) animates between two layout states. Perfect for filtering grids, reordering lists, and expanding cards.

```javascript
function flipGridFilter(container, filterFn) {
  const items = gsap.utils.toArray(container.children);

  // FIRST: capture current positions
  const state = Flip.getState(items);

  // Apply filter (change layout)
  items.forEach((item) => {
    const shouldShow = filterFn(item);
    item.style.display = shouldShow ? "" : "none";
  });

  // LAST + INVERT + PLAY: animate from old positions to new
  Flip.from(state, {
    duration: 0.6,
    ease: "power2.inOut",
    stagger: 0.03,
    absolute: true,
    scale: true,
    onEnter: (elements) => {
      return gsap.from(elements, {
        opacity: 0,
        scale: 0.8,
        duration: 0.4
      });
    },
    onLeave: (elements) => {
      return gsap.to(elements, {
        opacity: 0,
        scale: 0.8,
        duration: 0.3
      });
    }
  });
}

// Usage
const grid = document.querySelector(".project-grid");
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const category = btn.dataset.category;
    flipGridFilter(grid, (item) => {
      return category === "all" || item.dataset.category === category;
    });
  });
});
```

---

## Infinite Marquee / Ticker

A seamless, infinitely scrolling horizontal strip. Used for client logos, testimonials, and decorative text.

```javascript
function createMarquee(selector, speed = 50) {
  const container = document.querySelector(selector);
  const content = container.querySelector(".marquee-content");

  // Clone content for seamless loop
  const clone = content.cloneNode(true);
  container.appendChild(clone);

  const totalWidth = content.offsetWidth;
  const duration = totalWidth / speed;

  gsap.to([content, clone], {
    x: -totalWidth,
    duration: duration,
    ease: "none",
    repeat: -1,
    modifiers: {
      x: gsap.utils.unitize((x) => {
        return parseFloat(x) % totalWidth;
      })
    }
  });
}

// Alternative: simpler approach with GSAP horizontal loop utility
function createMarqueeSimple(selector, speed = 1) {
  const items = gsap.utils.toArray(`${selector} .marquee-item`);

  const tl = gsap.timeline({ repeat: -1 });
  const totalWidth = items.reduce((acc, el) => acc + el.offsetWidth + parseInt(getComputedStyle(el).marginRight), 0);

  gsap.set(items, {
    x: (i) => i * (totalWidth / items.length)
  });

  items.forEach((item) => {
    tl.to(item, {
      x: `-=${totalWidth}`,
      duration: totalWidth / (speed * 100),
      ease: "none",
      modifiers: {
        x: gsap.utils.unitize((x) => {
          return (parseFloat(x) % totalWidth + totalWidth) % totalWidth;
        })
      }
    }, 0);
  });
}
```

### CSS-Only Marquee (Simpler, Less Control)

```css
.marquee {
  overflow: hidden;
  white-space: nowrap;
}

.marquee-track {
  display: inline-flex;
  animation: scroll-marquee 30s linear infinite;
}

.marquee-track > * {
  flex-shrink: 0;
}

@keyframes scroll-marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* Duplicate content in HTML for seamless loop */
```

---

## Accordion with Auto Height

GSAP can animate to `height: "auto"` — something CSS cannot do with transitions.

```javascript
function initAccordions() {
  const items = document.querySelectorAll(".accordion-item");

  items.forEach((item) => {
    const header = item.querySelector(".accordion-header");
    const body = item.querySelector(".accordion-body");
    const icon = item.querySelector(".accordion-icon");

    gsap.set(body, { height: 0, overflow: "hidden" });

    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");

      // Close all others
      items.forEach((other) => {
        if (other !== item && other.classList.contains("is-open")) {
          other.classList.remove("is-open");
          gsap.to(other.querySelector(".accordion-body"), {
            height: 0,
            duration: 0.4,
            ease: "power2.inOut"
          });
          gsap.to(other.querySelector(".accordion-icon"), {
            rotation: 0,
            duration: 0.3,
            ease: "power2.out"
          });
        }
      });

      // Toggle current
      if (isOpen) {
        item.classList.remove("is-open");
        gsap.to(body, { height: 0, duration: 0.4, ease: "power2.inOut" });
        gsap.to(icon, { rotation: 0, duration: 0.3, ease: "power2.out" });
      } else {
        item.classList.add("is-open");
        gsap.to(body, { height: "auto", duration: 0.4, ease: "power2.out" });
        gsap.to(icon, { rotation: 180, duration: 0.3, ease: "power2.out" });
      }
    });
  });
}
```

---

## Counter / Number Roll Animation

Animate a number from 0 to a target value with snap to integers. The odometer effect.

```javascript
function animateCounter(el, target, duration = 2) {
  const obj = { value: 0 };
  const isDecimal = target % 1 !== 0;
  const decimals = isDecimal ? (target.toString().split(".")[1] || "").length : 0;

  gsap.to(obj, {
    value: target,
    duration: duration,
    ease: "power2.out",
    snap: { value: isDecimal ? Math.pow(10, -decimals) : 1 },
    onUpdate: () => {
      if (isDecimal) {
        el.textContent = obj.value.toFixed(decimals);
      } else {
        el.textContent = Math.round(obj.value).toLocaleString();
      }
    },
    scrollTrigger: {
      trigger: el,
      start: "top 80%",
      toggleActions: "play none none none"
    }
  });
}

// Usage
document.querySelectorAll("[data-counter]").forEach((el) => {
  const target = parseFloat(el.dataset.counter);
  animateCounter(el, target);
});
```

---

## SVG Line Draw

Animate an SVG path drawing itself. Uses stroke-dasharray and stroke-dashoffset.

```javascript
function drawSVGPath(selector, duration = 2) {
  const paths = gsap.utils.toArray(selector);

  paths.forEach((path) => {
    const length = path.getTotalLength();

    gsap.set(path, {
      strokeDasharray: length,
      strokeDashoffset: length
    });

    gsap.to(path, {
      strokeDashoffset: 0,
      duration: duration,
      ease: "power2.inOut",
      scrollTrigger: {
        trigger: path.closest("svg"),
        start: "top 70%",
        toggleActions: "play none none none"
      }
    });
  });
}

// Usage
drawSVGPath(".draw-path", 1.5);
```

---

## Gradient Position Animation

Animate the position of a gradient background. Creates a flowing color shift.

```javascript
function animateGradient(el) {
  gsap.to(el, {
    backgroundPosition: "100% 50%",
    duration: 3,
    ease: "none",
    repeat: -1,
    yoyo: true
  });
}

// CSS: element needs a wide gradient and background-size > 100%
/*
.gradient-animated {
  background: linear-gradient(
    90deg,
    #667eea 0%,
    #764ba2 25%,
    #f093fb 50%,
    #667eea 75%,
    #764ba2 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
*/
```

---

## Responsive Animation (gsap.matchMedia)

Different animations for different screen sizes, with automatic cleanup.

```javascript
function initResponsiveAnimations() {
  const mm = gsap.matchMedia();

  mm.add({
    isDesktop: "(min-width: 1024px)",
    isMobile: "(max-width: 1023px)",
    prefersMotion: "(prefers-reduced-motion: no-preference)"
  }, (context) => {
    const { isDesktop, isMobile, prefersMotion } = context.conditions;

    if (!prefersMotion) return;

    if (isDesktop) {
      // Horizontal scroll section (desktop only)
      const panels = gsap.utils.toArray(".panel");
      gsap.to(panels, {
        xPercent: -100 * (panels.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: ".panels-container",
          pin: true,
          scrub: 1,
          end: () => "+=" + document.querySelector(".panels-container").scrollWidth
        }
      });

      // Parallax (desktop only)
      gsap.to(".hero-bg", {
        yPercent: -30,
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1
        }
      });
    }

    if (isMobile) {
      // Simpler animations for mobile
      gsap.from(".section-content", {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        scrollTrigger: {
          trigger: ".section-content",
          start: "top 85%"
        }
      });
    }
  });
}
```

---

## SplitText Hero Headline Reveal

The classic hero animation: characters fly up from behind a mask with stagger.

```javascript
function initHeroHeadline() {
  const heading = document.querySelector(".hero-headline");
  const split = new SplitText(heading, {
    type: "chars, words, lines",
    charsClass: "char",
    linesClass: "line"
  });

  // Create overflow masks for each line
  split.lines.forEach((line) => {
    const wrapper = document.createElement("div");
    wrapper.style.overflow = "hidden";
    wrapper.style.display = "block";
    line.parentNode.insertBefore(wrapper, line);
    wrapper.appendChild(line);
  });

  const tl = gsap.timeline({ delay: 0.3 });

  tl.from(split.chars, {
    yPercent: 110,
    rotateX: -40,
    opacity: 0,
    duration: 0.8,
    stagger: 0.025,
    ease: "power3.out"
  });

  // Cleanup on navigation (for SPAs)
  return () => split.revert();
}
```

---

*These recipes are starting points, not final implementations. Adjust timing, easing, and values to match your project's personality. The recipe gives you the structure — you give it the soul.*
