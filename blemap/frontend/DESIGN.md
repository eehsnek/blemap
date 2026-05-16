# Design System: The Alchemy of Insight

## 1. Overview & Creative North Star: "The Living Archive"
This design system is built upon a conceptual metaphor of **The Living Archive**. It represents the transformation of raw, unrefined challenges into polished, enduring wisdom. We move away from the "disposable" feel of modern SaaS and toward an editorial, research-heavy experience that feels like a digital artifact.

**The Creative North Star: "The Living Archive"**
The interface mimics the process of oxidation. **Bronze** represents the "Problem"—the raw, heavy, and unyielding reality. **Patina** represents the "Solution"—the protective, ethereal, and refined layer that grows over time.

To break the "template" look, this system utilizes:
*   **Intentional Asymmetry:** Heavy bronze elements on one side balanced by airy, glowing patina elements on the other.
*   **Physicality through Layering:** No flat grids. Every element exists on a specific depth plane.
*   **High-Contrast Typography Scales:** Dramatic shifts between utilitarian data and elegant, serif-driven narratives.

---

## 2. Colors: The Bronze and the Patina
The palette is rooted in a deep, nocturnal foundation to allow the metallic and oxidized tones to vibrate.

### The Color Strategy
*   **Primary (Bronze):** Use `#ffb779` (Primary) and `#cd7f32` (Primary Container) for problem states, critical data points, and urgent obstacles.
*   **Secondary (Patina):** Use `#43e2d2` (Secondary) and `#00c6b6` (Secondary Container) for solutions, AI insights, and pathways forward.
*   **Tertiary (Warmth):** Use `#ffb68c` for subtle human-centric accents or "Editor's Notes."

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning or layout. Containers must be defined by background color shifts. 
*   Place a `surface-container-low` section on a `surface` background to define a zone. 
*   Standard UI borders feel "engineered"; tonal transitions feel "curated."

### Surface Hierarchy & Nesting
Treat the UI as physical sheets of glass and metal:
1.  **Base Layer:** `surface` (#131313).
2.  **Layout Zones:** `surface-container-low` (#1c1b1b) for sidebars or secondary content.
3.  **Active Workspace:** `surface-container` (#201f1f) for the main focus area.
4.  **Floating Cards:** `surface-container-high` (#2a2a2a) for interactive elements.

### The "Glass & Gradient" Rule
To elevate the "Patina" effect, use glassmorphism for floating Solution elements. Apply `surface-variant` with a 60% opacity and a `20px` backdrop-blur. For primary CTAs, use a subtle linear gradient from `primary` (#ffb779) to `primary-container` (#cd7f32) at a 135-degree angle to simulate light hitting a metallic surface.

---

## 3. Typography: Data vs. Knowledge
We utilize a dual-typeface system to distinguish between raw information and synthesized intelligence.

*   **The Utilitarian (Inter):** Used for labels, data tables, and input fields. It represents the "Engineer's view." Use `title-sm` and `label-md` for high-density research data.
*   **The Intellectual (Noto Serif):** Used for `display`, `headline`, and AI-generated summaries. This represents the "Scholar's view." It adds a sense of history and authority to the platform's conclusions.

**Hierarchy of Identity:**
*   **Display Large:** `notoSerif` at 3.5rem. Used for major thematic breakthroughs.
*   **Title Medium:** `inter` at 1.125rem. Used for navigation and structural labeling.
*   **Body Large:** `inter` at 1rem. Used for standard user-generated content.

---

## 4. Elevation & Depth: Tonal Layering
Depth is achieved through light and material, never through heavy shadows or structural lines.

### The Layering Principle
Stacking tiers is the only way to create hierarchy. A card using `surface-container-lowest` placed inside a `surface-container-high` zone creates a "carved out" look, suggesting depth without a single drop shadow.

### Ambient Shadows
For floating modals or popovers, use a shadow with a `40px` blur and `6%` opacity. The shadow color must be a tinted version of `on-surface` (#e5e2e1) rather than black, creating a "glow" rather than a "darkness."

### The "Ghost Border" Fallback
If accessibility requires a boundary, use a **Ghost Border**: `outline-variant` (#534438) at **15% opacity**. It should be barely perceptible, serving as a suggestion of a container rather than a cage.

---

## 5. Components

### Cards (The Core Duality)
*   **Problem Cards:** Sharp edges (`roundedness-none`). Bordered with a 1px `primary-container` (#cd7f32) stroke to feel rigid and difficult. 
*   **Solution Cards:** Highly rounded (`roundedness-xl`). No borders. Use a `secondary-fixed-dim` (#3adccc) outer glow (5px blur) to simulate the "Patina" oxidation.

### Nodes & Relationships (The Map)
*   **Impact Nodes:** Circular (`roundedness-full`). Size is proportional to the data impact. Use `primary` for problems and `secondary` for solutions.
*   **Relationship Lines:** 0.5px width. Use `outline-variant`. For active relationships, use a gradient line transitioning from Bronze to Patina.

### Buttons
*   **Primary (Action):** `roundedness-sm`. Filled with `primary-container`. No shadow.
*   **Secondary (Inquiry):** `roundedness-full`. `outline` stroke at 20% opacity. Text in `secondary`.
*   **Tertiary (Navigation):** Ghost style. No background. Use `label-md` for text.

### Input Fields
*   Text inputs use `surface-container-lowest`. On focus, the bottom edge glows with a 1px `primary` line. Do not wrap inputs in high-contrast boxes; let them breathe within their containers.

### List Items
*   **Strict Rule:** No divider lines between list items. Use 16px of vertical white space from the Spacing Scale. If separation is needed, use a alternating background shift of 2% between `surface-container` and `surface-container-high`.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** allow elements to overlap slightly to create a sense of an organic "stack" of research.
*   **Do** use `notoSerif` for any text that is "system-generated" or "AI-synthesized."
*   **Do** use asymmetrical layouts where the left side of the screen feels "heavier" than the right.

### Don't:
*   **Don't** use 100% opaque, high-contrast borders. It kills the "Living Archive" metaphor.
*   **Don't** use generic Material Design blue or standard "success" green. Only use the Patina (`#43e2d2`) for positive states.
*   **Don't** use rounded corners on Problem-related components. Problems are sharp; Solutions are smooth.
*   **Don't** use standard drop shadows. If it doesn't look like ambient light, don't use it.