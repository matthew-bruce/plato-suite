'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { CHIP_LEGEND, CHIP_STATE_DESCRIPTIONS } from '@/lib/chipLegend'
import { ChipPill } from '@/components/ChipPill'

const PANEL_WIDTH = 640
const TABLE_MIN_WIDTH = 600
const GUTTER = 12

const HEADER_CELL: React.CSSProperties = { textAlign: 'left', padding: '0 8px 8px', fontWeight: 400 }
// 12px matches --rmg-text-c2 (packages/config/tokens/rmg.css) — this app's
// "caption/explanatory text next to a status pill" size, used for the same
// pattern on the domain detail page's RAG dimension evidence text.
const BODY_CELL: React.CSSProperties = { fontSize: 12, color: '#666666', lineHeight: 1.4, padding: '6px 8px', textAlign: 'left', verticalAlign: 'top' }

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2A2A2D' }}>
              Chip legend
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              title="Close"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#8F9495',
                fontSize: 14,
                lineHeight: 1,
                padding: '2px 4px',
                fontFamily: 'inherit',
              }}
            >
              ✕
            </button>
          </div>

          {/* Table can be wider than the panel itself on narrow viewports —
              scrolls horizontally inside its own container rather than
              restacking, which would force repeating each chip's
              name/colour per row (the exact thing this table replaces). */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: TABLE_MIN_WIDTH, width: '100%' }}>
              <thead>
                <tr>
                  <th style={HEADER_CELL} scope="col" />
                  <th style={HEADER_CELL} scope="col">
                    <ChipPill state="none" label="NOT STARTED" />
                  </th>
                  <th style={HEADER_CELL} scope="col">
                    <ChipPill state="progress" label="IN PROGRESS" />
                  </th>
                  <th style={HEADER_CELL} scope="col">
                    <ChipPill state="done" label="DONE" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {CHIP_LEGEND.map(({ key, label }) => {
                  const desc = CHIP_STATE_DESCRIPTIONS[key]
                  return (
                    <tr key={key} style={{ borderTop: '0.5px solid #EEEEEE' }}>
                      <td style={{ fontSize: 12, fontWeight: 500, color: '#2A2A2D', padding: '6px 8px 6px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {label}
                      </td>
                      <td style={BODY_CELL}>{desc.none}</td>
                      <td style={BODY_CELL}>{desc.progress}</td>
                      <td style={BODY_CELL}>{desc.done}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
