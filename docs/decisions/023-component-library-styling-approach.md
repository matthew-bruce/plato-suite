# ADR-023 — Component Library Styling Approach

**Date:** 2026-04-15
**Status:** Accepted

---

## Decision

All components in `packages/ui/components/` must be styled exclusively with inline
styles (`React.CSSProperties`) and React state for interactive behaviour. Tailwind
utility classes must not be used in this package.

---

## Context

Tailwind CSS generates utility classes by scanning content paths defined in
`tailwind.config.ts`. The `packages/ui` directory is not — and should not be —
in those content paths. Each app (`apps/nucleus`, `apps/dispatch`, etc.) owns its
own Tailwind config and scans only its own source.

This means any Tailwind class written in `packages/ui` will silently fail in
production unless it happens to also appear in a consuming app's source. This is
not a reliable guarantee and cannot be enforced. The failure mode is invisible at
build time — components render broken with no warnings.

This was discovered when the RMG Checkbox component was written using `sr-only`
and `peer-checked:` classes. Both failed silently: the native browser checkbox
rendered through the custom styled element.

---

## Consequences

### Styling
- All visual styles use inline `React.CSSProperties` objects
- All design tokens are referenced as CSS custom properties: `var(--rmg-*)` 
- These variables are defined in `packages/config/tokens/rmg.css`, which is
  imported globally by each app — making them available to inline styles at runtime
- No hardcoded hex values. CSS variables only.

### Interactive states
- Hover, focus, pressed, and checked states are driven by React `useState`
- `onMouseEnter` / `onMouseLeave` for hover
- `onFocus` / `onBlur` for focus
- This is the correct pattern for this package — not a violation of the general
  Plato principle of preferring CSS hover over JS handlers, which applies to
  app-layer components where Tailwind is available

### What this does not affect
- Components inside `apps/` may use Tailwind freely
- The `packages/config/` Tailwind preset and token files are unchanged
- White-label theming via CSS variable swapping is unaffected — inline styles
  consume the same `--rmg-*` variables as Tailwind classes would

---

## Alternatives considered

**Add `packages/ui` to each app's Tailwind content paths**
Rejected. This creates tight coupling between the shared package and each app's
build config. It also means the component library cannot be built or tested in
isolation, and any new app must remember to add the path or face the same silent
failure mode.

**Use a CSS Modules or CSS-in-JS solution**
Not adopted at this stage. Adds tooling complexity without meaningful benefit
over inline styles given the token-based approach already in use. Can be
revisited if the component library grows significantly.

**Use a standalone Tailwind build for `packages/ui`**
Possible future option if the library expands. Would require its own
`tailwind.config.ts` in `packages/ui` and a build step that generates a
dedicated stylesheet. ADR required before implementing.

---

## References

- `packages/config/tokens/rmg.css` — CSS custom property definitions
- `packages/ui/components/rmg/ChevronButton.tsx` — reference implementation
- `packages/ui/components/rmg/FormField.tsx` — reference implementation  
- `packages/ui/components/rmg/Checkbox.tsx` — component where failure was discovered
