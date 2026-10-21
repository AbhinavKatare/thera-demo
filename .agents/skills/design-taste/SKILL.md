---
name: design-taste
description: >-
  Use this skill to elevate visual aesthetics, cultivate design taste, exercise aesthetic
  restraint, and craft premium, world-class interfaces. Guides curated color palettes,
  subtraction over addition, depth, dark mode excellence, and emotional polish inspired
  by Apple, Linear, Stripe, and Vercel.
---

# Design Taste: Aesthetics, Restraint & Craft

Taste is the disciplined intuition of knowing what to leave out, what to emphasize, and how to make digital software feel calm, trustworthy, and exceptionally well-crafted.

---

## 1. The Cardinal Rule: Subtraction Over Addition

1. **Remove Visual Noise**:
   - If an element doesn't serve understanding or interaction, delete it.
   - Replace heavy border grids with subtle background separation or clean whitespace.
   - Avoid badge overload: do not put every metric in a brightly colored capsule. Use quiet, muted badges (`bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300`).

2. **One Voice at a Time**:
   - Establish a clear hierarchy on every screen:
     - **Hero / Primary Element**: The single focal point (e.g. Total Payroll Amount, Pending Approval Card).
     - **Supporting Data**: Quiet, neutral, easily scannable typography.
     - **Tertiary / Metadata**: Muted, low-contrast text (`text-slate-500` / `text-zinc-400`).

---

## 2. Palette & Contrast Architecture

### A. Dark Mode Done Right (Deep Obsidian, Never Raw Black)
- **Do not use raw `#000000`** as a blanket background; it destroys depth and causes eye strain against white text.
- Use tinted, sophisticated dark neutrals:
  - Base background: `zinc-950` (`#09090b`) or `slate-950` (`#020617`).
  - Card elevation: `zinc-900/80` (`#18181b`) with `backdrop-blur-md`.
  - Border definition: `border-white/10` or `border-zinc-800`.
  - Highlight rim: `inset 0 1px 0 rgba(255, 255, 255, 0.08)`.

### B. Light Mode Done Right (Crisp Airiness)
- Base background: subtle off-white (`slate-50` `#f8fafc` or `zinc-50` `#fafafa`).
- Cards: pure white `#ffffff` elevated with layered micro-shadows rather than thick dark outlines.
- Borders: soft hairlines (`border-slate-200/80` or `border-black/5`).

### C. Tailored Accent Hues
- Avoid default harsh primary colors (raw saturated blue/red/green).
- Curate purposeful, mature tones:
  - **Financial Positive / Success**: Soft Emerald (`emerald-500` / `emerald-600`), not radioactive lime green.
  - **Financial Alert / Pending**: Warm Amber / Honey (`amber-500` / `amber-600`), readable on both dark & light backgrounds.
  - **Critical / Danger**: Rich Cranberry / Rose (`rose-500` / `rose-600`), never flat red.
  - **Brand / Focus**: Electric Indigo or Deep Sapphire (`indigo-600` / `blue-600`).

---

## 3. Depth, Material & Modern Finish

1. **Subtle Radial Spotlight Gradients**:
   - Give cards a responsive aura that makes flat surfaces feel alive:
   ```css
   .spotlight-card {
     position: relative;
     background: radial-gradient(
       600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
       rgba(255, 255, 255, 0.06),
       transparent 40%
     );
   }
   ```

2. **Hairline Dividers**:
   - When separating items in a list or table, use ultra-fine dividers:
     ```css
     /* Hairline border */
     border-bottom: 1px solid rgba(0, 0, 0, 0.06);
     /* In dark mode: */
     border-bottom: 1px solid rgba(255, 255, 255, 0.07);
     ```

3. **Iconography Harmony**:
   - Use a single, cohesive icon library (e.g. Lucide or Phosphor Icons).
   - Enforce uniform stroke weights: `1.5px` or `1.75px` (never mix 1px hairline icons with 2.5px chunky icons).
   - Icons accompanying text must inherit color (`currentColor`) and match optical cap-height (`size-4` for 14px text, `size-5` for 16px text).

---

## 4. Emotional Tone in Fintech & Payroll

When designing interfaces for financial software like **PayPilot**:
- **Confidence & Reassurance**: Users are moving real money. Every button state, confirmation dialog, and approval banner must look rock-solid and intentional.
- **Scannable Precision**: Align numerical columns to the right, text columns to the left, and statuses centered.
- **Never Gimmicky**: Delight comes from speed, precision, and fluid responsiveness—not intrusive confetti or unnecessary animations.
