// The single source of truth for the Domain Readiness chip pill's look
// (solid/saturated fill, pill-shaped corners) — used on DomainCard's real
// chips and reused as-is for the chip legend's header swatches, so the two
// can never drift out of sync.

export type ChipState = 'done' | 'progress' | 'none'

export const CHIP_STYLE: Record<ChipState, { background: string; color: string }> = {
  done: { background: '#C1E3C1', color: '#1A6B00' },
  progress: { background: '#BEE0F5', color: '#005F8A' },
  none: { background: '#EEEEEE', color: '#8F9495' },
}

export function ChipPill({
  state,
  label,
  title,
}: {
  state: ChipState
  label: string
  title?: string
}) {
  const cs = CHIP_STYLE[state]
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 5px',
        borderRadius: 3,
        background: cs.background,
        color: cs.color,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
