---
name: emil-kowalski-design
description: >-
  Use this skill whenever designing or implementing animations, micro-interactions,
  transitions, tactile feedback, toasts, dialogs, drawers, layout morphs, or gesture-driven
  UI. Embeds Emil Kowalski's core principles of animation on the web, spring physics,
  interaction delight, and fluid interfaces.
---

# Emil Kowalski's Design & Motion Engineering Principles

This skill encapsulates the philosophy, techniques, and micro-interaction craft championed by Emil Kowalski (creator of Sonner, "Animations on the Web", and former Design Engineer at Linear/Vercel).

---

## 1. Core Motion Philosophy

1. **Motion Must Have Purpose**:
   - Animation is not decoration; it communicates spatial relationships, state transitions, hierarchy, and physical presence.
   - If an animation does not explain *where something came from*, *where it went*, or *confirm an interaction*, remove it.

2. **Physics Over Durations (Springs > Easing)**:
   - Prefer spring physics over fixed-duration cubic beziers whenever interacting with direct manipulation or state toggles.
   - Springs naturally handle interruptions, velocity handoffs, and mid-flight reversals without jarring resets.
   - Recommended spring baselines:
     - **Snappy / Micro-interactions** (buttons, toggles, checkboxes, tabs): `stiffness: 400`, `damping: 30`, `mass: 0.8` (or duration ~180-220ms).
     - **Content transitions / Modals / Sheets**: `stiffness: 260`, `damping: 28`, `mass: 1.0` (smooth, settled, confident).
     - **Bouncy / Delight** (toasts, badges, popovers): `stiffness: 350`, `damping: 22` (subtle overshoot, max 5-10%).

3. **Duration Rules of Thumb**:
   - Micro-interactions (hover, press, icon flips): **100ms – 200ms**.
   - Small layout shifts (accordion, dropdown, tooltips): **200ms – 300ms**.
   - Large structural changes (page transitions, drawers, full modals): **300ms – 450ms**.
   - Never exceed 500ms for interactive UI. Slow animations frustrate power users.

---

## 2. The Emil Kowalski Playbook: Practical Techniques

### A. Scale & Press Micro-Feedback
Never let a clickable element feel dead. Provide tactile, immediate down-scale feedback on active press:
```css
/* Standard Emil-style tactile button feedback */
.interactive-element {
  transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease;
}
.interactive-element:hover {
  transform: translateY(-1px);
}
.interactive-element:active {
  transform: scale(0.97) translateY(0px);
}
```

### B. Shared Layout & Morphing Transitions (FLIP)
When moving from one state to another (e.g. an active tab pill, an expanding card, or an inline edit), avoid fading out and fading in:
- Animate position and dimension simultaneously using layout morphing (`layoutId` in Framer Motion).
- Keep content legible during the morph: cross-fade typography quickly while the container animates smoothly.

```tsx
// Active tab indicator with spring morph
{isActive && (
  <motion.div
    layoutId="active-pill"
    className="absolute inset-0 rounded-full bg-slate-900 dark:bg-white shadow-sm"
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  />
)}
```

### C. Gesture-Driven Drag & Velocity Preservation
- When building drawers, sheets, or dismissible toasts (Sonner pattern):
  - Retain touch/drag velocity upon release so throwing a drawer downwards dismisses it naturally.
  - Apply rubber-banding (logarithmic resistance) when dragged past constraints.
  - Scale background content slightly downwards (`scale(0.96)`, `border-radius: 16px`) when a mobile sheet opens over it.

### D. Layered Elevation & Light Refinement
Emil Kowalski's signature aesthetic involves rich, layered highlights and inner borders rather than heavy drop shadows:
- **1px Inner Border Highlight**: Adds sharp, physical definition to dark/light surfaces.
```css
/* Emil Kowalski signature polished card elevation */
.card-surface {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.08),            /* Crisp outer edge */
    0 1px 2px -1px rgba(0, 0, 0, 0.06),      /* Micro contact shadow */
    0 4px 12px -2px rgba(0, 0, 0, 0.08);     /* Soft ambient depth */
}

/* Dark mode version */
.dark .card-surface {
  background: rgba(23, 23, 23, 0.8);
  backdrop-filter: blur(16px);
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.08),     /* Subtle rim light */
    inset 0 1px 0 0 rgba(255, 255, 255, 0.12),/* Top bevel highlight */
    0 8px 24px -4px rgba(0, 0, 0, 0.4);       /* Deep ambient drop */
}
```

### E. Sonner-Style Toast Stacking
- Toasts should never push page content down.
- Multiple notifications stack with perspective depth:
  - Top toast: `scale(1.0)`, `translateY(0)`
  - Second toast: `scale(0.92)`, `translateY(-14px)`, `opacity(0.85)`
  - Third toast: `scale(0.84)`, `translateY(-28px)`, `opacity(0.6)`
- On hover/focus, expand the stack into a neat list.

---

## 3. Performance & Accessibility Standards

1. **GPU Acceleration Only**:
   - Only animate `transform` and `opacity`.
   - Never animate `width`, `height`, `top`, `left`, `margin`, or `padding` directly in CSS transitions (triggers CPU reflow / layout thrashing).
2. **Respect Reduced Motion**:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, ::before, ::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```
3. **Optimistic Visual Responses**:
   - Update the UI immediately on click; rollback gracefully with animated shake or error toast only if the server rejects the mutation.
