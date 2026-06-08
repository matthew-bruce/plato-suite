'use client'

import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragHandle } from './DragHandle'

/**
 * Wraps a single schedule allocation row to make it sortable within its
 * supplier group. The drag handle is overlaid on the left edge so the
 * underlying row grid is left untouched, and is only shown when the schedule
 * is in edit mode and unlocked. Inline styles only.
 */
export function SortableRow({
  id,
  isEditMode,
  isLocked,
  children,
}: {
  id: string
  isEditMode: boolean
  isLocked: boolean
  children: ReactNode
}) {
  const canDrag = isEditMode && !isLocked

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canDrag })

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : undefined,
        opacity: isDragging ? 0.85 : 1,
        background: isDragging ? 'var(--rmg-color-surface-white, #fff)' : undefined,
        boxShadow: isDragging ? '0 4px 14px rgba(0,0,0,0.12)' : undefined,
      }}
    >
      {canDrag && (
        <span
          style={{
            position: 'absolute',
            left: -2,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <DragHandle isVisible listeners={listeners} attributes={attributes} />
        </span>
      )}
      {children}
    </div>
  )
}
