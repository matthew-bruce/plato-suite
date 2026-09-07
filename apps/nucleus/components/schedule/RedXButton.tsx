'use client'

/**
 * The small red ✕ used across the Schedule page for "remove this" actions —
 * deleting a cost item or an allocation row, and clearing a monthly day
 * breakdown back to a directly-typed total.
 *
 * Lives in its own module so the Add role / resource wizard's capacity row can
 * use the same control as the inline row editor rather than a lookalike.
 */
export function RedXButton({
  onClick,
  title,
  ariaLabel,
}: {
  onClick: () => void
  title: string
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{
        flexShrink: 0,
        background: 'transparent',
        border: 'none',
        color: '#DA202A',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: 1,
        padding: '0 2px',
      }}
    >
      ✕
    </button>
  )
}
