'use client'

import { useState } from 'react'

export interface TabItem {
  id: string
  label: string
}

export type TabsSize = 'desktop' | 'mobile'

export interface TabsProps {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  size?: TabsSize
}

export function Tabs({ items, activeId, onChange, size = 'desktop' }: TabsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const isDesktop = size === 'desktop'

  const trackStyle: React.CSSProperties = {
    display: 'inline-flex',
    gap: 0,
    backgroundColor: 'var(--rmg-color-grey-3)',
    padding: 6,
    borderRadius: 100,
  }

  const getChipStyle = (id: string): React.CSSProperties => {
    const isActive = id === activeId
    const isHovered = id === hoveredId && !isActive
    const isFocused = id === focusedId

    const backgroundColor = isActive
      ? 'var(--rmg-color-white)'
      : 'var(--rmg-color-grey-3)'

    const color = isActive
      ? 'var(--rmg-color-red)'
      : isHovered
      ? 'var(--rmg-color-warm-red)'
      : 'var(--rmg-color-text-body)'

    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: isDesktop ? 24 : 14,
      paddingRight: isDesktop ? 24 : 14,
      paddingTop: 10,
      paddingBottom: 10,
      borderRadius: 100,
      backgroundColor,
      color,
      fontFamily: 'var(--rmg-font-body)',
      fontSize: isDesktop ? 'var(--rmg-text-b2)' : 'var(--rmg-text-b3)',
      lineHeight: isDesktop ? 'var(--rmg-leading-b2)' : 'var(--rmg-leading-b3)',
      fontWeight: 400,
      border: 'none',
      cursor: 'pointer',
      transition: 'background-color 150ms ease, color 150ms ease',
      outline: isFocused ? '2px solid var(--rmg-color-red)' : 'none',
      outlineOffset: isFocused ? 2 : undefined,
      whiteSpace: 'nowrap',
    }
  }

  // Shared chip buttons — used in both desktop and mobile layouts
  const chips = items.map((item) => (
    <button
      key={item.id}
      type="button"
      role="tab"
      aria-selected={item.id === activeId}
      style={getChipStyle(item.id)}
      onClick={() => onChange(item.id)}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setHoveredId(item.id)}
      onMouseLeave={() => setHoveredId(null)}
      onFocus={() => setFocusedId(item.id)}
      onBlur={() => setFocusedId(null)}
    >
      {item.label}
    </button>
  ))

  if (size === 'mobile') {
    return (
      <>
        <style>{`.rmg-tabs-scroll::-webkit-scrollbar{display:none}`}</style>
        {/* Outer wrapper carries the pill shape — no overflow clipping */}
        <div style={{ backgroundColor: 'var(--rmg-color-grey-3)', borderRadius: 100 }}>
          {/* Inner scroll container has no border-radius so chips are never clipped */}
          <div
            className="rmg-tabs-scroll"
            style={{
              display: 'flex',
              gap: 0,
              padding: 6,
              paddingRight: 6,
              overflowX: 'scroll',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            } as React.CSSProperties}
          >
            {chips}
          </div>
        </div>
      </>
    )
  }

  return <div style={trackStyle}>{chips}</div>
}
