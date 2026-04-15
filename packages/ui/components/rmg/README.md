# RMG Component Library

Royal Mail Group design system components for the Plato Suite.

## Live showcase
https://plato-nucleus.vercel.app/design-system

## Components

| Component | Status | Props |
|---|---|---|
| ChevronButton | Live | size, direction, state |
| FormField | Live | variant, size, label, required, errorMessage, type |

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

## Source
Figma file: RM-Design-System (5DoXLKL4LncAx5JKqWGWYm)
