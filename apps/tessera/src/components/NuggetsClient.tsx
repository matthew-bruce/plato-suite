'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Nugget } from '@/app/nuggets/page'
import { highlightMatch } from '@/lib/highlightMatch'

const SearchIcon = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx={11} cy={11} r={8} />
    <line x1={21} y1={21} x2={16.65} y2={16.65} />
  </svg>
)

// ── Filter pill (Section 3E) ───────────────────────────────────────────

function FilterPill({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: 'var(--rmg-radius-xl)',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 12,
        fontWeight: isActive ? 600 : 400,
        border: isActive
          ? '1.5px solid var(--rmg-color-red)'
          : '1.5px solid var(--rmg-color-grey-2)',
        background: isActive ? 'var(--rmg-color-tint-red)' : 'white',
        color: isActive ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Nugget card (Section 15) ──────────────────────────────────────────

function NuggetCard({
  nugget,
  position,
  queryTrimmed,
  activeTags,
  onTagClick,
}: {
  nugget: Nugget
  position: number
  queryTrimmed: string
  activeTags: Set<string>
  onTagClick: (tag: string) => void
}) {
  const tags = nugget.tags ?? []
  const titleNode: ReactNode = queryTrimmed
    ? highlightMatch(nugget.title, queryTrimmed)
    : nugget.title

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 24,
        marginBottom: 16,
        display: 'flex',
        gap: 18,
      }}
    >
      {/* Number badge */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'var(--rmg-color-brand-black)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
          fontFamily: 'var(--rmg-font-body)',
        }}
      >
        {position}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--rmg-color-text-heading)',
            marginBottom: 6,
          }}
        >
          {titleNode}
        </div>
        <div
          style={{
            fontSize: 14,
            fontFamily: 'var(--rmg-font-body)',
            color: 'var(--rmg-color-text-body)',
            lineHeight: 1.6,
            marginBottom: tags.length > 0 ? 14 : 0,
          }}
        >
          {nugget.content}
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tags.map((tag) => {
              const isActive = activeTags.has(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagClick(tag)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 10px',
                    borderRadius: 'var(--rmg-radius-xl)',
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    border: isActive ? '1.5px solid var(--rmg-color-red)' : 'none',
                    background: isActive
                      ? 'var(--rmg-color-tint-red)'
                      : 'var(--rmg-color-grey-3)',
                    color: isActive
                      ? 'var(--rmg-color-red)'
                      : 'var(--rmg-color-text-light)',
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

// ── Main export ───────────────────────────────────────────────────────

export function NuggetsClient({ nuggets }: { nuggets: Nugget[] }) {
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const allTags = [
    ...new Set(nuggets.flatMap((n) => n.tags ?? [])),
  ].sort((a, b) => a.localeCompare(b))

  const queryTrimmed = query.trim()
  const q = queryTrimmed.toLowerCase()

  const searchFiltered = q
    ? nuggets.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      )
    : nuggets

  const filtered =
    activeTags.size === 0
      ? searchFiltered
      : searchFiltered.filter((n) => n.tags?.some((t) => activeTags.has(t)))

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  function clearTags() {
    setActiveTags(new Set())
  }

  const allActive = activeTags.size === 0

  return (
    <div>
      {/* Tag filter bar — Section 15 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '14px 18px',
          background: 'white',
          border: '1px solid var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-m)',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.07em',
            color: 'var(--rmg-color-grey-1)',
            fontFamily: 'var(--rmg-font-body)',
            marginRight: 4,
            whiteSpace: 'nowrap',
          }}
        >
          Filter
        </span>

        <FilterPill label="All" isActive={allActive} onClick={clearTags} />

        {allTags.map((tag) => (
          <FilterPill
            key={tag}
            label={tag}
            isActive={activeTags.has(tag)}
            onClick={() => toggleTag(tag)}
          />
        ))}

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 18,
            background: 'var(--rmg-color-grey-2)',
            flexShrink: 0,
          }}
        />

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 160,
            color: 'var(--rmg-color-grey-1)',
          }}
        >
          <span style={{ display: 'flex', flexShrink: 0 }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search nuggets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: 160,
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 14,
              color: 'var(--rmg-color-text-body)',
              background: 'transparent',
            }}
          />
        </div>

        {/* Result count */}
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 12,
            color: 'var(--rmg-color-grey-1)',
            marginLeft: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {filtered.length} nugget{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Cards or empty state */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            marginTop: 60,
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 14,
            color: 'var(--rmg-color-grey-1)',
          }}
        >
          No nuggets match the current filters.
        </div>
      ) : (
        filtered.map((nugget, i) => (
          <NuggetCard
            key={nugget.id}
            nugget={nugget}
            position={i + 1}
            queryTrimmed={queryTrimmed}
            activeTags={activeTags}
            onTagClick={toggleTag}
          />
        ))
      )}
    </div>
  )
}
