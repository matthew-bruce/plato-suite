'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DomainRow, RiskLevel } from '@/app/domains/page'
import { RISK_COLOURS, RISK_TINTS } from '@plato/ui/tokens'
import { highlightMatch } from '@/lib/highlightMatch'

const RISK_LEVELS: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW', 'SCOPED']

const RISK_LABELS: Record<RiskLevel, string> = {
  HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', SCOPED: 'SCOPED',
}

function readinessLabel(completed: number, active: number): { text: string; color: string } {
  if (completed >= 6) return { text: 'Complete',    color: 'var(--rmg-color-green-contrast)' }
  if (active > 0)    return { text: 'In progress',  color: 'var(--rmg-color-blue)' }
  return               { text: 'Not started',   color: 'var(--rmg-color-grey-1)' }
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="4.5" stroke="var(--rmg-color-grey-1)" strokeWidth="1.5" />
      <path d="M10 10L14 14" stroke="var(--rmg-color-grey-1)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

type Props = { domains: DomainRow[] }

export function DomainsClient({ domains }: Props) {
  const [query, setQuery]         = useState('')
  const [activeRisk, setActiveRisk] = useState<RiskLevel | null>(null)

  const q = query.trim().toLowerCase()

  const filtered = domains.filter((d) => {
    const matchesRisk = activeRisk === null || d.risk_level === activeRisk
    const matchesQuery = q === '' || d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q)
    return matchesRisk && matchesQuery
  })

  const riskCounts = RISK_LEVELS.reduce<Record<RiskLevel, number>>(
    (acc, r) => { acc[r] = domains.filter((d) => d.risk_level === r).length; return acc },
    {} as Record<RiskLevel, number>,
  )

  return (
    <div>
      {/* Risk summary row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        {RISK_LEVELS.map((r) => (
          <span
            key={r}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: RISK_COLOURS[r],
              fontFamily: 'var(--rmg-font-body)',
              letterSpacing: '0.05em',
            }}
          >
            {riskCounts[r]} {r}
          </span>
        ))}
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--rmg-color-surface-white)',
          border: '1px solid var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-m)',
          padding: '10px 20px',
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <SearchIcon />
        <input
          type="text"
          placeholder="Search domains…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            fontSize: 14,
            fontFamily: 'var(--rmg-font-body)',
            color: 'var(--rmg-color-text-body)',
            background: 'transparent',
            width: 180,
          }}
        />

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'var(--rmg-color-grey-2)', margin: '0 4px' }} />

        {/* Risk label */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--rmg-color-text-light)',
            fontFamily: 'var(--rmg-font-body)',
          }}
        >
          RISK
        </span>

        {/* All pill */}
        <button
          onClick={() => setActiveRisk(null)}
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--rmg-font-body)',
            padding: '3px 10px',
            borderRadius: 100,
            border: 'none',
            cursor: 'pointer',
            background: activeRisk === null ? 'var(--rmg-color-red)' : 'var(--rmg-color-grey-3)',
            color: activeRisk === null ? 'var(--rmg-color-white)' : 'var(--rmg-color-text-light)',
          }}
        >
          All
        </button>

        {/* Risk level pills */}
        {RISK_LEVELS.map((r) => {
          const isActive = activeRisk === r
          return (
            <button
              key={r}
              onClick={() => setActiveRisk(isActive ? null : r)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--rmg-font-body)',
                padding: '3px 10px',
                borderRadius: 100,
                border: 'none',
                cursor: 'pointer',
                background: isActive ? RISK_COLOURS[r] : 'var(--rmg-color-grey-3)',
                color: isActive ? '#fff' : 'var(--rmg-color-text-light)',
              }}
            >
              {RISK_LABELS[r]}
            </button>
          )
        })}

        {/* Result count */}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--rmg-color-text-light)',
            fontFamily: 'var(--rmg-font-body)',
            whiteSpace: 'nowrap',
          }}
        >
          {filtered.length} of {domains.length}
        </span>
      </div>

      {/* Grid */}
      <style>{`
        .domains-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 768px) {
          .domains-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 375px) {
          .domains-grid { grid-template-columns: 1fr; }
        }
        .domain-card-link {
          display: block;
          text-decoration: none;
          color: inherit;
          border-radius: var(--rmg-radius-s);
          transition: box-shadow 0.15s ease, transform 0.15s ease;
        }
        .domain-card-link:hover {
          box-shadow: var(--rmg-shadow-card);
          transform: translateY(-2px);
        }
      `}</style>

      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            marginTop: 60,
            fontSize: 14,
            color: 'var(--rmg-color-grey-1)',
            fontFamily: 'var(--rmg-font-body)',
          }}
        >
          No domains match your filters.
        </div>
      ) : (
        <div className="domains-grid">
          {filtered.map((domain) => (
            <DomainCard key={domain.id} domain={domain} query={q} />
          ))}
        </div>
      )}
    </div>
  )
}

function DomainCard({ domain, query }: { domain: DomainRow; query: string }) {
  const risk    = domain.risk_level
  const accent  = risk ? RISK_COLOURS[risk] : 'var(--rmg-color-grey-2)'
  const tint    = risk ? RISK_TINTS[risk]   : 'var(--rmg-color-grey-4)'
  const rl      = readinessLabel(domain.completed_dimensions, domain.active_dimensions)
  const pct     = Math.min(100, (domain.completed_dimensions / 6) * 100)
  const hours   = domain.total_hours % 1 === 0
    ? `${domain.total_hours}`
    : domain.total_hours.toFixed(1)

  return (
    <Link href={`/domains/${domain.slug}`} className="domain-card-link">
      <div
        style={{
          background: 'var(--rmg-color-surface-white)',
          borderRadius: 'var(--rmg-radius-s)',
          borderLeft: `4px solid ${accent}`,
          padding: '16px 18px 14px',
          boxShadow: 'var(--rmg-shadow-subtle)',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Domain name */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'var(--rmg-font-body)',
            color: 'var(--rmg-color-text-heading)',
            lineHeight: 1.3,
            marginBottom: 6,
          }}
        >
          {highlightMatch(domain.name, query)}
        </div>

        {/* Risk badge + dimension count row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          {risk ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                fontFamily: 'var(--rmg-font-body)',
                background: tint,
                color: accent,
                padding: '2px 8px',
                borderRadius: 100,
              }}
            >
              {risk}
            </span>
          ) : (
            <span />
          )}

          <span
            style={{
              fontSize: 12,
              fontFamily: 'var(--rmg-font-body)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            {domain.completed_dimensions}/6
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 4,
            borderRadius: 100,
            background: 'var(--rmg-color-grey-3)',
            overflow: 'hidden',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: accent,
              borderRadius: 100,
            }}
          />
        </div>

        {/* Readiness label */}
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--rmg-font-body)',
            color: rl.color,
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          {rl.text}
        </div>

        {/* Meta row */}
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--rmg-font-body)',
            color: 'var(--rmg-color-grey-1)',
          }}
        >
          {domain.session_count} session{domain.session_count !== 1 ? 's' : ''} · {hours} hrs
        </div>
      </div>
    </Link>
  )
}
