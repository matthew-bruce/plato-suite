'use client'

import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from '@dnd-kit/core'

/**
 * Drag grip for a schedule allocation row. Renders a 2×3 grid of dots.
 * Rendered inside the dedicated handle column cell of an AllocationRow;
 * the parent is responsible for only rendering this when appropriate.
 * Inline styles only.
 */
export function DragHandle({
  listeners,
  attributes,
}: {
  listeners?: DraggableSyntheticListeners
  attributes?: DraggableAttributes
}) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder row"
      {...attributes}
      {...listeners}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 22,
        padding: 0,
        border: 'none',
        background: 'transparent',
        color: 'var(--rmg-color-grey-1, #8F9495)',
        cursor: 'grab',
        touchAction: 'none',
        flexShrink: 0,
      }}
      onMouseDown={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.cursor = 'grabbing'
      }}
      onMouseUp={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.cursor = 'grab'
      }}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden>
        <circle cx="2" cy="3" r="1.4" fill="currentColor" />
        <circle cx="8" cy="3" r="1.4" fill="currentColor" />
        <circle cx="2" cy="8" r="1.4" fill="currentColor" />
        <circle cx="8" cy="8" r="1.4" fill="currentColor" />
        <circle cx="2" cy="13" r="1.4" fill="currentColor" />
        <circle cx="8" cy="13" r="1.4" fill="currentColor" />
      </svg>
    </button>
  )
}

