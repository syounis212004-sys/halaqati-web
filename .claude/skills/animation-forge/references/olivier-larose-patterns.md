# Olivier Larose Web Animation Patterns

> Practical, production-ready animation recipes from one of the web's most respected animation educators. These patterns power Awwwards-winning sites.

Source: [blog.olivierlarose.com](https://blog.olivierlarose.com/courses/web-animation-course)

## Table of Contents
1. Text Parallax (Sliding Text on Scroll)
2. Sticky/Magnetic Cursor
3. Magnetic Button (GSAP + Motion)
4. Blend Mode Cursor
5. Awwwards Side Menu
6. SVG Mask Section Transition
7. Smooth Scroll Setup (Lenis)
8. Parallax Scroll (GSAP vs Motion)
9. Pinned Image Gallery
10. Text Along SVG Path
11. Horizontal Scroll Section
12. Infinite Text Marquee
13. Perspective Section Transition
14. Cards Parallax Gallery

---

## 1. Text Parallax — Sliding Text on Scroll

Creates alternating text slides that move in opposite directions during scroll. Uses Lenis + Motion.

**Setup:**
```bash
npm i motion lenis
```

**Lenis initialization (app-level):**
```tsx
'use client'
import Lenis from 'lenis';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const lenis = new Lenis()
    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  }, [])

  return (
    <main className='overflow-hidden'>
      <div className='h-[100vh]'/>
      <TextParallax />
      <div className='h-[100vh]' />
    </main>
  );
}
```

**The Slide component with useScroll + useTransform:**
```tsx
import { useScroll, useTransform, motion } from 'motion/react';
import { useRef } from 'react';
import Image from 'next/image';

function TextParallax() {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'end start']
  })

  return (
    <div ref={container}>
      <Slide src="/img1.jpg" direction="left" left="-40%" progress={scrollYProgress}/>
      <Slide src="/img2.jpg" direction="right" left="-25%" progress={scrollYProgress}/>
      <Slide src="/img3.jpg" direction="left" left="-75%" progress={scrollYProgress}/>
    </div>
  )
}

function Slide({ src, direction, left, progress }) {
  const dir = direction === 'left' ? -1 : 1;
  const translateX = useTransform(progress, [0, 1], [150 * dir, -150 * dir])

  return (
    <motion.div style={{ x: translateX, left }} className="relative flex whitespace-nowrap">
      <Phrase src={src}/>
      <Phrase src={src}/>
      <Phrase src={src}/>
    </motion.div>
  )
}

function Phrase({ src }) {
  return (
    <div className="px-5 flex gap-5 items-center">
      <p className="text-[7.5vw]">Front End Developer</p>
      <span className="relative h-[7.5vw] aspect-[4/2] rounded-full overflow-hidden">
        <Image style={{ objectFit: "cover" }} src={src} alt="image" fill/>
      </span>
    </div>
  )
}
```

**Key technique:** `whitespace-nowrap` keeps phrases inline. Three copies of each phrase ensure seamless horizontal overflow. `useTransform` maps scroll progress (0-1) to pixel translation, multiplied by direction (-1 or 1) for alternating motion.

---

## 2. Sticky/Magnetic Cursor

Interactive cursor that grows and stretches when hovering interactive elements. Uses Motion springs + trigonometry for rotation.

```tsx
'use client'
import { useMotionValue, useSpring, motion, transform, animate } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export function StickyCursor({ stickyElement }) {
  const cursorSize = 15;
  const [isHovered, setIsHovered] = useState(false);
  const cursor = useRef(null);

  const mouse = {
    x: useMotionValue(0),
    y: useMotionValue(0)
  }

  const smoothOptions = { damping: 20, stiffness: 300, mass: 0.5 }
  const smoothMouse = {
    x: useSpring(mouse.x, smoothOptions),
    y: useSpring(mouse.y, smoothOptions)
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;

      if (isHovered) {
        const rect = stickyElement.current.getBoundingClientRect();
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const distance = { x: clientX - center.x, y: clientY - center.y };

        // Pull cursor 10% toward element center
        mouse.x.set((center.x - cursorSize / 2) + (distance.x * 0.1));
        mouse.y.set((center.y - cursorSize / 2) + (distance.y * 0.1));

        // Stretch based on distance
        const absDistance = Math.max(Math.abs(distance.x), Math.abs(distance.y));
        const newScaleX = transform(absDistance, [0, rect.height / 2], [1, 1.3]);
        const newScaleY = transform(absDistance, [0, rect.width / 2], [1, 0.8]);
        animate(cursor.current, { scaleX: newScaleX, scaleY: newScaleY }, { duration: 0.1 });

        // Rotate toward mouse direction
        const angle = Math.atan2(distance.y, distance.x);
        animate(cursor.current, { rotate: `${angle}rad` }, { duration: 0 });
      } else {
        mouse.x.set(clientX - cursorSize / 2);
        mouse.y.set(clientY - cursorSize / 2);
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isHovered])

  useEffect(() => {
    const el = stickyElement.current;
    const enter = () => setIsHovered(true);
    const leave = () => {
      setIsHovered(false);
      animate(cursor.current, { scaleX: 1, scaleY: 1 }, { duration: 0.3 });
    }
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    }
  }, [stickyElement])

  return (
    <motion.div
      ref={cursor}
      style={{
        left: smoothMouse.x,
        top: smoothMouse.y,
        transformTemplate: ({ rotate, scaleX, scaleY }) =>
          `rotate(${rotate}) scaleX(${scaleX}) scaleY(${scaleY})`
      }}
      className="fixed w-[15px] h-[15px] bg-black rounded-full pointer-events-none z-[9999]"
      animate={{ width: isHovered ? 60 : 15, height: isHovered ? 60 : 15 }}
    />
  )
}
```

**Key techniques:**
- `useMotionValue` + `useSpring` for smooth following without re-renders
- `Math.atan2` for rotation toward mouse direction
- `transform()` utility maps distance to scale values
- `transformTemplate` controls transform order (rotate before scale)

---

## 3. Magnetic Button — GSAP vs Motion

### GSAP approach (gsap.quickTo for performance)

```tsx
'use client'
import gsap from 'gsap';
import { useEffect, useRef } from 'react';

export function MagneticButton({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const xTo = gsap.quickTo(ref.current, "x", { duration: 1, ease: "elastic.out(1, 0.3)" });
    const yTo = gsap.quickTo(ref.current, "y", { duration: 1, ease: "elastic.out(1, 0.3)" });

    const handleMove = (e) => {
      const { clientX, clientY } = e;
      const { height, width, left, top } = ref.current.getBoundingClientRect();
      const x = clientX - (left + width / 2);
      const y = clientY - (top + height / 2);
      xTo(x * 0.35);
      yTo(y * 0.35);
    }

    const handleLeave = () => { xTo(0); yTo(0); }

    ref.current.addEventListener('mousemove', handleMove);
    ref.current.addEventListener('mouseleave', handleLeave);
    return () => {
      ref.current?.removeEventListener('mousemove', handleMove);
      ref.current?.removeEventListener('mouseleave', handleLeave);
    }
  }, [])

  return <div ref={ref}>{children}</div>
}
```

### Motion approach (declarative spring)

```tsx
'use client'
import { motion } from 'motion/react';
import { useState, useRef } from 'react';

export function MagneticButton({ children }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    setPosition({
      x: clientX - (left + width / 2),
      y: clientY - (top + height / 2)
    });
  }

  const reset = () => setPosition({ x: 0, y: 0 });

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={position}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
    >
      {children}
    </motion.div>
  )
}
```

**When to use which:** GSAP `quickTo` is more performant (no React re-renders). Motion is cleaner code but re-renders on every mouse move.

---

## 4. Blend Mode Cursor

Cursor with `mix-blend-mode: difference` that inverts colors. Grows on hover over text.

**Core concept:** Store mouse position in ref (NOT state) for performance. Use `requestAnimationFrame` + linear interpolation (lerp) for smooth following.

### Full implementation

```tsx
'use client'
import gsap from 'gsap';
import { useEffect, useRef } from 'react';

export function BlendModeCursor() {
  const cursorRef = useRef(null);
  const targetPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const rafId = useRef(null);

  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  useEffect(() => {
    // Center cursor with xPercent/yPercent
    gsap.set(cursorRef.current, { xPercent: -50, yPercent: -50 });

    const handleMouseMove = (e) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
    }

    function animate() {
      currentPos.current.x = lerp(currentPos.current.x, targetPos.current.x, 0.075);
      currentPos.current.y = lerp(currentPos.current.y, targetPos.current.y, 0.075);
      gsap.set(cursorRef.current, {
        x: currentPos.current.x,
        y: currentPos.current.y
      });
      rafId.current = requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', handleMouseMove);
    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId.current);
    }
  }, [])

  // Grow on text hover
  useEffect(() => {
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, span');

    const handleEnter = () => {
      gsap.to(cursorRef.current, {
        width: 400,
        height: 400,
        filter: 'blur(20px)',
        duration: 0.4,
        ease: 'power2.out'
      });
    }

    const handleLeave = () => {
      gsap.to(cursorRef.current, {
        width: 30,
        height: 30,
        filter: 'blur(0px)',
        duration: 0.4,
        ease: 'power2.out'
      });
    }

    textElements.forEach(el => {
      el.addEventListener('mouseenter', handleEnter);
      el.addEventListener('mouseleave', handleLeave);
    });

    return () => {
      textElements.forEach(el => {
        el.removeEventListener('mouseenter', handleEnter);
        el.removeEventListener('mouseleave', handleLeave);
      });
    }
  }, [])

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 w-[30px] h-[30px] rounded-full bg-white pointer-events-none z-[9999]"
      style={{ mixBlendMode: 'difference' }}
    />
  )
}
```

**Key techniques:**
- `mix-blend-mode: difference` on the cursor div inverts underlying colors
- Lerp factor of 0.075 gives a smooth, trailing cursor feel
- `gsap.set()` in RAF loop for zero-jank positioning
- Scale from 30px to 400px on text hover with blur filter for a soft glow

---

## 5. Awwwards Side Menu

Full-screen menu with perspective 3D link animations. Based on Agence Cartier navigation pattern.

### Menu container with AnimatePresence

```tsx
'use client'
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const links = [
  { title: "Home", href: "/" },
  { title: "Work", href: "/work" },
  { title: "About", href: "/about" },
  { title: "Contact", href: "/contact" },
];

const menuVariants = {
  open: {
    width: "480px",
    height: "650px",
    top: "-25px",
    right: "-25px",
    transition: { duration: 0.75, type: "tween", ease: [0.76, 0, 0.24, 1] }
  },
  closed: {
    width: "100px",
    height: "40px",
    top: "0px",
    right: "0px",
    transition: { duration: 0.75, delay: 0.35, type: "tween", ease: [0.76, 0, 0.24, 1] }
  }
}

export function SideMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed right-[50px] top-[50px] z-50">
      <motion.div
        className="relative bg-[#c9c9c9] rounded-[25px] overflow-hidden"
        variants={menuVariants}
        animate={isOpen ? "open" : "closed"}
        initial="closed"
      >
        <AnimatePresence>
          {isOpen && <MenuContent />}
        </AnimatePresence>
      </motion.div>
      <Button isOpen={isOpen} toggle={() => setIsOpen(!isOpen)} />
    </div>
  )
}
```

### Link animation with perspective

```tsx
const linkVariants = {
  initial: { opacity: 0, rotateX: 90, translateY: 80, translateX: -20 },
  enter: (i) => ({
    opacity: 1,
    rotateX: 0,
    translateY: 0,
    translateX: 0,
    transition: {
      duration: 0.65,
      delay: 0.5 + (i * 0.1),
      ease: [0.215, 0.61, 0.355, 1]
    }
  }),
  exit: {
    opacity: 0,
    transition: { duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1] }
  }
}

function MenuContent() {
  return (
    <div className="flex flex-col justify-between h-full p-[100px_40px_50px_40px] box-border">
      <div className="flex flex-col gap-[10px]">
        {links.map((link, i) => (
          <div key={i} className="linkContainer" style={{ perspective: '120px', perspectiveOrigin: 'bottom' }}>
            <motion.div
              custom={i}
              variants={linkVariants}
              initial="initial"
              animate="enter"
              exit="exit"
            >
              <a href={link.href} className="text-[46px] text-black no-underline">
                {link.title}
              </a>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Hamburger button

```tsx
function Button({ isOpen, toggle }) {
  return (
    <div
      onClick={toggle}
      className="absolute top-0 right-0 w-[100px] h-[40px] cursor-pointer rounded-[25px] overflow-hidden"
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ top: isOpen ? "-100%" : "0%" }}
        transition={{ duration: 0.5, type: "tween", ease: [0.76, 0, 0.24, 1] }}
      >
        <div className="w-full h-full flex items-center justify-center uppercase text-sm">
          <p>Menu</p>
        </div>
        <div className="w-full h-full flex items-center justify-center uppercase text-sm absolute top-full">
          <p>Close</p>
        </div>
      </motion.div>
    </div>
  )
}
```

**Key technique:** `rotateX: 90` combined with `perspective: 120px` creates a "flipping in from below" effect. Staggered with `delay: 0.5 + (i * 0.1)`. The ease `[0.76, 0, 0.24, 1]` is an aggressive ease-in-out that feels premium.

---

## 6. SVG Mask Section Transition

Uses an SVG clipPath to create an organic shape transition between sections. The mask scales up on scroll to reveal the next section.

### SVG mask component

```tsx
'use client'
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function SVGMaskTransition() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          scrub: true,
          pin: true,
          start: "top top",
          end: "+=150%",
        }
      });

      // Scale the SVG mask from tiny to full viewport
      tl.to(svgRef.current.querySelector('circle'), {
        attr: { r: 150 },
        ease: "none"
      });
    });
    return () => ctx.revert();
  }, [])

  return (
    <div ref={containerRef} className="relative h-screen overflow-hidden">
      {/* Background (revealed section) */}
      <div className="absolute inset-0 bg-black">
        <h2 className="text-white text-6xl text-center pt-[40vh]">Next Section</h2>
      </div>

      {/* Foreground (masked section) */}
      <div className="absolute inset-0" style={{
        clipPath: 'url(#svgMask)',
        WebkitClipPath: 'url(#svgMask)'
      }}>
        <div className="bg-white h-full">
          <h2 className="text-black text-6xl text-center pt-[40vh]">Current Section</h2>
        </div>
      </div>

      <svg ref={svgRef} className="absolute" width="0" height="0">
        <defs>
          <clipPath id="svgMask" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.01" />
          </clipPath>
        </defs>
      </svg>
    </div>
  )
}
```

**Variations:**
- Use `<path>` instead of `<circle>` for organic blob shapes
- Animate `d` attribute with GSAP MorphSVG for shape-morphing reveals
- Use multiple shapes for a multi-point reveal

**Key technique:** `clipPathUnits="objectBoundingBox"` makes coordinates relative (0-1), so the mask scales with the container. Animating `r` from 0.01 to a large value creates a circle wipe.

---

## 7. Smooth Scroll Setup (Lenis)

The standard smooth scroll setup for modern award-winning sites. Lenis replaced Locomotive Scroll as the industry standard.

### Standalone Lenis (Motion projects)

```tsx
'use client'
import Lenis from 'lenis';
import { useEffect } from 'react';

export function SmoothScrollProvider({ children }) {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,           // 0.1 = smooth, 0.5 = snappy, 1 = no smoothing
      duration: 1.2,       // Alternative to lerp (don't use both)
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, [])

  return <>{children}</>
}
```

### Lenis + GSAP ScrollTrigger (the standard combo)

```tsx
'use client'
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect } from 'react';

gsap.registerPlugin(ScrollTrigger);

export function SmoothScrollProvider({ children }) {
  useEffect(() => {
    const lenis = new Lenis();

    // Connect Lenis to ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000) });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    }
  }, [])

  return <>{children}</>
}
```

### Usage in layout.tsx

```tsx
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  )
}
```

**Important:** Do NOT use `lenis/react` — it adds unnecessary complexity. The manual setup above is what award-winning sites actually use.

---

## 8. Parallax Scroll — GSAP vs Motion Side by Side

### GSAP (timeline + scrub)

```tsx
'use client'
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Image from 'next/image';

gsap.registerPlugin(ScrollTrigger);

export function GSAPParallax() {
  const container = useRef(null);
  const title1 = useRef(null);
  const image2 = useRef(null);
  const image3 = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
      tl.to(title1.current, { y: -50 }, 0)
        .to(image2.current, { y: -150 }, 0)
        .to(image3.current, { y: -255 }, 0)
    });
    return () => ctx.revert();
  }, [])

  return (
    <div ref={container} className="relative h-[150vh]">
      <h1 ref={title1} className="text-6xl">Parallax Title</h1>
      <div ref={image2} className="relative w-[400px] h-[300px]">
        <Image src="/img2.jpg" alt="" fill style={{ objectFit: 'cover' }} />
      </div>
      <div ref={image3} className="relative w-[400px] h-[300px]">
        <Image src="/img3.jpg" alt="" fill style={{ objectFit: 'cover' }} />
      </div>
    </div>
  )
}
```

### Motion (useScroll + useTransform)

```tsx
'use client'
import { useScroll, useTransform, motion } from 'motion/react';
import { useRef } from 'react';
import Image from 'next/image';

export function MotionParallax() {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'end start']
  })

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -255]);

  return (
    <div ref={container} className="relative h-[150vh]">
      <motion.h1 style={{ y: y1 }} className="text-6xl">Parallax Title</motion.h1>
      <motion.div style={{ y: y2 }} className="relative w-[400px] h-[300px]">
        <Image src="/img2.jpg" alt="" fill style={{ objectFit: 'cover' }} />
      </motion.div>
      <motion.div style={{ y: y3 }} className="relative w-[400px] h-[300px]">
        <Image src="/img3.jpg" alt="" fill style={{ objectFit: 'cover' }} />
      </motion.div>
    </div>
  )
}
```

**When to use which:** GSAP for complex multi-element timelines with precise control. Motion for simple 1-2 element parallax with less boilerplate.

---

## 9. Pinned Image Gallery

A gallery where images are pinned and stack on top of each other as user scrolls. Each card scales down slightly when the next one arrives.

### GSAP ScrollTrigger approach

```tsx
'use client'
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Image from 'next/image';

gsap.registerPlugin(ScrollTrigger);

const projects = [
  { title: 'Project 1', src: '/img1.jpg', color: '#21242b' },
  { title: 'Project 2', src: '/img2.jpg', color: '#8C8C8C' },
  { title: 'Project 3', src: '/img3.jpg', color: '#EFE8D3' },
  { title: 'Project 4', src: '/img4.jpg', color: '#706D63' },
];

export function PinnedGallery() {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.gallery-card');

      cards.forEach((card, i) => {
        // Pin each card
        ScrollTrigger.create({
          trigger: card,
          start: `top-=${i * 25}`,
          endTrigger: containerRef.current,
          end: 'bottom bottom',
          pin: true,
          pinSpacing: false,
        });

        // Scale down previous cards
        if (i < cards.length - 1) {
          gsap.to(card, {
            scale: 0.9 + (0.025 * i),
            scrollTrigger: {
              trigger: cards[i + 1],
              start: 'top bottom',
              end: 'top top',
              scrub: true,
            }
          });
        }
      });
    });
    return () => ctx.revert();
  }, [])

  return (
    <div ref={containerRef} className="relative mt-[50vh] mb-[50vh]">
      {projects.map((project, i) => (
        <div
          key={i}
          className="gallery-card h-screen flex items-center justify-center"
          style={{ backgroundColor: project.color }}
        >
          <div className="relative w-[1000px] h-[600px]">
            <Image src={project.src} alt={project.title} fill style={{ objectFit: 'cover' }} />
          </div>
          <h2 className="absolute text-white text-5xl">{project.title}</h2>
        </div>
      ))}
    </div>
  )
}
```

### Motion approach (scale on scroll)

```tsx
'use client'
import { useScroll, useTransform, motion } from 'motion/react';
import { useRef } from 'react';
import Image from 'next/image';

function Card({ i, project, progress, range, targetScale }) {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'start start']
  })
  const imageScale = useTransform(scrollYProgress, [0, 1], [2, 1]);
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div ref={container} className="h-screen flex items-center justify-center sticky top-0">
      <motion.div
        style={{ scale, top: `calc(-5vh + ${i * 25}px)` }}
        className="relative w-[1000px] h-[500px] rounded-[25px] overflow-hidden"
        style={{ backgroundColor: project.color }}
      >
        <h2 className="text-center pt-10 text-3xl">{project.title}</h2>
        <div className="relative w-[60%] h-[60%] mx-auto mt-10 rounded-[25px] overflow-hidden">
          <motion.div style={{ scale: imageScale }} className="w-full h-full">
            <Image src={project.src} alt={project.title} fill style={{ objectFit: 'cover' }} />
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export function PinnedGallery() {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end']
  })

  return (
    <div ref={container} className="relative mt-[50vh]">
      {projects.map((project, i) => {
        const targetScale = 1 - ((projects.length - i) * 0.05);
        return (
          <Card
            key={i}
            i={i}
            project={project}
            progress={scrollYProgress}
            range={[i * (1 / projects.length), 1]}
            targetScale={targetScale}
          />
        )
      })}
    </div>
  )
}
```

**Key technique:** `sticky top-0` + stacked cards with `scale` transforms. Each card's target scale is slightly less than the next, creating a depth effect. The image inside uses `useTransform` for a parallax zoom as the card enters.

---

## 10. Text Along SVG Path

Text that follows and flows along an SVG path, animated on scroll.

```tsx
'use client'
import { useScroll, useTransform, motion } from 'motion/react';
import { useRef } from 'react';

export function TextAlongPath() {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'end start']
  })

  // Move text along path using startOffset
  const startOffset = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div ref={container} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen flex items-center justify-center">
        <svg viewBox="0 0 1200 600" className="w-full">
          <defs>
            <path
              id="textPath"
              d="M 0 300 Q 300 50 600 300 Q 900 550 1200 300"
              fill="none"
            />
          </defs>
          <text className="text-[48px] fill-black font-bold">
            <motion.textPath
              href="#textPath"
              style={{ startOffset }}
            >
              Creativity is intelligence having fun - Albert Einstein
            </motion.textPath>
          </text>
        </svg>
      </div>
    </div>
  )
}
```

**Key technique:** SVG `<textPath>` with `startOffset` attribute animated from 0% to 100% maps the text position along the bezier curve to scroll progress. The section is pinned with `sticky top-0`.

---

## 11. Horizontal Scroll Section

A section where vertical scroll translates to horizontal movement. The most requested Awwwards pattern.

### GSAP approach (the standard)

```tsx
'use client'
import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const slides = [
  { title: 'Slide 1', color: '#21242b' },
  { title: 'Slide 2', color: '#8C8C8C' },
  { title: 'Slide 3', color: '#EFE8D3' },
  { title: 'Slide 4', color: '#706D63' },
];

export function HorizontalScroll() {
  const containerRef = useRef(null);
  const sliderRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const slides = gsap.utils.toArray('.h-slide');
      const totalWidth = slides.length * window.innerWidth;

      gsap.to(sliderRef.current, {
        x: -(totalWidth - window.innerWidth),
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true,
          scrub: 1,
          end: () => `+=${totalWidth}`,
          invalidateOnRefresh: true,
        }
      });
    });
    return () => ctx.revert();
  }, [])

  return (
    <div ref={containerRef} className="overflow-hidden">
      <div ref={sliderRef} className="flex h-screen w-fit">
        {slides.map((slide, i) => (
          <div
            key={i}
            className="h-slide w-screen h-screen flex items-center justify-center"
            style={{ backgroundColor: slide.color }}
          >
            <h2 className="text-white text-6xl">{slide.title}</h2>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Motion approach (useTransform)

```tsx
'use client'
import { useScroll, useTransform, motion } from 'motion/react';
import { useRef } from 'react';

export function HorizontalScroll() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  })

  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-75%']); // 4 slides = -75%

  return (
    <div ref={containerRef} className="relative h-[400vh]">
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <motion.div style={{ x }} className="flex w-[400vw]">
          {slides.map((slide, i) => (
            <div
              key={i}
              className="w-screen h-screen flex items-center justify-center"
              style={{ backgroundColor: slide.color }}
            >
              <h2 className="text-white text-6xl">{slide.title}</h2>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
```

**GSAP advantage:** Built-in `pin` and `scrub` handle the math automatically. Motion requires manual height calculation (`h-[400vh]` for 4 slides) and sticky positioning.

---

## 12. Infinite Text Marquee

Seamlessly looping horizontal text that never stops. Two approaches depending on complexity needs.

### CSS-only (simplest, best performance)

```tsx
export function Marquee({ text, speed = 20 }) {
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <div
        className="inline-flex animate-marquee"
        style={{ '--speed': `${speed}s` } as React.CSSProperties}
      >
        <span className="text-[8vw] font-bold px-4">{text}</span>
        <span className="text-[8vw] font-bold px-4">{text}</span>
        <span className="text-[8vw] font-bold px-4">{text}</span>
        <span className="text-[8vw] font-bold px-4">{text}</span>
      </div>
    </div>
  )
}
```

```css
/* globals.css */
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-marquee {
  animation: marquee var(--speed) linear infinite;
}
```

### Motion (scroll-speed-responsive)

```tsx
'use client'
import { useScroll, useTransform, useSpring, motion } from 'motion/react';
import { useRef, useState, useEffect } from 'react';

export function ScrollMarquee({ text }) {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'end start']
  })

  const x1 = useTransform(scrollYProgress, [0, 1], [0, -500]);
  const x2 = useTransform(scrollYProgress, [0, 1], [0, 500]);

  // Skew based on scroll velocity
  const [scrollVelocity, setScrollVelocity] = useState(0);
  useEffect(() => {
    return scrollYProgress.on('velocityChange', (v) => {
      setScrollVelocity(Math.min(Math.abs(v) * 5, 15));
    });
  }, [])
  const skewX = useSpring(scrollVelocity, { stiffness: 100, damping: 30 });

  return (
    <div ref={container} className="overflow-hidden">
      <motion.div style={{ x: x1, skewX }} className="flex whitespace-nowrap">
        {[...Array(4)].map((_, i) => (
          <span key={i} className="text-[8vw] font-bold px-8">{text}</span>
        ))}
      </motion.div>
      <motion.div style={{ x: x2, skewX }} className="flex whitespace-nowrap">
        {[...Array(4)].map((_, i) => (
          <span key={i} className="text-[8vw] font-bold px-8">{text}</span>
        ))}
      </motion.div>
    </div>
  )
}
```

**Key technique:** Two rows moving in opposite directions via `useTransform` with opposite ranges. The `skewX` based on scroll velocity adds a dynamic lean effect that makes it feel responsive to user speed.

---

## 13. Perspective Section Transition

Sections that rotate in 3D on scroll, creating a page-turning or folding effect between content blocks.

```tsx
'use client'
import { useScroll, useTransform, motion } from 'motion/react';
import { useRef } from 'react';

const sections = [
  { title: 'Section 1', color: '#1a1a2e', textColor: '#e0e0e0' },
  { title: 'Section 2', color: '#16213e', textColor: '#e0e0e0' },
  { title: 'Section 3', color: '#0f3460', textColor: '#e0e0e0' },
];

function PerspectiveSection({ i, section }) {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'end start']
  })

  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [45, 0, -45]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 0.85]);

  return (
    <div ref={container} className="h-screen" style={{ perspective: '1200px' }}>
      <motion.div
        style={{
          rotateX,
          opacity,
          scale,
          transformOrigin: i % 2 === 0 ? 'top center' : 'bottom center',
          backgroundColor: section.color,
          color: section.textColor,
        }}
        className="h-full flex items-center justify-center"
      >
        <h2 className="text-7xl font-bold">{section.title}</h2>
      </motion.div>
    </div>
  )
}

export function PerspectiveTransitions() {
  return (
    <div>
      {sections.map((section, i) => (
        <PerspectiveSection key={i} i={i} section={section} />
      ))}
    </div>
  )
}
```

**Key technique:** Alternating `transformOrigin` between `top center` and `bottom center` for even/odd sections creates a book-page-turning effect. The `rotateX` goes from 45 to 0 to -45 degrees mapping the full scroll range. `perspective: 1200px` on the parent gives enough depth without extreme distortion.

---

## 14. Cards Parallax Gallery

A masonry-style gallery where cards move at different speeds during scroll, creating depth through differential parallax.

```tsx
'use client'
import { useScroll, useTransform, motion } from 'motion/react';
import { useRef } from 'react';
import Image from 'next/image';

const images = [
  '/img1.jpg', '/img2.jpg', '/img3.jpg',
  '/img4.jpg', '/img5.jpg', '/img6.jpg',
  '/img7.jpg', '/img8.jpg', '/img9.jpg',
  '/img10.jpg', '/img11.jpg', '/img12.jpg',
];

export function CardsParallaxGallery() {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end']
  })

  // Three columns with different speeds
  const col1Y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const col2Y = useTransform(scrollYProgress, [0, 1], [0, -400]);
  const col3Y = useTransform(scrollYProgress, [0, 1], [0, -250]);

  return (
    <div ref={container} className="relative h-[250vh]">
      <div className="sticky top-0 h-screen flex items-end overflow-hidden">
        <div className="flex gap-[2vw] px-[2vw] w-full">
          <Column images={images.slice(0, 4)} y={col1Y} />
          <Column images={images.slice(4, 8)} y={col2Y} />
          <Column images={images.slice(8, 12)} y={col3Y} />
        </div>
      </div>
    </div>
  )
}

function Column({ images, y }) {
  return (
    <motion.div style={{ y }} className="flex flex-col gap-[2vw] flex-1">
      {images.map((src, i) => (
        <div key={i} className="relative w-full h-[40vh] rounded-[1vw] overflow-hidden">
          <Image src={src} alt="" fill style={{ objectFit: 'cover' }} />
        </div>
      ))}
    </motion.div>
  )
}
```

**Key technique:** Three columns with different `useTransform` y ranges (-200, -400, -250) create differential parallax. The middle column moves fastest, creating a concave depth illusion. `sticky top-0` + `items-end` starts the gallery from the bottom, so content scrolls upward.

---

## Pattern Decision Guide

| Pattern | Best Library | Complexity | Awwwards Impact |
|---------|-------------|------------|-----------------|
| Text parallax | Motion | Beginner | High — effortless visual depth |
| Magnetic button | GSAP quickTo | Beginner | Medium — premium micro-interaction |
| Sticky cursor | Motion springs | Intermediate | Very High — signature award move |
| Blend mode cursor | GSAP + CSS | Intermediate | High — memorable visual effect |
| Side menu | Motion variants | Intermediate | High — professional navigation |
| SVG mask transition | GSAP + SVG | Advanced | Very High — section wow factor |
| Smooth scroll | Lenis | Beginner | Essential — baseline for all award sites |
| Parallax scroll | Either | Beginner | High — universal depth technique |
| Pinned gallery | GSAP or Motion | Intermediate | High — portfolio staple |
| Text along path | Motion + SVG | Intermediate | Medium — creative accent |
| Horizontal scroll | GSAP pin | Advanced | Very High — immersive storytelling |
| Infinite marquee | CSS or Motion | Beginner | Medium — dynamic accent |
| Perspective transition | Motion | Advanced | Very High — cinematic feel |
| Cards parallax | Motion | Intermediate | High — gallery depth effect |

---

## Combining Patterns

The most impactful sites combine 3-5 of these patterns:

**Portfolio site recipe:**
1. Smooth scroll (Lenis) as foundation
2. Sticky cursor with blend mode
3. Text parallax for hero
4. Pinned gallery for projects
5. Magnetic buttons for CTAs

**Agency site recipe:**
1. Smooth scroll (Lenis) as foundation
2. Horizontal scroll for case studies
3. Perspective transitions between sections
4. Awwwards side menu
5. Cards parallax for team/clients

**Landing page recipe:**
1. Smooth scroll (Lenis) as foundation
2. SVG mask transition for hero reveal
3. Text parallax for tagline section
4. Infinite marquee for social proof
5. Magnetic buttons for conversion

---

## Common Pitfalls

1. **Performance:** Never animate `width`, `height`, `top`, `left` on scroll. Always use `transform` and `opacity`.
2. **Mobile:** Disable custom cursors on touch devices. Check `window.matchMedia('(hover: hover)')`.
3. **Accessibility:** Respect `prefers-reduced-motion`. Wrap all scroll animations in a media query check.
4. **SSR:** All these patterns need `'use client'` in Next.js. Lenis and GSAP must only initialize in `useEffect`.
5. **Cleanup:** Always return cleanup functions from `useEffect`. Use `gsap.context().revert()` for GSAP.
6. **Lenis + ScrollTrigger:** Must connect them via `lenis.on('scroll', ScrollTrigger.update)` or ScrollTrigger won't know about smooth scroll position.

```tsx
// Reduced motion check
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  // Skip animations or use instant transitions
  gsap.globalTimeline.timeScale(100); // effectively instant
}
```

---

*These patterns are the practical building blocks of Awwwards-winning sites. Master them individually, then combine them thoughtfully. The goal is not to use every pattern — it's to pick the right 3-5 that serve the story your site is telling.*
