'use client'

import { useEffect, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Optional uppercase label prefix shown before the selected value (e.g. "Planview") */
  label?: string
}

function ChevronDown() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M1.5 3 L4.5 6 L7.5 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export function CustomSelect({ options, value, onChange, placeholder, label }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [hoveredValue, setHoveredValue] = useState<string | null>(null)
  const [triggerHovered, setTriggerHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const active = value !== '' && value !== 'all'
  const currentOption = options.find((o) => o.value === value)
  const displayLabel = currentOption?.label ?? placeholder ?? value

  useEffect(() => {
    if (!open) return
    function handleClickAway(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [open])

  const borderColor = active
    ? 'var(--rmg-color-red)'
    : triggerHovered || open
      ? 'var(--rmg-color-grey-1)'
      : 'var(--rmg-color-grey-2)'

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onMouseEnter={() => setTriggerHovered(true)}
        onMouseLeave={() => setTriggerHovered(false)}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: active ? '#FFF5F5' : 'var(--rmg-color-surface-white)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--rmg-radius-s)',
          padding: '5px 10px',
          cursor: 'pointer',
          fontFamily: 'var(--rmg-font-body)',
          transition: 'border-color 120ms, background 120ms',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-1)',
        }}
      >
        {label !== undefined && (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--rmg-color-grey-1)',
          }}>
            {label}
          </span>
        )}
        <span style={{
          fontSize: 12,
          fontWeight: active ? 600 : 400,
          color: active ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
        }}>
          {displayLabel}
        </span>
        <ChevronDown />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            // Never wider than viewport minus 16px gutter; prevents overflow on 390px screens
            maxWidth: 'min(220px, calc(100vw - 16px))',
            background: '#fff',
            border: '1px solid #EEEEEE',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {options.map((o) => (
            <div
              key={o.value}
              onMouseEnter={() => setHoveredValue(o.value)}
              onMouseLeave={() => setHoveredValue(null)}
              onClick={() => { onChange(o.value); setOpen(false) }}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'var(--rmg-font-body)',
                color: o.value === value ? '#DA202A' : '#2A2A2D',
                fontWeight: o.value === value ? 600 : 400,
                background: hoveredValue === o.value ? '#F5F5F5' : 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
