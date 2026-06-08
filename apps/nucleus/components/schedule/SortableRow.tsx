'use client'

import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragHandle } from './DragHandle'

/**
 * Wraps a single schedule allocation row to make it sortable within its
 * supplier group. Uses a render-prop pattern: `children` receives a
 * `dragHandleSlot` ReactNode that the row places into its handle column cell.
 * When drag is not enabled, `dragHandleSlot` is `null` and the cell is empty.
 * Inline styles only.
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
  children: (dragHandleSlot: ReactNode) => ReactNode
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

  const dragHandleSlot: ReactNode = canDrag
    ? <DragHandle listeners={listeners} attributes={attributes} />
    : null

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : undefined,
        opacity: isDragging ? 0.85 : 1,
        background: isDragging ? 'var(--rmg-color-surface-white, #fff)' : undefined,
        boxShadow: isDragging ? '0 4px 14px rgba(0,0,0,0.12)' : undefined,
      }}
    >
      {children(dragHandleSlot)}
    </div>
  )
}
