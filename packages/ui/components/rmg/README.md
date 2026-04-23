# RMG Component Library

Royal Mail Group design system components for the Plato Suite.

## Live showcase
https://plato-nucleus.vercel.app/design-system

## Components

| Component | File | Status | Props |
|---|---|---|---|
| ChevronButton | ChevronButton.tsx | Live | size, direction, state |
| FormField | FormField.tsx | Live | variant, size, label, required, errorMessage, type |
| Icon | icons/Icon.tsx | Live | name, size (default 20px), color via currentColor |

## Rules
- No hardcoded hex values — `--rmg-*` CSS variables only
- No styled-components — Tailwind + CSS variables only
- Hover via CSS :hover, not JS event handlers
- All tokens sourced from `packages/config/tokens/rmg.css`
- All Tailwind classes from `packages/config/tailwind/rmg.preset.ts`

## Adding a new component
1. Export the Figma component page as React JSX
2. Upload to Claude Chat for token analysis and spec extraction
3. Claude Chat produces a Claude Code Web prompt
4. Claude Code Web writes the file to packages/ui/components/rmg/
5. Add the component to the barrel export in index.ts
6. Add a showcase section to apps/nucleus/app/design-system/page.tsx
7. Vercel deploys automatically on merge to main

## Icon system

Single `<Icon>` component. All icons from the RMG Figma Basic Icons page.

Usage:
```tsx
import { Icon } from '@plato/ui'

// Inherits colour from parent context (recommended)
<span style={{ color: 'var(--rmg-color-red)' }}>
  <Icon name="chevron-right" />
</span>

// Explicit colour override
<Icon name="edit" color="var(--rmg-color-red)" size={16} />

// Accessible (when not decorative)
<Icon name="close" aria-label="Close dialog" aria-hidden={false} />
```

Available icon names: chevron-right, chevron-left, chevron-up, chevron-down, chevron-right-sm, chevron-left-sm, chevron-up-sm, chevron-down-sm, arrow-right, info, close, location, edit, check

**Colour note:** All icons use `currentColor` — the Figma export's hardcoded hex values have been stripped. The large chevrons used `#D40918` in Figma (between red and warm-red, likely a rounding artefact). They now inherit colour from context; callers should use `var(--rmg-color-red)` as the default.

## Source
Figma file: RM-Design-System (5DoXLKL4LncAx5JKqWGWYm)
