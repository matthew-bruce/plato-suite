'use client'

import { useState } from 'react'
import type { Nugget } from '@/app/nuggets/page'

// Supplier brand colours — sourced from suppliers table
const SUPPLIER_COLOURS = {
  CG:  '#003C82',  // Capgemini cobalt
  TCS: '#9B0A6E',  // TCS magenta
} as const

const TAG_COLOURS: Record<string, string> = {
  // Track colours — use supplier brand colour for the track they represent
  'Track A':       SUPPLIER_COLOURS.CG,   // CG extraction
  'Track B':       SUPPLIER_COLOURS.TCS,  // TCS onboarding
  // Supplier tags — same canonical brand colours
  CG:              SUPPLIER_COLOURS.CG,
  TCS:             SUPPLIER_COLOURS.TCS,
  // Strategy & framing — RMG blue
  strategy:        'var(--rmg-color-blue)',
  framing:         'var(--rmg-color-blue)',
  opening:         'var(--rmg-color-blue)',
  questions:       'var(--rmg-color-blue)',
  prioritisation:  'var(--rmg-color-blue)',
  // Commercial & governance — RMG orange
  commercial:      'var(--rmg-color-orange)',
  governance:      'var(--rmg-color-orange)',
  accountability:  'var(--rmg-color-orange)',
  authority:       'var(--rmg-color-orange)',
  // Risk & urgency — RMG warm red
  risk:            'var(--rmg-color-warm-red)',
  deadline:        'var(--rmg-color-warm-red)',
  gap:             'var(--rmg-color-warm-red)',
  'open action':   'var(--rmg-color-warm-red)',
  // Programmes — RMG green
  BIG:             'var(--rmg-color-green)',
  Peak:            'var(--rmg-color-green)',
  // Domains / technical — RMG blue
  Analytics:       'var(--rmg-color-blue)',
  ForgeRock:       'var(--rmg-color-blue)',
  Magento:         'var(--rmg-color-blue)',
  // Sensitive / political — RMG pink
  political:       'var(--rmg-color-pink)',
  retention:       'var(--rmg-color-pink)',
  // Process / neutral — RMG grey
  documentation:   'var(--rmg-color-grey-1)',
  testing:         'var(--rmg-color-grey-1)',
  readiness:       'var(--rmg-color-grey-1)',
  logistics:       'var(--rmg-color-grey-1)',
  scoped:          'var(--rmg-color-grey-1)',
  scoping:         'var(--rmg-color-grey-1)',
  // Parker reference
  Parker:          'var(--rmg-color-dark-grey)',
}
const DEFAULT_TAG_COLOUR = 'var(--rmg-color-grey-1)'

function tagColour(tag: string): string {
  return TAG_COLOURS[tag] ?? DEFAULT_TAG_COLOUR
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function tagChipBg(colour: string): string {
  // Hex values can be converted; CSS var colours get a fallback opacity wrapper
  if (colour.startsWith('#')) return hexToRgba(colour, 0.15)
  // For CSS variables we wrap in color-mix if supported, else rely on opacity
  return colour
}

export function NuggetsClient({ nuggets }: { nuggets: Nugget[] }) {
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // Collect all unique tags sorted alphabetically, with per-tag counts
  const tagCounts = new Map<string, number>()
  for (const nugget of nuggets) {
    for (const tag of nugget.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const allTags = [...tagCounts.keys()].sort((a, b) => a.localeCompare(b))

  const filtered =
    activeTag === null
      ? nuggets
      : nuggets.filter((n) => n.tags?.includes(activeTag))

  function toggleTag(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag))
  }

  const pillBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: 'var(--rmg-radius-xl)',
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 'var(--rmg-text-c2)',
    cursor: 'pointer',
    border: 'none',
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      {/* Tag filter bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--rmg-spacing-02)',
          marginBottom: 'var(--rmg-spacing-06)',
        }}
      >
        <button
          onClick={() => setActiveTag(null)}
          style={{
            ...pillBase,
            fontWeight: activeTag === null ? 700 : 400,
            color: activeTag === null ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
            backgroundColor: activeTag === null ? 'var(--rmg-color-tint-red)' : 'var(--rmg-color-grey-3)',
          }}
        >
          All ({nuggets.length})
        </button>
        {allTags.map((tag) => {
          const isActive = activeTag === tag
          const colour = tagColour(tag)
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                ...pillBase,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? colour : 'var(--rmg-color-text-body)',
                backgroundColor: isActive
                  ? tagChipBg(colour)
                  : 'var(--rmg-color-grey-3)',
                outline: isActive ? `2px solid ${colour}` : 'none',
                outlineOffset: -2,
              }}
            >
              {tag} ({tagCounts.get(tag)})
            </button>
          )
        })}
      </div>

      {/* Cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--rmg-spacing-04)',
        }}
      >
        {filtered.map((nugget) => (
          <NuggetCard key={nugget.number} nugget={nugget} onTagClick={toggleTag} />
        ))}
      </div>
    </div>
  )
}

function NuggetCard({
  nugget,
  onTagClick,
}: {
  nugget: Nugget
  onTagClick: (tag: string) => void
}) {
  const tags = nugget.tags ?? []

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-06)',
        display: 'flex',
        gap: 'var(--rmg-spacing-05)',
      }}
    >
      {/* Number badge */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: 'var(--rmg-color-text-heading)',
          color: 'var(--rmg-color-surface-white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          fontSize: 'var(--rmg-text-c2)',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {nugget.number}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-b2)',
            lineHeight: 'var(--rmg-leading-b2)',
            color: 'var(--rmg-color-text-heading)',
            fontWeight: 700,
            margin: 0,
            marginBottom: 'var(--rmg-spacing-03)',
          }}
        >
          {nugget.title}
        </p>
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            lineHeight: 'var(--rmg-leading-b3)',
            color: 'var(--rmg-color-text-body)',
            margin: 0,
            marginBottom: tags.length > 0 ? 'var(--rmg-spacing-04)' : 0,
          }}
        >
          {nugget.content}
        </p>

        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rmg-spacing-02)' }}>
            {tags.map((tag) => {
              const colour = tagColour(tag)
              return (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 10px',
                    borderRadius: 'var(--rmg-radius-xl)',
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-c2)',
                    fontWeight: 600,
                    color: colour,
                    backgroundColor: tagChipBg(colour),
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
