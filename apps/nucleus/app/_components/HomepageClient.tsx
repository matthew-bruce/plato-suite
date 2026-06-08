'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarRange,
  ReceiptText,
  Layers,
  Building2,
  Users,
  UserCircle,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import type { HomepageData } from '@plato/schema'

function formatPence(pence: number): string {
  const pounds = pence / 100
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1)}m`
  if (pounds >= 1_000) return `£${Math.round(pounds / 1_000)}k`
  return `£${Math.round(pounds)}`
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const QUICK_ACCESS = [
  { label: 'Platform Schedule', icon: <CalendarRange size={20} />, href: '/schedule' },
  { label: 'Rate Cards',        icon: <ReceiptText size={20} />,   href: '#'         },
  { label: 'Periods',           icon: <Layers size={20} />,        href: '#'         },
  { label: 'Org Structure',     icon: <Building2 size={20} />,     href: '#'         },
  { label: 'Teams',             icon: <Users size={20} />,         href: '#'         },
  { label: 'Resources',         icon: <UserCircle size={20} />,    href: '#'         },
]

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  draft:  { bg: 'var(--rmg-color-tint-yellow)',  color: '#2A2A2D', label: 'Draft'  },
  active: { bg: 'var(--rmg-color-tint-success)', color: '#2A2A2D', label: 'Active' },
  historic: { bg: 'var(--rmg-color-grey-3)',      color: '#666666', label: 'Historic' },
}

export function HomepageClient({ data }: { data: HomepageData }) {
  const router = useRouter()
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    data.activePeriod?.period_id ?? data.periods[0]?.period_id ?? ''
  )
  const [hoveredTile, setHoveredTile] = useState<string | null>(null)

  function handlePeriodSwitch(id: string) {
    setSelectedPeriodId(id)
    router.push(`/?period=${id}`)
  }

  const { periods, activePeriod, attentionItems } = data
  const statusBadge = activePeriod
    ? (STATUS_BADGE[activePeriod.period_status] ?? STATUS_BADGE.historic)
    : null

  const metrics = activePeriod
    ? [
        { label: 'Headcount',  value: String(activePeriod.headcount)                       },
        { label: 'Base Cost',  value: formatPence(activePeriod.base_cost_pence)             },
        { label: 'Incl. VAT',  value: formatPence(activePeriod.vat_cost_pence)              },
        { label: 'Chargeable', value: formatPence(activePeriod.chargeable_cost_pence)       },
      ]
    : []

  return (
    <div
      style={{
        padding: 'var(--rmg-spacing-08)',
        maxWidth: 1120,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rmg-spacing-08)',
      }}
    >
      {/* ── Section 1: Quarter Hero ─────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'var(--rmg-color-black)',
          borderRadius: 'var(--rmg-radius-m)',
          padding: 'var(--rmg-spacing-07)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--rmg-spacing-06)',
        }}
      >
        {/* Top row: period name + switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--rmg-spacing-04)',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: name, date range, status badge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: 'var(--rmg-text-h4)',
                  lineHeight: 'var(--rmg-leading-h4)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                }}
              >
                {activePeriod?.period_name ?? 'No periods configured'}
              </span>
              {statusBadge && (
                <span
                  style={{
                    backgroundColor: statusBadge.bg,
                    color: statusBadge.color,
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-c2)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 'var(--rmg-radius-xl)',
                  }}
                >
                  {statusBadge.label}
                </span>
              )}
            </div>
            {activePeriod && (
              <span
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-c1)',
                  color: 'rgba(255,255,255,0.55)',
                }}
              >
                {formatDate(activePeriod.period_start_date)} – {formatDate(activePeriod.period_end_date)}
              </span>
            )}
          </div>

          {/* Right: period switcher pills */}
          {periods.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
              {periods.map((p) => {
                const isSelected = selectedPeriodId === p.period_id
                return (
                  <button
                    key={p.period_id}
                    onClick={() => handlePeriodSwitch(p.period_id)}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                      }
                    }}
                    style={{
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-c1)',
                      padding: '4px 12px',
                      borderRadius: 'var(--rmg-radius-xl)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 150ms ease, color 150ms ease',
                      backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.12)',
                      color: isSelected ? '#2A2A2D' : 'rgba(255,255,255,0.65)',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {p.period_name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Metric tiles */}
        {metrics.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--rmg-spacing-03)',
            }}
          >
            {metrics.map(({ label, value }) => (
              <div
                key={label}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--rmg-radius-s)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-c2)',
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    fontWeight: 700,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--rmg-font-display)',
                    fontSize: 'var(--rmg-text-h3)',
                    lineHeight: 'var(--rmg-leading-h3)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              color: 'rgba(255,255,255,0.45)',
              margin: 0,
            }}
          >
            Once a period exists in the database, metrics will appear here.
          </p>
        )}
      </div>

      {/* ── Section 2: Needs Attention (conditional) ────────────── */}
      {attentionItems.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}>
          <h2
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h5)',
              lineHeight: 'var(--rmg-leading-h5)',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
              fontWeight: 700,
            }}
          >
            Needs Attention
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-02)' }}>
            {attentionItems.map((item) => (
              <Link
                key={item.type}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--rmg-spacing-03)',
                  backgroundColor: 'var(--rmg-color-tint-orange)',
                  borderRadius: 'var(--rmg-radius-s)',
                  padding: '14px 20px',
                  textDecoration: 'none',
                }}
              >
                <AlertTriangle
                  size={18}
                  style={{ color: 'var(--rmg-color-orange)', flexShrink: 0 }}
                />
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-b3)',
                    color: 'var(--rmg-color-black)',
                  }}
                >
                  {item.label}
                </span>
                <ChevronRight
                  size={16}
                  style={{ color: 'var(--rmg-color-orange)', flexShrink: 0 }}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 3: Quick Access ──────────────────────────────── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}>
        <h2
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h5)',
            lineHeight: 'var(--rmg-leading-h5)',
            color: 'var(--rmg-color-text-heading)',
            margin: 0,
            fontWeight: 700,
          }}
        >
          Quick Access
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--rmg-spacing-03)',
          }}
        >
          {QUICK_ACCESS.map(({ label, icon, href }) => (
            <Link
              key={label}
              href={href}
              onMouseEnter={() => setHoveredTile(label)}
              onMouseLeave={() => setHoveredTile(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--rmg-spacing-03)',
                backgroundColor: hoveredTile === label
                  ? 'var(--rmg-color-grey-4)'
                  : 'var(--rmg-color-white)',
                border: '1px solid var(--rmg-color-grey-2)',
                borderRadius: 'var(--rmg-radius-s)',
                padding: '18px 20px',
                textDecoration: 'none',
                transition: 'background-color 150ms ease',
              }}
            >
              <span style={{ color: 'var(--rmg-color-red)', flexShrink: 0 }}>{icon}</span>
              <span
                style={{
                  flex: 1,
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-b3)',
                  color: 'var(--rmg-color-text-heading)',
                  fontWeight: 500,
                }}
              >
                {label}
              </span>
              <ChevronRight
                size={16}
                style={{ color: 'var(--rmg-color-grey-1)', flexShrink: 0 }}
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
