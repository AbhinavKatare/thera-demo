---
name: impeccable-design
description: >-
  Use this skill to achieve impeccable craft, rigorous precision, mathematical rhythm,
  and faultless execution in web interfaces, design systems, and frontend components.
  Guarantees zero layout shifts, complete state coverage, optical alignment, typography
  perfection, and resilient edge-case handling.
---

# Impeccable Design: Precision & Craft Standards

"Impeccable" means flawless, without defect, and executed with profound attention to detail. This skill governs the visual and ergonomic quality of every user interface component.

---

## 1. Mathematical Rhythm & Spacing Scale

1. **Strict 4px/8px Spacing Grid**:
   - All margins, paddings, gaps, and dimensions must derive from the base 4px/8px scale:
     - `4px` (0.25rem) – micro spacing (badge padding, icon-text gap)
     - `8px` (0.5rem) – compact spacing (form input inner padding, tight stack)
     - `12px` (0.75rem) – medium spacing (card item padding, list spacing)
     - `16px` (1rem) – base unit (card padding, standard component gap)
     - `24px` (1.5rem) – container separation, modal padding
     - `32px` / `48px` / `64px` – layout sections and macro hierarchy
   - **Never invent ad-hoc pixel values** (e.g. `margin: 13px; padding: 19px;`).

2. **Nested Corner Radius Law**:
   - Inner radius must equal outer radius minus padding to prevent awkward corner bunching:
     $$\text{Radius}_{\text{inner}} = \max(0, \text{Radius}_{\text{outer}} - \text{Padding})$$
   - *Example*: If an outer container has `rounded-2xl` (16px) and `padding: 8px`, the inner element **must** have `rounded-lg` (8px), not 16px.

3. **Standard Interactive Height Scale**:
   - Inputs, buttons, and select triggers in the same form must align to identical heights:
     - Compact: `h-8` (32px), `text-xs`
     - Regular: `h-10` (40px), `text-sm`
     - Prominent: `h-12` (48px), `text-base`

---

## 2. Typographic Discipline & Optical Balance

1. **Letter-Spacing Tracking Rule**:
   - Large headings need tighter tracking (compensates for optical expansion):
     - `text-3xl` and above: `tracking-tight` (`-0.025em`) to `tracking-tighter` (`-0.05em`)
     - Body `text-sm` / `text-base`: `tracking-normal` (`0em`)
     - Small uppercase labels / badges (`text-xs font-semibold uppercase`): `tracking-wider` (`+0.05em`) to `tracking-widest` (`+0.1em`).

2. **Tabular Figures for Financial & Numerical Data**:
   - In any table, balance card, invoice amount, or metric display, always enforce tabular numbers to prevent jitter as digits update:
     ```css
     .financial-value {
       font-variant-numeric: tabular-nums lining-nums;
       /* or Tailwind: */
       @apply tabular-nums;
     }
     ```

3. **Modern Text Wrapping**:
   - Prevent lone dangling words (widows) in headings:
     ```css
     h1, h2, h3 {
       text-wrap: balance;
     }
     p {
       text-wrap: pretty;
     }
     ```

4. **Optical Centering**:
   - Geometric centering is often visually incorrect.
   - Triangle / Play icons: Shift 1-2px right of geometric center.
   - Badges next to mixed-case text: Align with capital letter height (cap-height), not descender baseline.

---

## 3. The 6 Mandatory UI States

Every view or component must explicitly implement all 6 states:

| State | Impeccable Implementation Requirement |
|---|---|
| **1. Empty State** | Helpful, welcoming illustration or icon; concise copy explaining why it's empty; single clear primary Call to Action (CTA). |
| **2. Loading / Skeleton** | Skeletons must match the exact dimensions, line counts, and corner radii of loaded content to prevent layout shifts (CLS = 0). |
| **3. Idle / Populated** | Crisp typography, harmonious data density, and clear reading flow. |
| **4. Hover / Focus / Active** | Micro-elevation or highlight on hover; tactile down-scale on active press; non-clipping high-contrast focus rings (`outline-offset-2`). |
| **5. Error / Validation** | Inline context-specific error messages; red/rose borders with descriptive resolution guidance; never just a red border without text. |
| **6. Partial / Overflow** | Truncation (`truncate`) with tooltip for text that exceeds boundaries; responsive flex wrap; explicit max-widths. |

---

## 4. Internationalization & Edge Case Robustness

- **Currency Variations**: Support 3-letter ISO currencies, non-USD decimal schemes (e.g. JPY has no minor units, BRL uses `,` for decimals).
- **Name Lengths**: Test cards and tables against short names ("Ed Wu") and long international names ("Rodrigo Gonçalves dos Santos-Albuquerque").
- **Zero & Negative Numbers**: Clear neutral styling for `$0.00`; red/amber styling for negative adjustments `-$450.00`.
- **Keyboard Navigation**: Ensure every interactive component is reachable via `Tab`, activatable via `Enter` / `Space`, and dismissible via `Escape`.
