# Plato Suite — Design System (RMG Theme)

> **Version 4 · April 2026**  
> Read this entire file before writing any styles, components, or layout code.  
> Every colour, badge, notification, and layout decision references this document.  
> When in doubt: look it up here, don't invent.

---

## 0. Non-Negotiable Rules

These are hard stops. Violating any of these creates work to undo.

**FONT:** `--rmg-font-display` fallback is system sans-serif, NEVER Georgia/serif. Using serif makes the UI look like a law document — it is visually nothing like the brand.
```css
--rmg-font-display: "RM First Class", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
--rmg-font-body:    "PF DinText Std", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
```

**NOTIFICATIONS:** Use full-colour background fills (RMG Figma standard). Left-border-only callouts are for tool-specific annotations (Flag/Test/Note) only — not for user-facing system alerts. See Section 5.

**SUPPLIERS:** Always query the DB — never hardcode supplier colours. Use `buildSupplierMap()` + `getSupplierColour()` from `@plato/ui/tokens`. Current suppliers: CG, TCS, RMG, HT, NH, EPAM, TAAS, LT, HCL.

**BADGE DISCIPLINE:** Max 2 badge types per card. Function (Factory/Service/Migration), location (Onshore/Offshore), and stream are inline text — not pills or badges. One card = supplier pill + priority badge at most.

**GREEN = COMPLETE/HEALTHY ONLY.** Never use green as a decorative accent, link colour, or step indicator.

**YELLOW (#FDDA24) on red backgrounds only.** It is the brand accent for the red brand moment. Never use it as a UI background, border, or standalone colour.

**TOOL BUTTONS:** `border-radius: var(--rmg-radius-m)` (12px). Never the consumer pill shape (`radius-xl` / 100px). Pill buttons are a royalmail.com consumer pattern.

**STATUS AS TEXT:** Open/Closed/Scheduled/TBC = styled inline text, not a pill or badge. See Section 3C.

**PAGE BACKGROUNDS:** All pages use `background-color: var(--rmg-color-surface-light)` (#F1F2F5) with the PLATO SVG watermark. Never plain white as a page background.

**ALL COLOURS FROM FIGMA:** Every colour must trace back to a named `--rmg-*` CSS variable. No invented hex values. The only exceptions are supplier brand colours and Tessera track colours (documented below).

---

## 1. Colour Palette — Full Figma Token Set

All CSS variables are defined in `packages/ui/styles/rmg.css` and available in every app that imports from `@plato/ui`.

### Core Brand
| Token | Hex | Notes |
|-------|-----|-------|
| `--rmg-color-red` | `#DA202A` | Primary brand red. HIGH risk. |
| `--rmg-color-yellow` | `#FDDA24` | On red bg only. Brand accent. |
| `--rmg-color-white` | `#FFFFFF` | |

### Primary Accents
| Token | Hex | Notes |
|-------|-----|-------|
| `--rmg-color-warm-red` | `#B70D12` | Cancelled state. |
| `--rmg-color-bright-red` | `#E63338` | ChevronButton icon colour. |
| `--rmg-color-pink` | `#F4AEBA` | Service stream colour. |
| `--rmg-color-orange` | `#F3920D` | MEDIUM risk. Build stream. |

### Greys
| Token | Hex | Notes |
|-------|-----|-------|
| `--rmg-color-black` | `#2A2A2D` | text-heading |
| `--rmg-color-dark-grey` | `#404044` | SCOPED risk. Dark bg. |
| `--rmg-color-grey-1` | `#8F9495` | Placeholder text. SCHEDULED. |
| `--rmg-color-grey-2` | `#D5D5D5` | Borders. Dividers. |
| `--rmg-color-grey-3` | `#EEEEEE` | Subtle dividers. |
| `--rmg-color-grey-4` | `#F5F5F5` | Table headers. Hover bg. |
| `--rmg-color-brand-black` | `#2A2A2A` | Avatars. Dark badges. |

### Functional
| Token | Hex | Notes |
|-------|-----|-------|
| `--rmg-color-blue` | `#0892CB` | Info notifications. Note callouts. Track B. |
| `--rmg-color-green` | `#62A531` | Complete state only. Never decorative. |
| `--rmg-color-green-contrast` | `#008A00` | LOW risk. Eco notification. Accessible green. |

### Tints (backgrounds for inline notifications and states)
| Token | Hex |
|-------|-----|
| `--rmg-color-tint-red` | `#F8E7E7` |
| `--rmg-color-tint-orange` | `#FFBD80` |
| `--rmg-color-tint-yellow` | `#FEEB87` |
| `--rmg-color-tint-pink` | `#F9CFD6` |
| `--rmg-color-tint-green` | `#C1E3C1` |

### Surfaces
| Token | Hex | Use |
|-------|-----|-----|
| `--rmg-color-surface-white` | `#FFFFFF` | Cards, panels, inputs |
| `--rmg-color-surface-light` | `#F1F2F5` | Page background |

### Semantic Text
| Token | Hex |
|-------|-----|
| `--rmg-color-text-heading` | `#2A2A2D` |
| `--rmg-color-text-body` | `#333333` |
| `--rmg-color-text-light` | `#666666` |
| `--rmg-color-text-accent` | `#DA202A` |

---

## 2. Semantic Constants (import from `@plato/ui/tokens`)

```ts
import {
  RISK_COLOURS, RISK_TINTS,
  TRACK_COLOURS, STREAM_COLOURS,
  STATUS_COLOURS, PHASE_COLOURS,
  getSupplierColour, buildSupplierMap,
} from '@plato/ui/tokens'
```

### Risk / Priority — all map to Figma tokens, nothing invented
```ts
RISK_COLOURS = {
  HIGH:   '#DA202A',  // --rmg-color-red
  MEDIUM: '#F3920D',  // --rmg-color-orange
  LOW:    '#008A00',  // --rmg-color-green-contrast
  SCOPED: '#404044',  // --rmg-color-dark-grey
}

RISK_TINTS = {
  HIGH:   '#F8E7E7',  // --rmg-color-tint-red
  MEDIUM: '#FFBD80',  // --rmg-color-tint-orange
  LOW:    '#C1E3C1',  // --rmg-color-tint-green
  SCOPED: '#EEEEEE',  // --rmg-color-grey-3
}
```

### Track colours (Tessera — intentional exceptions, not consumer Figma tokens)
```ts
TRACK_COLOURS = {
  A: '#DA202A',  // CG Extraction  — = --rmg-color-red
  B: '#0892CB',  // TCS Onboarding — = --rmg-color-blue
}
```

### Session / item status
```ts
STATUS_COLOURS = {
  SCHEDULED:   '#8F9495',  // --rmg-color-grey-1
  COMPLETED:   '#62A531',  // --rmg-color-green
  CANCELLED:   '#B70D12',  // --rmg-color-warm-red
  IN_PROGRESS: '#0892CB',  // --rmg-color-blue
}
```

### Itinerary stream colours
```ts
STREAM_COLOURS = {
  BUILD:   '#F3920D',  // --rmg-color-orange  (Matt + Jonny)
  SERVICE: '#F4AEBA',  // --rmg-color-pink     (Clare + Mandy)
}
```

### Gantt phase header colours
```ts
PHASE_COLOURS = {
  CG_PRIME:      '#003C82',
  TCS_PRIME:     '#9B0A6E',
  TCS_HYPERCARE: '#5B2D9A',
}
```

### Supplier utilities
```ts
// Always load from DB first:
// SELECT supplier_abbreviation, supplier_colour FROM suppliers ORDER BY sort_order

// Build map from DB result:
const supplierMap = buildSupplierMap(rows)

// Use in components:
const colour = getSupplierColour('TCS', supplierMap)
// Falls back to SUPPLIER_COLOUR_FALLBACKS if map not yet loaded
```

### Supplier colours (DB is source of truth — these are fallbacks only)
| Abbrev | Hex |
|--------|-----|
| CG | `#003C82` |
| TCS | `#9B0A6E` |
| RMG | `#E2001A` |
| HT | `#FF8C00` |
| NH | `#1A2B5B` |
| EPAM | `#3D3D3D` |
| TAAS | `#7C3AED` |
| LT | `#3ABFB8` |
| HCL | `#1976F2` |

---

## 3. Badge & Pill System

### 3A — Supplier pills
Shape: pill (`border-radius: var(--rmg-radius-xl)`)  
Style: coloured border + tint background + coloured text  
Use: supplier identification only — one per card maximum

```tsx
// Supplier pill pattern
<span style={{
  display: 'inline-flex', alignItems: 'center',
  borderRadius: 'var(--rmg-radius-xl)',
  padding: '3px 12px',
  border: `1.5px solid ${supplierColour}`,
  background: `${supplierColour}18`,  // 10% opacity
  color: supplierColour,
  fontSize: '12px', fontWeight: 600,
  whiteSpace: 'nowrap',
}}>
  {abbreviation}
</span>
```

### 3B — Priority / Risk badges
Shape: rectangular (`border-radius: var(--rmg-radius-xs)` = 4px)  
Style: solid fill, white text, bold uppercase, small letter-spacing  
Use: domain cards and dashboard only — never on person rows

```tsx
// Risk badge pattern
<span style={{
  display: 'inline-flex', alignItems: 'center',
  borderRadius: 'var(--rmg-radius-xs)',
  padding: '2px 8px',
  background: RISK_COLOURS[level],
  color: 'white',
  fontSize: '11px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em',
}}>
  {level}
</span>
```

### 3C — Status as inline text (NOT pills)
Open/Closed/Scheduled = styled text directly on the row. No pill, no border, no background.

```tsx
// Status text pattern — learned from Find Royal Mail Locations app
<span style={{ color: 'var(--rmg-color-green-contrast)', fontWeight: 600, fontSize: '12px' }}>
  Open · 24/7
</span>

// Session status uses a solid-fill badge (small, contained context)
<span style={{
  borderRadius: 'var(--rmg-radius-xl)', padding: '2px 8px',
  background: STATUS_COLOURS.SCHEDULED,
  color: 'white', fontSize: '11px', fontWeight: 600,
}}>
  Scheduled
</span>
```

### 3D — Filter pills (pill-bar pattern)
Shape: pill. Toggle between outline (off) and filled-red-tint (on).

```tsx
// Off state
{ border: '1.5px solid var(--rmg-color-grey-2)', background: 'white', color: 'var(--rmg-color-text-body)' }
// On state
{ border: '1.5px solid var(--rmg-color-red)', background: 'var(--rmg-color-tint-red)', color: 'var(--rmg-color-red)', fontWeight: 600 }
```

Supplier filter pills when active: use supplier colour as solid fill with white text.

### 3E — Tag pills (Nuggets page only)
Same shape as filter pills. Show count badge inside when relevant.

### 3F — What is NEVER a pill
- Function (Factory / Service / Migration / Shared)
- Location (Onshore / Nearshore / Offshore)
- Stream (Build / Service)
- Years experience
- Country
- Open/Closed status

These are rendered as plain text, often as `metadata · separated · by · dots`.

---

## 4. Buttons

All tool buttons use `border-radius: var(--rmg-radius-m)` (12px). The consumer pill shape (`radius-xl`) is a royalmail.com pattern and does not belong in internal tooling.

```tsx
// Primary button
{
  background: 'var(--rmg-color-red)', color: 'white',
  border: '2px solid var(--rmg-color-red)',
  borderRadius: 'var(--rmg-radius-m)',
  padding: '10px 20px', fontSize: '14px', fontWeight: 600,
  fontFamily: 'var(--rmg-font-body)',
}

// Outline (secondary) button
{
  background: 'transparent', color: 'var(--rmg-color-red)',
  border: '2px solid var(--rmg-color-red)',
  borderRadius: 'var(--rmg-radius-m)',
}

// Ghost (tertiary) button
{
  background: 'transparent', color: 'var(--rmg-color-text-body)',
  border: '2px solid var(--rmg-color-grey-2)',
  borderRadius: 'var(--rmg-radius-m)',
}

// Small variant: padding '6px 14px', fontSize: '12px'
```

---

## 5. Notifications — Full Colour Fills (RMG Figma Standard)

**These are the RMG standard notifications as defined in Figma.** Full background fill, not left-border-only. The callout patterns in Section 6 are for tool-specific annotation — not for user-facing alerts.

### Colour map
| Variant | Background token | Text colour |
|---------|-----------------|-------------|
| Warning | `--rmg-color-yellow` #FDDA24 | `--rmg-color-text-heading` (dark) |
| Information | `--rmg-color-blue` #0892CB | white |
| Error | `--rmg-color-tint-pink` #F9CFD6 | `--rmg-color-text-heading` (dark) |
| Success | `--rmg-color-tint-green` #C1E3C1 | `--rmg-color-text-heading` (dark) |
| Eco / dark | `--rmg-color-green-contrast` #008A00 | white |

### Banner (full-width, dismissible)
```tsx
<div style={{
  width: '100%',
  background: 'var(--rmg-color-yellow)',  // or blue/tint-pink/tint-green/green-contrast
  padding: '14px 20px',
  display: 'flex', gap: '14px',
  justifyContent: 'space-between', alignItems: 'flex-start',
}}>
  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
    {/* icon */}
    <div>
      <div style={{ fontWeight: 700, fontSize: '14px' }}>Title</div>
      <div style={{ fontSize: '14px', lineHeight: 1.5 }}>Message body.</div>
    </div>
  </div>
  <button>✕</button>  {/* dismiss */}
</div>
```

### Inline card notification
```tsx
<div style={{
  borderRadius: '0 var(--rmg-radius-s) var(--rmg-radius-s) var(--rmg-radius-s)',
  padding: '18px 20px',
  background: 'var(--rmg-color-tint-green)',
  display: 'flex', gap: '14px', alignItems: 'flex-start',
  maxWidth: '560px',
}}>
  {/* icon + title + body */}
</div>
```

---

## 6. Tool Callouts (Domain Detail Page — Not User-Facing)

Left-border callouts are only used for analyst-facing annotations on the Domain Detail page. Do not use them as substitutes for notifications elsewhere.

| Type | Background | Left border | Icon |
|------|-----------|-------------|------|
| Test | `--rmg-color-tint-yellow` | `--rmg-color-orange` | 🧪 |
| Flag | `--rmg-color-tint-red` | `--rmg-color-red` | 🚩 |
| Note | `#EBF5FB` (light blue) | `--rmg-color-blue` | 📝 |
| CG Caveat | `#002E6614` | `#003C82` | ⚠️ |

Pattern: `border-radius: 0 var(--rmg-radius-s) var(--rmg-radius-s) var(--rmg-radius-s)` — no top-left radius (tab style).  
Title: 11px, bold, uppercase, coloured to match border.  
Body: 14px, `--rmg-color-text-body`.

---

## 7. Page Layout & Background

Every Plato app page uses this wrapper pattern:

```tsx
// Page wrapper — surface-light bg + PLATO watermark
<div style={{
  backgroundColor: 'var(--rmg-color-surface-light)',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='80'%3E%3Ctext x='10' y='50' font-family='Arial' font-size='13' font-weight='700' fill='%232A2A2D' opacity='0.04' transform='rotate(-12 100 40)' letter-spacing='3'%3EPLATO%3C/text%3E%3C/svg%3E")`,
  backgroundRepeat: 'repeat',
  minHeight: '100vh',
}}>
```

Cards and panels sit on `--rmg-color-surface-white` (#FFFFFF).  
Card shadow: `box-shadow: 0 4px 56px rgba(0,0,0,0.08)` (`--rmg-shadow-card`)  
Card radius: `var(--rmg-radius-m)` (12px)

### Page header pattern
```tsx
<div>
  {/* Eyebrow — state indicator */}
  <div style={{
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: 'var(--rmg-color-grey-1)',
    display: 'flex', alignItems: 'center', gap: '8px',
    marginBottom: '24px',
  }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rmg-color-green-contrast)', display: 'inline-block' }} />
    Pre-departure state (current)
  </div>
  
  {/* Title + action row */}
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
    <div>
      <h1 style={{
        fontFamily: 'var(--rmg-font-display)',
        fontSize: '2rem', fontWeight: 700,
        color: 'var(--rmg-color-text-heading)',
        letterSpacing: '-0.03em', lineHeight: 1.1,
      }}>KT Programme Dashboard</h1>
      <p style={{ fontSize: '14px', color: 'var(--rmg-color-text-light)', marginTop: '6px' }}>
        eBusiness Platform · CG → TCS transition · 1 Apr → 3 Jul 2026
      </p>
    </div>
    {/* Countdown chip — see Section 8 */}
  </div>
</div>
```

---

## 8. Countdown States

### Pre-departure (before India trip)
```tsx
<div style={{
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  background: 'var(--rmg-color-red)',
  borderRadius: 'var(--rmg-radius-m)',
  padding: '8px 20px',
  fontSize: '12px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  color: 'var(--rmg-color-yellow)',
}}>
  3 days to India
</div>
```

### In-India (from Sunday 26 April)
```tsx
<div style={{
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  background: 'var(--rmg-color-tint-yellow)',
  border: '1.5px solid var(--rmg-color-yellow)',
  borderRadius: 'var(--rmg-radius-m)',
  padding: '8px 20px',
  fontSize: '12px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  color: 'var(--rmg-color-text-heading)',
}}>
  Day 2 — Noida
</div>
```

---

## 9. Domain Cards (Dashboard Grid)

```tsx
<div style={{
  background: 'white',
  borderRadius: 'var(--rmg-radius-s)',
  padding: '16px',
  borderLeft: `4px solid ${RISK_COLOURS[domain.risk_level]}`,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  cursor: 'pointer',
}}>
  {/* Domain name */}
  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--rmg-color-text-heading)', marginBottom: '8px' }}>
    {domain.domain_name}
  </div>
  
  {/* Risk badge + readiness fraction */}
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
    {/* Risk badge — see Section 3B */}
    <span style={{ fontSize: '11px', color: 'var(--rmg-color-grey-1)' }}>
      {completedDimensions}/6
    </span>
  </div>
  
  {/* Progress bar */}
  <div style={{ height: '4px', background: 'var(--rmg-color-grey-3)', borderRadius: '100px', overflow: 'hidden' }}>
    <div style={{
      height: '100%', borderRadius: '100px',
      width: `${(completedDimensions / 6) * 100}%`,
      background: RISK_COLOURS[domain.risk_level],
    }} />
  </div>
</div>
```

Readiness language: "Not started / In progress / Complete" — NOT traffic lights. Progress bar shows dimensions assessed out of 6.

---

## 10. Stat Cards (Dashboard)

```tsx
// Standard stat card
<div style={{
  background: 'white', borderRadius: 'var(--rmg-radius-m)',
  padding: '20px 24px', position: 'relative',
  boxShadow: '0 4px 56px rgba(0,0,0,0.08)',
}}>
  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--rmg-color-grey-1)', marginBottom: '8px' }}>
    Sessions
  </div>
  <div style={{ fontFamily: 'var(--rmg-font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--rmg-color-text-heading)', lineHeight: 1, letterSpacing: '-0.02em' }}>
    0 <span style={{ fontSize: '1rem', color: 'var(--rmg-color-grey-1)', fontFamily: 'var(--rmg-font-body)' }}>/125</span>
  </div>
  <div style={{ fontSize: '12px', color: 'var(--rmg-color-grey-1)', marginTop: '4px' }}>completed</div>
  {/* Bottom colour accent bar */}
  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'var(--rmg-color-grey-3)' }} />
</div>

// Brand moment card (departure countdown)
<div style={{
  background: 'var(--rmg-color-red)', borderRadius: 'var(--rmg-radius-m)',
  padding: '20px 24px', boxShadow: '0 4px 56px rgba(0,0,0,0.08)',
}}>
  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(253,218,36,0.75)', marginBottom: '8px' }}>
    Departure
  </div>
  <div style={{ fontFamily: 'var(--rmg-font-display)', fontSize: '2rem', fontWeight: 700, color: 'var(--rmg-color-yellow)', lineHeight: 1, letterSpacing: '-0.02em' }}>
    3 days
  </div>
  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>Sunday 26 April · Heathrow</div>
</div>
```

---

## 11. Filter Bar (Pill-Bar Pattern)

Used on Sessions, People, App Groups, Nuggets.

```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: '16px',
  padding: '10px 20px', background: 'white',
  border: '1px solid var(--rmg-color-grey-3)',
  borderRadius: 'var(--rmg-radius-m)', flexWrap: 'wrap',
}}>
  <input
    type="text" placeholder="Search sessions…"
    style={{
      flex: 1, minWidth: '160px', border: 'none', outline: 'none',
      fontFamily: 'var(--rmg-font-body)', fontSize: '14px',
      color: 'var(--rmg-color-text-body)', background: 'transparent',
    }}
  />
  {/* Divider */}
  <div style={{ width: '1px', height: '18px', background: 'var(--rmg-color-grey-2)', flexShrink: 0 }} />
  {/* Filter group */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--rmg-color-grey-1)' }}>Team</span>
    {/* Filter pills — see Section 3D */}
  </div>
</div>
```

---

## 12. People Page

### Table layout (60/40 split: list + detail panel)
```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>
  {/* Left: scrollable person list */}
  {/* Right: sticky detail panel */}
</div>
```

### Person row
Max 2 badge types. Supplier avatar + supplier pill. Everything else is text.

```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: '1fr 150px 80px 50px 36px',
  gap: '12px', alignItems: 'center',
  padding: '10px 20px',
  borderBottom: '1px solid var(--rmg-color-grey-3)',
  cursor: 'pointer',
}}>
  {/* Name + function/location as inline text */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    {/* Avatar: supplier-coloured circle */}
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%',
      background: supplierColour, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--rmg-color-text-heading)' }}>{name}</div>
      {/* Function + location = PLAIN TEXT, not pills */}
      <div style={{ fontSize: '11px', color: 'var(--rmg-color-grey-1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {function} · {location}
      </div>
    </div>
  </div>
  <div style={{ fontSize: '12px', color: 'var(--rmg-color-text-light)' }}>{role}</div>
  {/* Supplier pill — Section 3A */}
  <div style={{ fontSize: '12px', fontWeight: 600 }}>{yearsExp}y</div>
  <div style={{ fontSize: '12px', fontWeight: 700, textAlign: 'right' }}>{ktSessionCount}</div>
</div>
```

### Detail panel
```tsx
<div style={{ background: 'white', borderRadius: 'var(--rmg-radius-m)', boxShadow: 'var(--rmg-shadow-card)', overflow: 'hidden', position: 'sticky', top: '16px' }}>
  {/* Header */}
  <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rmg-color-grey-3)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      {/* Large avatar (44×44) */}
      <div>
        <div style={{ fontFamily: 'var(--rmg-font-display)', fontSize: '1.25rem', fontWeight: 700 }}>{name}</div>
        {/* Inline metadata — dots-separated, NOT pills */}
        <div style={{ fontSize: '12px', color: 'var(--rmg-color-text-light)', display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
          <span>{role}</span><span>·</span><span>{yearsExp} yrs exp</span><span>·</span><span>{location}</span>
        </div>
      </div>
    </div>
    {/* Supplier pill + stream as text */}
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {/* Supplier pill */}
      <span style={{ fontSize: '12px', color: 'var(--rmg-color-text-light)' }}>{stream} stream</span>
    </div>
  </div>
  {/* Body: KT Sessions list, Tech Stack as plain text */}
</div>
```

---

## 13. Domain Detail Page (Track A / Track B)

Two-column layout. Track A = CG Extraction (left), Track B = TCS Onboarding (right).

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
  {/* Track A panel */}
  <div style={{ borderTop: `3px solid ${TRACK_COLOURS.A}`, paddingTop: '16px' }}>
    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: TRACK_COLOURS.A, marginBottom: '16px' }}>
      Track A — CG Extraction
    </div>
    {/* Content rows */}
  </div>
  {/* Track B panel */}
  <div style={{ borderTop: `3px solid ${TRACK_COLOURS.B}`, paddingTop: '16px' }}>
    <div style={{ /* ... */ color: TRACK_COLOURS.B }}>
      Track B — TCS Onboarding
    </div>
  </div>
</div>
```

### SME chip (DomainTrackPanel) — known bug fix
SME chips must use supplier colour from the loaded supplier map, not a hardcoded colour.

```tsx
// WRONG — renders purple for all
<span style={{ background: '#7C3AED' }}>Vipul S</span>

// CORRECT — use loaded supplier map
const colour = getSupplierColour(sme.supplier_abbreviation, supplierMap)
<span style={{
  display: 'inline-flex', alignItems: 'center',
  borderRadius: 'var(--rmg-radius-xl)',
  padding: '2px 10px', fontSize: '11px', fontWeight: 600,
  border: `1.5px solid ${colour}`,
  background: `${colour}18`,
  color: colour,
}}>
  {sme.name_short}
</span>
```

---

## 14. Sessions Page

### Session row in accordion
```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: '16px',
  padding: '14px 20px',
  borderBottom: '1px solid var(--rmg-color-grey-3)',
  cursor: 'pointer',
}}>
  {/* Track colour indicator bar */}
  <div style={{ width: '3px', alignSelf: 'stretch', borderRadius: '100px', background: TRACK_COLOURS[session.track], flexShrink: 0 }} />
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--rmg-color-text-heading)' }}>{session.title}</div>
    <div style={{ fontSize: '12px', color: 'var(--rmg-color-text-light)', marginTop: '2px' }}>{appGroup} · {hours} hrs</div>
  </div>
  {/* Lead name as plain text */}
  <div style={{ fontSize: '12px', color: 'var(--rmg-color-grey-1)' }}>{lead}</div>
  {/* Duration */}
  <div style={{ fontSize: '12px', fontWeight: 600 }}>{hours}h</div>
  {/* Status badge — Section 3C */}
</div>
```

### App Group accordion header
```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: '14px',
  padding: '14px 20px', cursor: 'pointer',
  borderLeft: `4px solid ${supplierColour}`,
}}>
  {/* Group ID */}
  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--rmg-color-grey-1)', background: 'var(--rmg-color-grey-4)', borderRadius: 'var(--rmg-radius-xs)', padding: '2px 7px' }}>
    G0
  </div>
  <div style={{ flex: 1 }}>
    <div style={{ fontWeight: 700, fontSize: '14px' }}>{groupName}</div>
    <div style={{ fontSize: '12px', color: 'var(--rmg-color-text-light)' }}>{subtitle}</div>
  </div>
  {/* Summary stats — plain text, right-aligned */}
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontWeight: 700 }}>{completed}/{total} sessions</div>
    <div style={{ fontSize: '12px', color: 'var(--rmg-color-text-light)' }}>{hours} hrs</div>
  </div>
</div>
```

---

## 15. Nuggets Page

### Tag filter bar
```tsx
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '14px 18px', background: 'white', border: '1px solid var(--rmg-color-grey-3)', borderRadius: 'var(--rmg-radius-m)', alignItems: 'center' }}>
  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--rmg-color-grey-1)', marginRight: '4px' }}>Filter</span>
  {/* Tag pills — Section 3E */}
</div>
```

### Nugget card
```tsx
<div style={{ background: 'white', borderRadius: 'var(--rmg-radius-m)', boxShadow: 'var(--rmg-shadow-card)', padding: '24px', marginBottom: '16px', display: 'flex', gap: '18px' }}>
  {/* Number badge */}
  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--rmg-color-brand-black)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
    {n}
  </div>
  <div>
    <div style={{ fontFamily: 'var(--rmg-font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '6px' }}>{title}</div>
    <div style={{ fontSize: '14px', color: 'var(--rmg-color-text-body)', lineHeight: 1.6, marginBottom: '14px' }}>{body}</div>
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {/* Tag pills */}
    </div>
  </div>
</div>
```

---

## 16. Parker's 7 Page

### Question card
```tsx
<div style={{ background: 'white', borderRadius: 'var(--rmg-radius-m)', boxShadow: 'var(--rmg-shadow-card)', padding: '24px', marginBottom: '16px', display: 'flex', gap: '20px' }}>
  {/* Q number */}
  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--rmg-color-brand-black)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--rmg-font-display)', fontSize: '1.1rem', fontWeight: 700, flexShrink: 0 }}>
    {n}
  </div>
  <div>
    <div style={{ fontFamily: 'var(--rmg-font-display)', fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '12px' }}>{question}</div>
    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--rmg-color-grey-1)', marginBottom: '10px' }}>Addressed by</div>
    {/* Domain chips — coloured by risk level using tint bg + coloured left border */}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        borderRadius: 'var(--rmg-radius-xs)', padding: '4px 10px',
        fontSize: '12px', fontWeight: 500,
        background: RISK_TINTS[domain.risk_level],
        borderLeft: `3px solid ${RISK_COLOURS[domain.risk_level]}`,
        color: 'var(--rmg-color-text-body)',
      }}>
        {domain.domain_name}
      </span>
    </div>
  </div>
</div>
```

---

## 17. Gantt / Roadmap Styles

### Phase header row
Full-width coloured background, white text, uppercase, bold.
```tsx
// Three-column grid matching timeline proportions
<div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr' }}>
  <div /> {/* resource name column */}
  <div style={{ background: PHASE_COLOURS.CG_PRIME, color: 'white', padding: '6px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
    Q1 — CG Prime / TCS Shadow
  </div>
  {/* Q2, Q3 */}
</div>
```

### Domain group row
```tsx
<div style={{
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '7px 12px', background: 'var(--rmg-color-grey-4)',
  borderBottom: '1px solid var(--rmg-color-grey-2)',
}}>
  <span style={{ cursor: 'pointer' }}>▼</span>
  <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>{domainName}</span>
  {/* Risk badge — Section 3B */}
</div>
```

### Resource row
```tsx
<div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--rmg-color-grey-3)' }}>
  {/* Name column */}
  <div style={{ width: '180px', flexShrink: 0, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', borderRight: '1px solid var(--rmg-color-grey-3)' }}>
    {/* Supplier pill (small) */}
    <span style={{ fontSize: '12px' }}>{name}</span>
  </div>
  {/* Timeline column */}
  <div style={{ flex: 1, height: '24px', position: 'relative', margin: '0 8px' }}>
    <div style={{
      position: 'absolute', height: '18px', top: '3px',
      borderRadius: '3px', padding: '0 6px',
      background: supplierColour,
      fontSize: '11px', fontWeight: 600, color: 'white',
      left: `${startPercent}%`, width: `${durationPercent}%`,
    }}>
      {name}
    </div>
  </div>
</div>
```

### TBC row
Same as resource row but bar has `border: 2px dashed ${supplierColour}`, `background: transparent`, `color: supplierColour`, name in italic.

### Switch marker (supplier handover point)
```tsx
<div style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', background: 'var(--rmg-color-red)', left: `${switchPercent}%` }}>
  <div style={{ position: 'absolute', top: '-18px', transform: 'translateX(-50%)', fontSize: '10px', fontWeight: 700, color: 'var(--rmg-color-red)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
    Switch
  </div>
</div>
```

---

## 18. Itinerary Page

Session entry: show as a timeline card. Use `STREAM_COLOURS` for left border.

```tsx
<div style={{
  background: 'white', borderRadius: 'var(--rmg-radius-m)',
  borderLeft: `4px solid ${STREAM_COLOURS[session.stream]}`,
  padding: '16px 20px', marginBottom: '10px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
    <div>
      <div style={{ fontWeight: 600, fontSize: '14px' }}>{session.title}</div>
      <div style={{ fontSize: '12px', color: 'var(--rmg-color-text-light)', marginTop: '4px' }}>
        {session.time} · {session.duration}
      </div>
    </div>
    {/* Status badge */}
  </div>
</div>
```

---

## 19. Spacing & Radius Reference

| Token | Value |
|-------|-------|
| `--rmg-spacing-01` | 4px |
| `--rmg-spacing-02` | 8px |
| `--rmg-spacing-03` | 12px |
| `--rmg-spacing-04` | 16px |
| `--rmg-spacing-05` | 20px |
| `--rmg-spacing-06` | 24px |
| `--rmg-spacing-07` | 32px |
| `--rmg-spacing-08` | 40px |
| `--rmg-spacing-09` | 48px |
| `--rmg-spacing-10` | 64px |
| `--rmg-radius-xs` | 4px — risk badges, checkbox |
| `--rmg-radius-s` | 8px — inputs, small cards |
| `--rmg-radius-m` | 12px — cards, tool buttons |
| `--rmg-radius-l` | 24px — large cards |
| `--rmg-radius-xl` | 100px — pills only |

---

## 20. Mobile Strategy

| Page | Strategy | Treatment |
|------|----------|-----------|
| Dashboard | Responsive | Stat grid: 4col→2col→1col. Domain grid: 3→2→1. |
| Domains grid | Responsive | 3col→2col→1col at breakpoints |
| Domain detail | Desktop-priority | Track A/B columns stack on tablet |
| Sessions | Responsive | Filter bar collapses to button. Rows adapt. |
| App Groups | Desktop-priority | Complex accordion. Show message below 640px. |
| People | Responsive | 60/40 split → stacked. Detail panel → bottom sheet. |
| Nuggets | Responsive | Single-column naturally. |
| Parker's 7 | Responsive | Single-column naturally. |
| Itinerary | Responsive | Single-column naturally. |
| Gantt | Desktop-only | Show message below 768px. |

---

## 21. RLS Reminder

Tessera has no auth (ADR-TESS-001). All queries run as `anon`.  
If any Supabase query returns 0 rows silently — check RLS policies **before touching the code**.  
Fix: `CREATE POLICY "Open read" ON kt_table_name FOR SELECT USING (true);`  
Check: `SELECT tablename, policyname FROM pg_policies WHERE tablename = 'kt_sessions';`
