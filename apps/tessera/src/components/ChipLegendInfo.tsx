'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { CHIP_LEGEND } from '@/lib/chipLegend'

const PANEL_WIDTH = 300
const GUTTER = 12

// Info button + floating panel explaining the 7 Domain Readiness chips.
// Positioning follows the same portal + getBoundingClientRect + click-outside
// pattern as apps/nucleus's CustomSelect, plus explicit viewport clamping
// (that pattern only relies on a CSS maxWidth, which isn't enough here since
// the trigger sits near the left edge and the panel must never overflow at
// narrow widths).
export function ChipLegendInfo() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return

    function calcPosition() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - GUTTER * 2)
      const panelHeight = panelRef.current?.offsetHeight ?? 260

      let left = rect.left
      left = Math.min(left, window.innerWidth - panelWidth - GUTTER)
      left = Math.max(GUTTER, left)

      let top = rect.bottom + 6
      const fitsBelow = top + panelHeight <= window.innerHeight - GUTTER
      if (!fitsBelow) {
        const above = rect.top - panelHeight - 6
        top = above >= GUTTER ? above : Math.max(GUTTER, window.innerHeight - panelHeight - GUTTER)
      }

      setPos({ top, left })
    }

    calcPosition()
    window.addEventListener('scroll', calcPosition, true)
    window.addEventListener('resize', calcPosition)
    return () => {
      window.removeEventListener('scroll', calcPosition, true)
      window.removeEventListener('resize', calcPosition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClickAway(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickAway)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="What do these chips mean?"
        aria-expanded={open}
        title="What do these chips mean?"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: '#8F9495',
          cursor: 'pointer',
          borderRadius: '50%',
        }}
      >
        <Info size={14} strokeWidth={1.75} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Chip legend"
          style={{
            position: 'fixed',
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            visibility: pos ? 'visible' : 'hidden',
            width: PANEL_WIDTH,
            maxWidth: `calc(100vw - ${GUTTER * 2}px)`,
            maxHeight: `calc(100vh - ${GUTTER * 2}px)`,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #EEEEEE',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            padding: '12px 14px',
            zIndex: 9999,
            boxSizing: 'border-box',
            fontFamily: 'var(--rmg-font-body)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2A2A2D', marginBottom: 8 }}>
            Chip legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHIP_LEGEND.map(({ key, label, description }) => (
              <div key={key}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#2A2A2D' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#666666', lineHeight: 1.4, marginTop: 1 }}>{description}</div>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
