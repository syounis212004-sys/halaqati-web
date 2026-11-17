# Remotion — Programmatic Motion Graphics

> When your animation needs to become a video, Remotion turns React components into MP4 files.

Remotion lets you build motion graphics using React components, interpolation functions, and springs. Everything is deterministic, frame-based, and renderable to video.

---

## When to Use Remotion vs. Web Animation

| Need | Web Animation | Remotion |
|---|---|---|
| Interactive UI effects | Yes | No |
| Shareable video file | No | Yes (MP4, WebM, GIF) |
| Data-driven animation | Complex | Native |
| Pixel-perfect frame control | Approximate | Exact |
| Social media content | No | Yes |
| Product demo videos | Screenshot + edit | Code-generated |
| Personalized video at scale | No | Yes, via server rendering |

---

## Setup and Project Structure

### Installation

```bash
npx create-video@latest my-video
cd my-video
npm start
```

### Project Structure

```
src/
  Root.tsx              # Registers all compositions
  Composition1/
    index.tsx           # Main composition component
    Title.tsx           # Reusable animated text
    Logo.tsx            # Animated logo
  lib/
    constants.ts        # Frame rates, colors, durations
    fonts.ts            # Font loading
```

### Root Registration

```tsx
// src/Root.tsx
import { Composition } from "remotion";
import { KineticTypography } from "./KineticTypography";
import { DataViz } from "./DataViz";
import { ProductShowcase } from "./ProductShowcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="KineticTypography"
        component={KineticTypography}
        durationInFrames={300}
        fps={60}
        width={1920}
        height={1080}
        defaultProps={{
          text: "Build. Ship. Scale.",
          accentColor: "#3b82f6"
        }}
      />
      <Composition
        id="DataViz"
        component={DataViz}
        durationInFrames={450}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="ProductShowcase"
        component={ProductShowcase}
        durationInFrames={600}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};
```

---

## Remotion Core Concepts

### Frame-Based Thinking

In Remotion, time is measured in frames. At 60fps, frame 60 = 1 second. The `useCurrentFrame()` hook gives you the current frame number.

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
```

### Interpolation (The GSAP.utils.mapRange of Remotion)

```tsx
// Map frame number to a CSS value
const opacity = interpolate(
  frame,
  [0, 30],      // Input range: frames 0-30
  [0, 1],       // Output range: opacity 0-1
  { extrapolateRight: "clamp" }  // Don't go above 1
);

// With easing
import { Easing } from "remotion";

const y = interpolate(
  frame,
  [0, 40],
  [50, 0],
  {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp"
  }
);
```

### Springs (Physics-Based Motion)

```tsx
const scale = spring({
  frame,
  fps,
  config: {
    stiffness: 200,
    damping: 15,
    mass: 0.5
  }
});
```

---

## Composition 1: Kinetic Typography

A full kinetic typography video — text flies in, animates, and transitions between phrases.

```tsx
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill
} from "remotion";

interface KineticTypographyProps {
  text: string;
  accentColor: string;
}

function AnimatedWord({
  word,
  delay,
  color
}: {
  word: string;
  delay: number;
  color: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = frame - delay;

  if (adjustedFrame < 0) return null;

  const entrance = spring({
    frame: adjustedFrame,
    fps,
    config: { stiffness: 200, damping: 20, mass: 0.8 }
  });

  const y = interpolate(entrance, [0, 1], [80, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const rotate = interpolate(entrance, [0, 1], [8, 0]);

  return (
    <div
      style={{
        display: "inline-block",
        transform: `translateY(${y}px) rotate(${rotate}deg)`,
        opacity,
        color,
        fontSize: 120,
        fontWeight: 900,
        fontFamily: "Inter, sans-serif",
        letterSpacing: "-0.04em",
        marginRight: 30
      }}
    >
      {word}
    </div>
  );
}

export const KineticTypography: React.FC<KineticTypographyProps> = ({
  text,
  accentColor
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const words = text.split(". ").map((w) => w.replace(".", ""));

  // Background pulse
  const bgScale = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden"
      }}
    >
      {/* Ambient background gradient */}
      <div
        style={{
          position: "absolute",
          width: "120%",
          height: "120%",
          background: `radial-gradient(circle at 50% 50%, ${accentColor}15, transparent 70%)`,
          transform: `scale(${bgScale})`
        }}
      />

      {/* Words appear in sequence */}
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <AnimatedWord word={words[0] || "Build"} delay={0} color="white" />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={80} durationInFrames={90}>
        <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <AnimatedWord word={words[1] || "Ship"} delay={0} color={accentColor} />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={160} durationInFrames={140}>
        <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <AnimatedWord word={words[2] || "Scale"} delay={0} color="white" />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
```

---

## Composition 2: Animated Data Visualization

A bar chart that animates in with staggered bars and counting numbers.

```tsx
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  Easing
} from "remotion";

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

const data: DataPoint[] = [
  { label: "Jan", value: 45, color: "#3b82f6" },
  { label: "Feb", value: 62, color: "#8b5cf6" },
  { label: "Mar", value: 78, color: "#ec4899" },
  { label: "Apr", value: 91, color: "#f59e0b" },
  { label: "May", value: 120, color: "#10b981" },
  { label: "Jun", value: 156, color: "#06b6d4" }
];

function AnimatedBar({
  point,
  index,
  maxValue
}: {
  point: DataPoint;
  index: number;
  maxValue: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = index * 10;
  const adjustedFrame = Math.max(0, frame - 60 - delay);

  const heightProgress = spring({
    frame: adjustedFrame,
    fps,
    config: { stiffness: 100, damping: 18, mass: 0.6 }
  });

  const barHeight = interpolate(heightProgress, [0, 1], [0, (point.value / maxValue) * 400]);

  const numberValue = interpolate(
    heightProgress,
    [0, 1],
    [0, point.value],
    { extrapolateRight: "clamp" }
  );

  const labelOpacity = interpolate(frame, [30 + delay, 50 + delay], [0, 1], {
    extrapolateRight: "clamp"
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        flex: 1
      }}
    >
      {/* Value label */}
      <div
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          opacity: heightProgress
        }}
      >
        {Math.round(numberValue)}
      </div>

      {/* Bar */}
      <div
        style={{
          width: 60,
          height: barHeight,
          backgroundColor: point.color,
          borderRadius: "8px 8px 0 0",
          alignSelf: "flex-end"
        }}
      />

      {/* Label */}
      <div
        style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: 20,
          fontFamily: "Inter, sans-serif",
          opacity: labelOpacity
        }}
      >
        {point.label}
      </div>
    </div>
  );
}

export const DataViz: React.FC = () => {
  const frame = useCurrentFrame();
  const maxValue = Math.max(...data.map((d) => d.value));

  // Title entrance
  const titleY = interpolate(frame, [0, 30], [40, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp"
  });
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp"
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f172a",
        padding: 100,
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Title */}
      <div
        style={{
          color: "white",
          fontSize: 56,
          fontWeight: 800,
          fontFamily: "Inter, sans-serif",
          marginBottom: 80,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity
        }}
      >
        Revenue Growth 2024
      </div>

      {/* Chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 40,
          flex: 1,
          paddingBottom: 40
        }}
      >
        {data.map((point, i) => (
          <AnimatedBar
            key={point.label}
            point={point}
            index={i}
            maxValue={maxValue}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

---

## Composition 3: Animated Logo Reveal

A logo that draws itself via stroke animation, then fills with color.

```tsx
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  Easing
} from "remotion";

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Draw the stroke (frames 0-90)
  const drawProgress = interpolate(frame, [10, 90], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  // Phase 2: Fill appears (frames 80-120)
  const fillOpacity = interpolate(frame, [80, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  // Phase 3: Text slides in (frames 100+)
  const textSpring = spring({
    frame: Math.max(0, frame - 100),
    fps,
    config: { stiffness: 150, damping: 20, mass: 0.8 }
  });

  const textX = interpolate(textSpring, [0, 1], [40, 0]);
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);

  // Phase 4: Tagline (frames 140+)
  const taglineOpacity = interpolate(frame, [140, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const taglineY = interpolate(frame, [140, 170], [15, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  // Background glow
  const glowOpacity = interpolate(frame, [80, 130], [0, 0.3], {
    extrapolateRight: "clamp"
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column"
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, #3b82f6, transparent 70%)",
          opacity: glowOpacity,
          filter: "blur(80px)"
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        {/* SVG Logo with stroke draw */}
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Stroke version (draws in) */}
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeDasharray={314}
            strokeDashoffset={314 * (1 - drawProgress)}
            strokeLinecap="round"
          />
          {/* Fill version (fades in) */}
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="#3b82f6"
            opacity={fillOpacity}
          />
          {/* Inner icon */}
          <text
            x="60"
            y="72"
            textAnchor="middle"
            fill="white"
            fontSize="48"
            fontWeight="bold"
            fontFamily="Inter, sans-serif"
            opacity={fillOpacity}
          >
            A
          </text>
        </svg>

        {/* Company name */}
        <div>
          <div
            style={{
              color: "white",
              fontSize: 64,
              fontWeight: 800,
              fontFamily: "Inter, sans-serif",
              letterSpacing: "-0.03em",
              transform: `translateX(${textX}px)`,
              opacity: textOpacity
            }}
          >
            Acme
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 22,
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              transform: `translateY(${taglineY}px)`,
              opacity: taglineOpacity
            }}
          >
            Build the future
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

---

## Rendering and Encoding

### Preview

```bash
npx remotion preview src/index.ts
```

### Render to MP4

```bash
npx remotion render src/index.ts KineticTypography out/kinetic.mp4
```

### Render Options

```bash
# High quality
npx remotion render src/index.ts KineticTypography out/video.mp4 \
  --codec h264 \
  --crf 18 \
  --pixel-format yuv420p

# GIF (for social media previews)
npx remotion render src/index.ts KineticTypography out/video.gif \
  --codec gif \
  --every-nth-frame 2

# WebM (smaller file, modern browsers)
npx remotion render src/index.ts KineticTypography out/video.webm \
  --codec vp8

# Specific frame range (for previewing)
npx remotion render src/index.ts KineticTypography out/preview.mp4 \
  --frames 0-120
```

### Server-Side Rendering (for personalized video at scale)

```typescript
import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";

async function renderPersonalizedVideo(userName: string) {
  const bundleLocation = await bundle({
    entryPoint: "./src/index.ts"
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "KineticTypography",
    inputProps: {
      text: `Welcome, ${userName}`,
      accentColor: "#3b82f6"
    }
  });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: `out/${userName}.mp4`
  });
}
```

---

## Tips for Remotion Motion Design

1. **Think in sequences.** Use `<Sequence>` to structure your video into acts. Each sequence has its own timing, making complex choreography manageable.
2. **Springs over interpolation for organic motion.** `spring()` produces physically-correct motion. Use `interpolate()` for precise control (progress bars, counters).
3. **Frame math is your friend.** `frame - delay` shifts timing. `frame % loopDuration` creates loops. `Math.max(0, frame - start)` prevents negative frames.
4. **Use AbsoluteFill for layering.** Stack multiple AbsoluteFill components for parallax depth and overlay effects.
5. **Pre-calculate expensive operations.** Remotion re-renders every frame during preview. Keep component renders fast by avoiding heavy computation inside the render function.
6. **Test at 1x speed.** Remotion previews can be slow. Render a quick low-res version to check timing before the final high-res render.

---

---

## Remotion v4.x Updates

Remotion v4 introduced significant performance and tooling improvements:

- **Rust-based frame extractor**: Dramatically faster frame extraction compared to the previous Node.js implementation
- **Embedded FFmpeg**: No longer requires a separate FFmpeg installation. Remotion ships with its own optimized build
- **`@remotion/media`**: Experimental WebCodecs-based alternative for faster encoding in supported environments
- **Tailwind CSS support**: Use `@remotion/tailwind-v4` for Tailwind CSS v4 in your compositions

### Updated Installation

```bash
npx create-video@latest
```

This replaces the older `npx create-video` command and includes the latest project template with v4 defaults.

---

*Remotion bridges the gap between animation and video production. If you can build it in React, you can render it as a video. The creative possibilities are limited only by your imagination and your understanding of motion principles.*
