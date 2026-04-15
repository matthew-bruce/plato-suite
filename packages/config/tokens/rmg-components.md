# Royal Mail Group — Component Specs

Source: Figma "RM-Design-System" (`5DoXLKL4LncAx5JKqWGWYm`)
Pages: 12:7 Tabs · 12:8 Controls · 12:9 Stepper
Extracted: 2026-04-15

Token references map to `--rmg-*` variables defined in `tokens/rmg.css`.
All dimensions are in px from Figma metadata unless noted.

---

## Additional typography confirmed from component bindings

These styles were confirmed from component variable bindings and supplement `rmg.css`:

| Style | Family | Weight | Size | Line height | CSS vars |
|-------|--------|--------|------|-------------|----------|
| Caption 1 / Reg | PF DinText Std | 400 | 14px | **20px** | `--rmg-text-c1` / `--rmg-leading-c1` |
| Caption 2 / Bold | PF DinText Std | 700 | 12px | **16px** | `--rmg-text-c2` / `--rmg-leading-c2` |
| Body 3 / Bold | PF DinText Std | 700 | 16px | 22px | `--rmg-text-b3` / `--rmg-leading-b3` |

> **Note:** `--rmg-leading-c1` is set to `18px` (estimated) in the current `rmg.css`.
> The confirmed value from the Stepper component is **20px**. Update before shipping.

---

## 1. Tabs

**Description:** Tab component used to cycle through in-page content. Two layout variants — Desktop + Tablet (horizontal strip, all tabs visible) and Mobile (horizontally scrollable strip).

### 1.1 Variants

| Variant | Width | Height | Notes |
|---------|-------|--------|-------|
| Desktop + Tablet strip | 658px (container) | 56px | All tabs visible, no scroll |
| Mobile strip | 347px (container) | 96px | Scrollable; inner strip 315×54px with 16px inset |

Individual tab chip sizes:

| Device | Width | Height | Border radius |
|--------|-------|--------|---------------|
| Desktop + Tablet | ~107px (content-fit) | 44px | pill (22px / 50%) |
| Mobile | ~80px (content-fit) | 42px | pill (21px / 50%) |

The widths above are the reference sizes shown in the Figma states panel. In production the pill width should be content-fit with consistent horizontal padding (see §1.3).

### 1.2 States

#### Desktop + Tablet tab chip

| State | Background | Text colour | Text style | Token refs |
|-------|------------|-------------|------------|------------|
| Active | `#DA202A` | `#FFFFFF` | B2 / Reg — 18px / lh 24 | `--rmg-color-red`, `--rmg-color-white`, `--rmg-text-b2` |
| Inactive (Default) | `#EEEEEE` | `#333333` | B2 / Reg — 18px / lh 24 | `--rmg-color-grey-3`, `--rmg-color-text-body`, `--rmg-text-b2` |
| Hover | `#EEEEEE` | `#B70D12` | B2 / Reg — 18px / lh 24 | `--rmg-color-grey-3`, `--rmg-color-warm-red`, `--rmg-text-b2` |

#### Mobile tab chip

| State | Background | Text colour | Text style | Token refs |
|-------|------------|-------------|------------|------------|
| Active | `#DA202A` | `#FFFFFF` | B3 / Reg — 16px / lh 22 | `--rmg-color-red`, `--rmg-color-white`, `--rmg-text-b3` |
| Inactive (Default) | `#EEEEEE` | `#333333` | B3 / Reg — 16px / lh 22 | `--rmg-color-grey-3`, `--rmg-color-text-body`, `--rmg-text-b3` |
| Hover | `#EEEEEE` | `#B70D12` | B3 / Reg — 16px / lh 22 | `--rmg-color-grey-3`, `--rmg-color-warm-red`, `--rmg-text-b3` |

> No `disabled` state defined in the Figma spec for Tabs.
> No `focus` ring defined — add one for accessibility (`outline: 2px solid #DA202A`).

### 1.3 Spacing / padding

Derived from the state display frames (container 72px tall, tab chip 44px, offset 14px top/bottom):

| Property | Value | Token |
|----------|-------|-------|
| Chip vertical padding | 10px top + bottom | (~`--rmg-spacing-03` − 2px) |
| Chip horizontal padding | 16px left + right | `--rmg-spacing-04` |
| Gap between chips | 8px | `--rmg-spacing-02` |
| Strip top / bottom padding | ~6px | — |

### 1.4 Behaviour notes

- Desktop + Tablet: all tabs render in a single non-scrolling row. Overflow not handled in spec — implement with `overflow: hidden` or allow wrapping.
- Mobile: strip is horizontally scrollable (dashed-box indicator in Figma represents scroll container boundary). Scrollbar should be hidden.
- Reference noted in spec (hidden text in file): [Material Design M3 Tabs guidelines](https://m3.material.io/components/tabs/guidelines).
- Active indicator: the entire pill background changes to RM Red — there is no separate underline indicator.
- Transition: no animation values specified; recommend `transition: background-color 150ms ease, color 150ms ease`.

---

## 2. Controls

**Description:** Chevron arrow buttons used for carousels and sliders. Two size variants — Large for Desktop, Small for Tablet + Mobile. Used individually (Chevron buttons) and as a composite pair (Carousel controls). A Slider variant combines chevrons with a progress track.

### 2.1 Chevron Button

A circular icon button containing a left or right chevron SVG.

#### Sizes

| Variant | Width | Height | Border radius |
|---------|-------|--------|---------------|
| Large (Desktop) | 64px | 64px | 50% (circle) |
| Small (Tablet + Mobile) | 48px | 48px | 50% (circle) |

#### States (all sizes)

| State | Background | Icon colour | Token refs |
|-------|------------|-------------|------------|
| Active | `#F5F5F5` | `#E63338` | `--rmg-color-grey-4`, `--rmg-color-bright-red` |
| Disabled | `#F5F5F5` | `#D5D5D5` | `--rmg-color-grey-4`, `--rmg-color-grey-2` |
| Hover | `#B70D12` | `#FFFFFF` | `--rmg-color-warm-red`, `--rmg-color-white` |

> No `focus` ring defined in spec — add `outline: 2px solid #DA202A; outline-offset: 2px` for accessibility.
> The `active` state in the Figma represents the normal interactive state (not a pressed/click state).
> The button is visually identical left and right; direction is determined by the chevron icon rotation or separate icon asset.

### 2.2 Carousel Controls (composite)

A pair of left + right Chevron Buttons with an optional dot-pagination indicator between them.

#### Desktop variant

| Property | Value |
|----------|-------|
| Total width | 140px |
| Height | 64px |
| Composition | Left chevron (Large) + Right chevron (Large) |
| Gap between buttons | 12px |

#### Tablet + Mobile variant

| Property | Value |
|----------|-------|
| Total width | 242px |
| Height | 48px |
| Composition | Left chevron (Small) + dot pagination + Right chevron (Small) |

#### Dot pagination indicator

| State | Colour | Token |
|-------|--------|-------|
| Inactive dot | `#D5D5D5` | `--rmg-color-grey-2` |
| Active dot | `#E63338` | `--rmg-color-bright-red` |

- Dot count: reflects total number of carousel slides (1 dot active at a time).
- Dot size and spacing not explicitly dimensioned in spec; estimate 8px diameter, 4px gap.

### 2.3 Slider

A linear progress track with left/right chevron buttons at each end.

| Property | Value | Token |
|----------|-------|-------|
| Total width | 315px | — |
| Height | 48px | — |
| Track (inactive) | `#EEEEEE` or `#D5D5D5` | `--rmg-color-grey-3` / `--rmg-color-grey-2` |
| Track fill (progress) | `#E63338` | `--rmg-color-bright-red` |
| Track thumb / handle | `#404044` | `--rmg-color-dark-grey` |
| Background | `#F5F5F5` | `--rmg-color-grey-4` |
| Left/Right buttons | Small Chevron (48×48px) | See §2.1 |

- The slider spans between the two Small chevron buttons.
- Three `Property 1` variants: `Right` (progress from left), `Both` (mid-progress), `Left` (progress from right) — these represent the active-chevron direction, not slider position. Use standard HTML `<input type="range">` semantics.

### 2.4 Behaviour notes

- Chevron buttons are standalone interactive elements — they are not decorative.
- Disabled state reduces icon opacity/colour but the button container does not shrink or shift.
- Hover applies a full background fill (Warm Red), making the icon white. This is a significant visual change — ensure the transition is smooth (`150ms ease`).
- The Slider variant's chevrons trigger incremental movement of the slider value, not carousel pagination. They use the same Chevron Button component at Small size.

---

## 3. Stepper

**Description:** Horizontal stepper component showing progress through a multi-step flow. Two layout formats — Desktop (compact horizontal row, full viewport width) and Tablet + Mobile (stacked vertical list, full browser width).

### 3.1 Variants

| Variant | Width | Row height | Orientation |
|---------|-------|------------|-------------|
| Desktop | 1440px (full width) | 60px | Horizontal — all steps in one row |
| Tablet + Mobile | 375px (full width) | 84px | Vertical — one step per row |

### 3.2 Step anatomy

Each step has three possible states: **future** (not yet reached), **current** (active step), **complete** (step done).

#### Step indicator (circle / badge)

| State | Fill | Icon / text | Token refs |
|-------|------|-------------|------------|
| Future | `#D5D5D5` | Step number, `#FFFFFF` | `--rmg-color-grey-2`, `--rmg-color-white` |
| Current | `#2A2A2D` | Step number, `#FFFFFF` | `--rmg-color-black`, `--rmg-color-white` |
| Complete | `#008A00` | ✓ checkmark, `#FFFFFF` | `--rmg-color-green-contrast`, `--rmg-color-white` |

#### Step label

| State | Text colour | Token |
|-------|-------------|-------|
| Future | `#666666` (light copy) | `--rmg-color-text-light` |
| Current | `#2A2A2D` (heading) | `--rmg-color-text-heading` |
| Complete | `#2A2A2D` (heading) | `--rmg-color-text-heading` |

#### Connector line (between step indicators)

| State | Colour | Token |
|-------|--------|-------|
| Future connector | `#D5D5D5` | `--rmg-color-grey-2` |
| Completed connector | `#008A00` | `--rmg-color-green-contrast` |

### 3.3 Typography per variant

#### Desktop (Caption 1 / Reg)

| Element | Style | Size | Line height | Token |
|---------|-------|------|-------------|-------|
| Step number in circle | Caption 1 / Reg | 14px | 20px | `--rmg-text-c1` / `--rmg-leading-c1` |
| Step label | Caption 1 / Reg | 14px | 20px | `--rmg-text-c1` / `--rmg-leading-c1` |
| Page / flow title ("Send your item") | Heading colour | — | — | `--rmg-color-text-heading` |

#### Tablet + Mobile

| Element | Style | Size | Line height | Weight | Token |
|---------|-------|------|-------------|--------|-------|
| Step name (primary label) | Body 3 / Bold | 16px | 22px | 700 | `--rmg-text-b3` / `--rmg-leading-b3` |
| Step number badge (`1 of 5`) | Caption 2 / Bold | 12px | 16px | 700 | `--rmg-text-c2` / `--rmg-leading-c2` |
| "Next: …" sub-label | Caption 1 / Reg | 14px | 20px | 400 | `--rmg-text-c1` / `--rmg-leading-c1` |
| Light copy colour | — | — | — | — | `--rmg-color-text-light` (`#666666`) |

### 3.4 Dimensions

#### Desktop stepper row (60px height)

| Property | Value | Notes |
|----------|-------|-------|
| Row height | 60px | Entire stepper bar |
| Step circle diameter | ~24px | Estimated from row height and padding |
| Connector line height | 1–2px | Horizontal line between circles |
| Step label position | Below / inline with circle | Right-aligned after each circle |

#### Tablet + Mobile stepper row (84px height)

| Property | Value | Notes |
|----------|-------|-------|
| Row height | 84px | Each step row |
| Row width | 375px | Stretches to browser width |
| Step circle diameter | ~40px | Circular progress indicator with partial fill |
| Step name top padding | ~16px | `--rmg-spacing-04` |

The mobile step circle is a **radial progress ring** (not a solid filled circle). The ring stroke fills clockwise as the step progresses — visible as a partial green arc on the in-progress step.

### 3.5 Step states across a 5-step flow

The spec shows five rows (Property 1=1 through Property 1=5), each advancing the active step:

| Row | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |
|-----|--------|--------|--------|--------|--------|
| 1 | **Current** | Future | Future | Future | Future |
| 2 | Complete | **Current** | Future | Future | Future |
| 3 | Complete | Complete | **Current** | Future | Future |
| 4 | Complete | Complete | Complete | **Current** | Future |
| 5 | Complete | Complete | Complete | Complete | **Current** |

The spec example uses a 5-step flow: "Select options → Provide details → Send item → Payment → Confirmation". Any number of steps is supported.

### 3.6 Behaviour notes

- Desktop stepper is full-width at all desktop viewport sizes; steps are evenly distributed.
- Tablet + Mobile stepper renders each step as a full-width row and scrolls vertically with page content — it is not fixed/sticky.
- The cart icon (basket) appears at the far right of the Desktop stepper row — this is application-specific and not part of the core Stepper component token set.
- Completed connectors animate in when a step transitions from Current → Complete; no easing values are specified. Recommend `transition: stroke 300ms ease` on the SVG connector or `width 300ms ease` on a CSS border.
- The mobile progress ring requires SVG `stroke-dashoffset` animation or a CSS conic-gradient approach.
- Focus management: when a step completes and the next activates, focus should move to the new Current step indicator.

---

## Token cross-reference

| Token | Hex | Used in |
|-------|-----|---------|
| `--rmg-color-red` | `#DA202A` | Tabs active bg |
| `--rmg-color-warm-red` | `#B70D12` | Tabs hover text; Chevron hover bg |
| `--rmg-color-bright-red` | `#E63338` | Chevron active icon; Carousel active dot; Slider fill |
| `--rmg-color-white` | `#FFFFFF` | Tabs active text; Chevron hover icon; Stepper circle text |
| `--rmg-color-grey-2` | `#D5D5D5` | Chevron disabled icon; Carousel inactive dots; Stepper future connector + circle |
| `--rmg-color-grey-3` | `#EEEEEE` | Tabs inactive/hover bg |
| `--rmg-color-grey-4` | `#F5F5F5` | Chevron active/disabled bg; Slider bg |
| `--rmg-color-dark-grey` | `#404044` | Slider thumb |
| `--rmg-color-black` | `#2A2A2D` | Stepper current circle |
| `--rmg-color-green-contrast` | `#008A00` | Stepper complete circle + connector |
| `--rmg-color-text-body` | `#333333` | Tabs inactive text |
| `--rmg-color-text-light` | `#666666` | Stepper future label; Stepper "Next:" sub-label |
| `--rmg-color-text-heading` | `#2A2A2D` | Stepper current + complete label |
| `--rmg-text-b2` / `--rmg-leading-b2` | 18px / 24px | Tabs Desktop+Tablet label |
| `--rmg-text-b3` / `--rmg-leading-b3` | 16px / 22px | Tabs Mobile label; Stepper mobile step name |
| `--rmg-text-c1` / `--rmg-leading-c1` | 14px / **20px** | Stepper Desktop label; Stepper mobile "Next:" |
| `--rmg-text-c2` / `--rmg-leading-c2` | 12px / 16px | Stepper mobile badge ("1 of 5") |
