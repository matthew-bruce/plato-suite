# @plato/ui

Shared component library for the Plato Suite. All components are built here.
No app builds its own components.

## Structure
packages/ui/
components/
rmg/          ← Royal Mail Group skin components
index.ts    ← barrel export — import everything from here

## Critical rule — styling in this package (ADR-023)

Tailwind CSS does not scan `packages/ui`. **Do not use Tailwind classes here.**

All components must be styled with:
- **Inline styles** (`React.CSSProperties`) for all visual styling
- **React `useState`** for all interactive states (hover, focus, checked, pressed)
- **CSS custom properties** (`var(--rmg-*)`) for all design tokens — no hardcoded hex values
- **JS event handlers** (`onMouseEnter`/`onMouseLeave`, `onFocus`/`onBlur`) for hover and focus states

The `--rmg-*` variables are defined in `packages/config/tokens/rmg.css` and imported
globally by each consuming app, making them available to inline styles at runtime.

See `docs/decisions/023-component-library-styling-approach.md` for full rationale.

## Live components (RMG skin)

| Component | States | Sizes |
|-----------|--------|-------|
| `ChevronButton` | active, disabled, hover | large (64px), small (48px) |
| `FormField` | default, error, validated, disabled | large (56px), small (40px) |
| `Checkbox` | default, error, success | large, small |

## Adding a new component

1. Create `packages/ui/components/rmg/ComponentName.tsx`
2. Use inline styles + React state throughout — no Tailwind
3. Export from `packages/ui/components/rmg/index.ts`
4. Add to showcase at `apps/nucleus/app/design-system/page.tsx`

## Tokens

Source: `packages/config/tokens/rmg.css`
Tailwind preset: `packages/config/tailwind/rmg.preset.ts`
