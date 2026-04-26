# Tessera — AI Coding Context

> Read this file in full before writing any code, generating any prompt,
> or making any styling decision for the Tessera app.

---

## What Tessera Is

Tessera is a KT (Knowledge Transfer) Operating System built for the RMG
eBusiness supplier transition (Capgemini → TCS). It is an internal tool,
not a consumer product.

**Visual register:** Dense, operational, data-driven. Think Linear or
Notion — not royalmail.com. Premium and purposeful, not flashy. Every
colour and typographic choice should carry meaning.

---

## Non-Negotiable Design Rules

These apply to every page, every component, every prompt.

1. **Check the design system first.** Before writing any style, check
   whether an `--rmg-*` CSS variable covers it. If one exists, use it.
   Never invent a value that duplicates a token.

2. **Display font on all H1s and section headers.**
   `font-family: var(--rmg-font-display)` — this is "RM First Class".
   Body copy uses `var(--rmg-font-body)`. Mixing these up makes every
   page look generic.

3. **No hardcoded hex values in JSX except via named constants.**
   If a colour doesn't come from `--rmg-*` tokens or the established
   project constants below, it must be defined as a named constant at
   the top of the file with a comment explaining its source.

4. **Colour must carry meaning.** Never use colour decoratively.
   Red = urgent/high risk, Amber = caution, Green = healthy/complete,
   supplier colours = that supplier, track colours = that KT track.

5. **No CSS variables inside rgba() in inline styles.**
   `rgba(var(--rmg-color-red), 0.15)` does NOT work in React inline
   styles. For alpha/tint effects on tokens, either:
   - Use a hardcoded hex with hex alpha suffix (e.g. `#DA202A26`)
   - Use a separate tint token (e.g. `--rmg-color-tint-red`)
   - Use `backgroundColor: 'var(--rmg-color-tint-red)'` directly
   CSS variables work fine as full values — just not inside rgba().

6. **Every page must have a visual anchor.**
   At least one element on every page should use brand colour
   purposefully — a coloured header, a status indicator, a category
   border. A page that is entirely white cards on grey background
   is not acceptable.

7. **Apply the RMG type scale.**
   Page titles: `--rmg-text-h1` / `--rmg-leading-h1`
   Section headers: `--rmg-text-h3` / `--rmg-leading-h3`
   Card titles: `--rmg-text-h5` / `--rmg-leading-h5`
   Body: `--rmg-text-b3` / `--rmg-leading-b3`
   Labels/badges: `--rmg-text-c1` / `--rmg-leading-c1`

8. **Spacing from the RMG scale only.**
   `--rmg-spacing-01` (4px) through `--rmg-spacing-13` (128px).
   Never arbitrary pixel values.

9. **No Tailwind in `packages/ui/`.** ADR-023.
   Tailwind utility classes ARE permitted in `apps/tessera/` for layout.
   All colours and token values use inline styles with `--rmg-*` vars.

---

## Established Colour Constants

Every file that needs supplier, track, or stream colours must define
these constants at the top — do not inline the values.

```ts
// ── Supplier brand colours (sourced from suppliers table) ──────────
const SUPPLIER_COLOURS = {
  CG:   '#003C82',  // Capgemini cobalt
  TCS:  '#9B0A6E',  // TCS magenta
  RMG:  '#E2001A',  // Royal Mail red
  HT:   '#FF8C00',  // Happy Team orange
  NH:   '#1A2B5B',  // North Highland navy
  EPAM: '#3D3D3D',  // EPAM charcoal
} as const

// ── KT Track colours ───────────────────────────────────────────────
// Track A = CG Extraction, Track B = TCS Onboarding
// These are Tessera-specific UI colours for the KT workflow.
// They deliberately differ from supplier brand colours.
const TRACK_COLOURS = {
  A: '#E8382A',  // Track A — CG extraction (red)
  B: '#4A9EFF',  // Track B — TCS onboarding (blue)
} as const

// ── Itinerary stream colours (RMG Primary Accents) ─────────────────
// Represent the two RMG teams on the India trip.
// Independent from KT tracks and supplier colours.
const STREAM_COLOURS = {
  BUILD:   '#F3920D',  // --rmg-color-orange — Matt + Jonny (Build/Factory)
  SERVICE: '#F4AEBA',  // --rmg-color-pink   — Clare + Mandy
} as const

// ── RAG status colours ─────────────────────────────────────────────
const RAG_COLOURS = {
  RED:   '#DA202A',  // --rmg-color-red
  AMBER: '#F3920D',  // --rmg-color-orange
  GREEN: '#62A531',  // --rmg-color-green
} as const

// ── Risk level colours ─────────────────────────────────────────────
const RISK_COLOURS = {
  HIGH:   '#E8382A',
  MEDIUM: '#E65100',
  LOW:    '#1B5E20',
  SCOPED: '#6A1B9A',
} as const
```

---

## Pill and Badge Pattern

The correct pattern for coloured pills/chips in Tessera:

**For supplier/track colours (hardcoded hex):**
```ts
// Border + tint background — works with hex alpha
style={{
  border: `1px solid ${colour}`,
  backgroundColor: `${colour}26`,  // 15% opacity via hex alpha
  color: colour,
  borderRadius: 'var(--rmg-radius-xl)',
  padding: '2px 10px',
  fontSize: 'var(--rmg-text-c1)',
}}
```

**For RMG token colours (CSS vars — NO rgba):**
```ts
// Left border accent + neutral background
style={{
  borderLeft: `3px solid var(--rmg-color-orange)`,
  backgroundColor: 'var(--rmg-color-tint-orange)',
  color: 'var(--rmg-color-text-body)',
  borderRadius: 'var(--rmg-radius-xs)',
  padding: '2px 10px',
  fontSize: 'var(--rmg-text-c1)',
}}
```

**Status badges (RAG, session status):**
Use solid background with white text for maximum legibility.
```ts
style={{
  backgroundColor: RAG_COLOURS.RED,
  color: '#FFFFFF',
  borderRadius: 'var(--rmg-radius-xl)',
  padding: '2px 10px',
  fontSize: 'var(--rmg-text-c1)',
  fontWeight: 600,
}}
```

---

## RMG Design System Token Reference

### Key colour tokens
--rmg-color-red:          #DA202A  ← primary brand, use sparingly
--rmg-color-warm-red:     #B70D12  ← risk/danger emphasis
--rmg-color-bright-red:   #E63338
--rmg-color-orange:       #F3920D  ← Build stream, amber-adjacent
--rmg-color-pink:         #F4AEBA  ← Service stream, soft accent
--rmg-color-blue:         #0892CB  ← positive/informational
--rmg-color-green:        #62A531  ← success/healthy
--rmg-color-dark-grey:    #404044
--rmg-color-grey-1:       #8F9495  ← muted text, neutral
--rmg-color-surface-light:#F1F2F5  ← page background
--rmg-color-tint-red:     #F8E7E7
--rmg-color-tint-orange:  #FFBD80
--rmg-color-tint-green:   #C1E3C1
--rmg-color-tint-yellow:  #FEEB87
--rmg-color-tint-pink:    #F9CFD6

### Typography
--rmg-font-display: "RM First Class", serif     ← H1s and section headers
--rmg-font-body:    "PF DinText Std", sans-serif ← all body copy
Page H1:       --rmg-text-h1  / --rmg-leading-h1
Section heads: --rmg-text-h3  / --rmg-leading-h3
Card titles:   --rmg-text-h5  / --rmg-leading-h5
Body:          --rmg-text-b3  / --rmg-leading-b3
Labels/caps:   --rmg-text-c1  / --rmg-leading-c1

### Spacing scale
--rmg-spacing-01:  4px   --rmg-spacing-02:  8px
--rmg-spacing-03: 12px   --rmg-spacing-04: 16px
--rmg-spacing-05: 20px   --rmg-spacing-06: 24px
--rmg-spacing-07: 32px   --rmg-spacing-08: 40px
--rmg-spacing-09: 48px   --rmg-spacing-10: 64px

### Shadows and radius
--rmg-shadow-card:  0 4px 56px 0 rgba(0,0,0,0.08)
--rmg-radius-xs:  4px   --rmg-radius-s:   8px
--rmg-radius-m:  12px   --rmg-radius-l:  24px
--rmg-radius-xl: 100px  ← pills and fully-rounded badges

---

## Tessera Schema Reference

All Tessera tables use the `tessera_` prefix.
KT-specific tables retain `kt` in the name.

Key tables:
- `tessera_kt_sessions` — 125 KT sessions
- `tessera_kt_session_resources` — junction: sessions ↔ resources (role: LEAD/PARTICIPANT/OBSERVER)
- `tessera_app_groups` — 13 TCS application groups
- `tessera_app_group_resources` — junction: app groups ↔ resources
- `tessera_domains` — 12 knowledge domains
- `tessera_rag_scores` — RAG scores per domain per dimension
- `tessera_nuggets` — private strategic insights
- `tessera_itinerary_days` / `tessera_itinerary_sessions` — India trip
- `tessera_parker_questions` / `tessera_domain_parker_mapping`

Shared tables (owned by core schema):
- `resources` — all people across all suppliers
- `suppliers` — supplier registry with brand hex colours

No auth — open RLS. ADR-TESS-001.

---

## Supabase Client

Import from `@/lib/supabase` — do not import from
`@supabase/supabase-js` directly.

---

## What to Check Before Every Style Decision

1. Does an `--rmg-*` token exist for this value? → Use it.
2. Is this a supplier colour? → Use `SUPPLIER_COLOURS` constant.
3. Is this a track, stream, RAG, or risk colour? → Use the relevant constant.
4. Am I about to use rgba() with a CSS var? → Stop. Use hex alpha or a tint token.
5. Is this H1 using `--rmg-font-display`? → It must be.
6. Is there a colour anchor on this page? → There must be.
7. Are all spacing values from `--rmg-spacing-*`? → They must be.
