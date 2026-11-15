# UI/UX Contract

## Design Priorities

Halaqati is an operational tool. Optimize in this order:

1. correctness of information;
2. speed of daily actions;
3. clarity and accessibility;
4. visual polish.

A prettier screen that slows down attendance or hides plan information is a regression.

## RTL & Arabic

- Design RTL-first.
- Verify icon directionality where semantic direction matters.
- Keep numbers, Quran references, dates, and mixed Latin/Arabic content readable.
- Do not rely on LTR spacing assumptions.
- Avoid title overlap in narrow widths.

## Mobile-First Density

For lists of students:

- prioritize compact, scan-friendly rows;
- keep primary action/state visible without scrolling into each card;
- allow the page to handle typical circle size efficiently;
- use progressive disclosure for secondary details.

## Components

Prefer reusable design-system components for:

- student list rows
- status chips
- action buttons
- dialogs/bottom sheets
- plan progress
- statistics cards
- empty/error/loading states

Do not create visually different variants of the same semantic component without reason.

## Accessibility

- Touch targets should be comfortably tappable on phones.
- Ensure sufficient contrast.
- Provide text/icon semantics; do not use color alone for status.
- Focus states must work on web.
- Dialogs require logical focus and clear close/confirm actions.
- Loading must not trap interaction indefinitely.

## Feedback States

Every important action should communicate:

- pending/loading
- success when needed
- actionable error
- retry or recovery path where appropriate

Do not silently swallow Supabase/network errors.

## Responsive Targets

At minimum inspect touched UI on:

- common Android phone width
- small/narrow phone width
- tablet/iPad width
- desktop/web width where the page is used

Avoid fixed heights that clip Arabic labels or student names.

## Visual Design Inputs

When using reference tools such as Figma/Mobbin:

- borrow interaction patterns, hierarchy, and density—not branded visual copying;
- preserve Halaqati's own design system;
- validate the result against actual Arabic content and long names.
