# Micro-Interactions — The Complete Library

> Every interactive element on the page is a handshake with the user. Make it firm, warm, and memorable.

This file contains production-ready code for every common micro-interaction. Each pattern includes CSS-only and GSAP versions where appropriate.

---

## Button Hover Effects

### Scale + Shadow Lift (The Universal Default)

The simplest, most universally appropriate button hover. It works on every brand, every context.

```css
.btn {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.2);
  transition-duration: 100ms;
}
```

### Shine Sweep

A diagonal light sweep across the button surface. Premium, jewelry-like feel. Used on Apple product CTAs.

```css
.btn-shine {
  position: relative;
  overflow: hidden;
}

.btn-shine::after {
  content: "";
  position: absolute;
  top: -50%;
  left: -75%;
  width: 50%;
  height: 200%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  transform: skewX(-25deg);
  transition: left 500ms cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-shine:hover::after {
  left: 125%;
}
```

### Magnetic Button (GSAP)

The button subtly follows the cursor within a threshold. When the cursor leaves, it springs back. This is the Awwwards signature interaction — seen on Studio Freight, Locomotive, and Linear.

```javascript
function createMagneticButton(el, strength = 0.3) {
  const bounds = el.getBoundingClientRect();
  const threshold = 80;

  function onMouseMove(e) {
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < threshold) {
      gsap.to(el, {
        x: deltaX * strength,
        y: deltaY * strength,
        duration: 0.3,
        ease: "power2.out"
      });
    }
  }

  function onMouseLeave() {
    gsap.to(el, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.3)"
    });
  }

  el.addEventListener("mousemove", onMouseMove);
  el.addEventListener("mouseleave", onMouseLeave);

  return () => {
    el.removeEventListener("mousemove", onMouseMove);
    el.removeEventListener("mouseleave", onMouseLeave);
  };
}
```

### Ripple Effect (Material Design Style)

Click feedback that radiates from the cursor position. Works in any context, adds tactile quality.

```javascript
function createRipple(el) {
  el.style.position = "relative";
  el.style.overflow = "hidden";

  el.addEventListener("click", (e) => {
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 2;

    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      left: ${e.clientX - rect.left - size / 2}px;
      top: ${e.clientY - rect.top - size / 2}px;
      pointer-events: none;
      transform: scale(0);
    `;

    el.appendChild(ripple);

    gsap.to(ripple, {
      scale: 1,
      opacity: 0,
      duration: 0.6,
      ease: "power2.out",
      onComplete: () => ripple.remove()
    });
  });
}
```

### Fill Hover (Background Slides In)

Background color sweeps in from one side. Clean, modern, used by Stripe and Vercel.

```css
.btn-fill {
  position: relative;
  color: var(--text);
  background: transparent;
  border: 1px solid currentColor;
  overflow: hidden;
  z-index: 1;
  transition: color 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-fill::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--text);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
  z-index: -1;
}

.btn-fill:hover {
  color: var(--bg);
}

.btn-fill:hover::before {
  transform: scaleX(1);
}
```

---

## Link Underline Animations

### Slide In From Left

```css
.link {
  position: relative;
  text-decoration: none;
}

.link::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.link:hover::after {
  transform: scaleX(1);
}
```

### Draw From Center

```css
.link-center::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 50%;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: translateX(-50%) scaleX(0);
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.link-center:hover::after {
  transform: translateX(-50%) scaleX(1);
}
```

### Slide Out Then In (Directional)

The underline slides out to the right, then slides in from the left. Creates a flowing, continuous feel.

```css
.link-slide {
  position: relative;
  text-decoration: none;
}

.link-slide::after {
  content: "";
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 1px;
  background: currentColor;
  transform: scaleX(1);
  transform-origin: right;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.link-slide:hover::after {
  transform: scaleX(0);
  transform-origin: left;
}
```

---

## Input Focus Effects

### Border Glow

```css
.input {
  border: 1px solid #e0e0e0;
  outline: none;
  transition: border-color 200ms ease,
              box-shadow 200ms ease;
}

.input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
```

### Floating Label

```css
.field {
  position: relative;
}

.field input {
  padding: 20px 16px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  outline: none;
  transition: border-color 200ms ease;
  width: 100%;
}

.field label {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  pointer-events: none;
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  font-size: 1rem;
}

.field input:focus + label,
.field input:not(:placeholder-shown) + label {
  top: 12px;
  transform: translateY(0);
  font-size: 0.75rem;
  color: #3b82f6;
}

.field input:focus {
  border-color: #3b82f6;
}
```

### Shake on Error

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.input-error {
  border-color: #ef4444;
  animation: shake 400ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
```

---

## Toggle Switches

### Spring Physics Toggle (GSAP)

```javascript
function initToggle(el) {
  const thumb = el.querySelector(".toggle-thumb");
  const track = el.querySelector(".toggle-track");
  let isOn = false;

  el.addEventListener("click", () => {
    isOn = !isOn;

    gsap.to(thumb, {
      x: isOn ? 24 : 0,
      duration: 0.4,
      ease: "elastic.out(1, 0.5)"
    });

    gsap.to(track, {
      backgroundColor: isOn ? "#22c55e" : "#e5e7eb",
      duration: 0.2,
      ease: "power2.out"
    });
  });
}
```

### CSS-Only Toggle

```css
.toggle {
  width: 52px;
  height: 28px;
  background: #e5e7eb;
  border-radius: 14px;
  cursor: pointer;
  position: relative;
  transition: background 200ms ease;
}

.toggle::after {
  content: "";
  position: absolute;
  width: 22px;
  height: 22px;
  background: white;
  border-radius: 50%;
  top: 3px;
  left: 3px;
  transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle[aria-checked="true"] {
  background: #22c55e;
}

.toggle[aria-checked="true"]::after {
  transform: translateX(24px);
}
```

---

## Tooltip Enter/Exit

```css
.tooltip {
  position: absolute;
  padding: 8px 12px;
  background: #1a1a1a;
  color: white;
  border-radius: 6px;
  font-size: 0.8rem;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 150ms ease,
              transform 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.trigger:hover + .tooltip,
.trigger:focus + .tooltip {
  opacity: 1;
  transform: translateY(0);
}
```

---

## Card Hover Effects

### Lift + Shadow + Image Zoom

The triple threat. Card lifts, shadow deepens, inner image zooms. Standard for portfolios and e-commerce.

```css
.card {
  border-radius: 12px;
  overflow: hidden;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.15);
}

.card img {
  transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
}

.card:hover img {
  transform: scale(1.05);
}
```

### Content Reveal on Hover

Hidden content slides up from the bottom on hover. Great for portfolio cards and team members.

```css
.card-reveal {
  position: relative;
  overflow: hidden;
}

.card-reveal .overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  display: flex;
  align-items: flex-end;
  padding: 24px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 300ms ease,
              transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.card-reveal:hover .overlay {
  opacity: 1;
  transform: translateY(0);
}
```

### 3D Tilt Card

See `references/physics-and-3d.md` for the full tilt implementation with mouse tracking.

---

## Cursor Effects

### Grow on Interactive Elements

```javascript
function initCursorGrow() {
  const cursor = document.querySelector(".custom-cursor");

  document.querySelectorAll("a, button, [role='button']").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      gsap.to(cursor, {
        scale: 2.5,
        duration: 0.3,
        ease: "power2.out"
      });
    });

    el.addEventListener("mouseleave", () => {
      gsap.to(cursor, {
        scale: 1,
        duration: 0.3,
        ease: "power2.out"
      });
    });
  });
}
```

### Smooth Cursor Follow

```javascript
function initSmoothCursor() {
  const cursor = document.querySelector(".custom-cursor");
  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  gsap.ticker.add(() => {
    gsap.to(cursor, {
      x: mouseX,
      y: mouseY,
      duration: 0.5,
      ease: "power3.out"
    });
  });
}
```

---

## Navigation Patterns

### Hamburger to X Morph

```css
.hamburger {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  padding: 8px;
}

.hamburger span {
  display: block;
  width: 24px;
  height: 2px;
  background: currentColor;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
              opacity 200ms ease;
}

.hamburger[aria-expanded="true"] span:nth-child(1) {
  transform: translateY(8px) rotate(45deg);
}

.hamburger[aria-expanded="true"] span:nth-child(2) {
  opacity: 0;
}

.hamburger[aria-expanded="true"] span:nth-child(3) {
  transform: translateY(-8px) rotate(-45deg);
}
```

### Dropdown Cascade

Items stagger in from the top with a slight slide down and fade.

```javascript
function openDropdown(menu) {
  const items = menu.querySelectorAll("li");

  gsap.set(menu, { autoAlpha: 1 });
  gsap.from(items, {
    y: -10,
    opacity: 0,
    duration: 0.3,
    stagger: 0.05,
    ease: "power2.out"
  });
}

function closeDropdown(menu) {
  const items = menu.querySelectorAll("li");

  gsap.to(items, {
    y: -10,
    opacity: 0,
    duration: 0.2,
    stagger: { each: 0.03, from: "end" },
    ease: "power2.in",
    onComplete: () => gsap.set(menu, { autoAlpha: 0 })
  });
}
```

### Mobile Navigation Overlay (Staggered)

Full-screen overlay with links staggering in from the left. Exit reverses the stagger from the bottom up.

```javascript
function openMobileNav() {
  const overlay = document.querySelector(".mobile-nav");
  const links = overlay.querySelectorAll(".nav-link");
  const bg = overlay.querySelector(".nav-bg");

  const tl = gsap.timeline();

  tl.set(overlay, { autoAlpha: 1 })
    .from(bg, {
      clipPath: "circle(0% at top right)",
      duration: 0.6,
      ease: "power3.out"
    })
    .from(links, {
      x: -40,
      opacity: 0,
      duration: 0.4,
      stagger: 0.08,
      ease: "power2.out"
    }, "-=0.2");

  return tl;
}
```

---

## Notification / Toast Enter

```javascript
function showToast(message) {
  const toast = createToastElement(message);
  document.body.appendChild(toast);

  gsap.from(toast, {
    y: 20,
    opacity: 0,
    scale: 0.95,
    duration: 0.4,
    ease: "back.out(1.7)"
  });

  gsap.to(toast, {
    y: -10,
    opacity: 0,
    scale: 0.95,
    duration: 0.3,
    ease: "power2.in",
    delay: 4,
    onComplete: () => toast.remove()
  });
}
```

---

## Accordion Animation

Smooth height animation without hardcoded values. Uses GSAP for auto height.

```javascript
function toggleAccordion(header) {
  const content = header.nextElementSibling;
  const isOpen = header.getAttribute("aria-expanded") === "true";

  if (isOpen) {
    gsap.to(content, {
      height: 0,
      opacity: 0,
      duration: 0.3,
      ease: "power2.inOut",
      onComplete: () => {
        header.setAttribute("aria-expanded", "false");
      }
    });
  } else {
    header.setAttribute("aria-expanded", "true");
    gsap.set(content, { height: "auto", opacity: 1 });
    gsap.from(content, {
      height: 0,
      opacity: 0,
      duration: 0.4,
      ease: "power2.out"
    });
  }
}
```

---

*Every micro-interaction in this file respects the 200ms rule: interactive feedback must feel instant. If it takes longer than 200ms for the user to see a response to their action, the interface feels broken. Adjust durations down, never up.*
