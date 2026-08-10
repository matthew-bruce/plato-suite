'use client'

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'
import type { DirectoryResource, AllocationHistoryRow, CommercialSnapshot } from '@plato/schema'
import { getSupplierColour } from '@plato/ui/tokens'
import { fetchResourceAllocationHistory, fetchResourceCommercialSnapshot } from '@/app/actions/people'
import { usePrivacyMode } from '@/context/PrivacyModeContext'
import { sentenceCaseLocation, getPersonInitials } from '@/lib/people/format'
import { formatMoneyPence } from '@/lib/schedule/format'

export interface PersonDetailPanelProps {
  resource: DirectoryResource
}

export function PersonDetailPanel({ resource }: PersonDetailPanelProps) {
  const [history, setHistory] = useState<AllocationHistoryRow[] | null>(null)
  const [commercial, setCommercial] = useState<CommercialSnapshot | null>(null)
  const { isPrivate } = usePrivacyMode()

  useEffect(() => {
    let active = true
    setHistory(null)
    setCommercial(null)
    fetchResourceAllocationHistory(resource.resource_id).then((rows) => {
      if (active) setHistory(rows)
    })
    fetchResourceCommercialSnapshot(resource.resource_id).then((snap) => {
      if (active) setCommercial(snap)
    })
    return () => {
      active = false
    }
  }, [resource.resource_id])

  const colour = getSupplierColour(resource.supplier_abbreviation ?? '')
  const metaParts = [
    resource.resource_job_title,
    resource.resource_years_experience !== null ? `${resource.resource_years_experience} yrs exp` : null,
    sentenceCaseLocation(resource.resource_location),
  ].filter((p): p is string => Boolean(p))

  return (
    <div style={{ background: 'white', borderRadius: 'var(--rmg-radius-m)', boxShadow: 'var(--rmg-shadow-card)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rmg-color-grey-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: colour,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getPersonInitials(resource.resource_name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--rmg-color-text-heading)',
              }}
            >
              {resource.resource_name}
            </div>
            {metaParts.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--rmg-color-text-light)', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {metaParts.map((part, i) => (
                  <span key={i} style={{ display: 'inline-flex', gap: 6 }}>
                    {i > 0 && <span style={{ color: 'var(--rmg-color-grey-2)' }}>·</span>}
                    {part}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12 }}>
          {resource.teams.length > 0 ? (
            <span style={{ color: 'var(--rmg-color-text-light)' }}>{resource.teams.join(', ')}</span>
          ) : (
            <span style={{ color: 'var(--rmg-color-orange)' }}>Not on a team</span>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <HistorySection history={history} />
        <TechStackSection resource={resource} />
        {commercial?.authorized && <CommercialSection commercial={commercial} isPrivate={isPrivate} />}
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--rmg-color-grey-1)',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  )
}

function HistorySection({ history }: { history: AllocationHistoryRow[] | null }) {
  return (
    <div>
      <SectionHeading>Allocation History</SectionHeading>
      {history === null ? (
        <div style={{ fontSize: 12, color: 'var(--rmg-color-grey-1)' }}>Loading…</div>
      ) : history.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--rmg-color-grey-1)' }}>No allocation history.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map((row) => (
            <div key={row.allocation_id} style={{ borderBottom: '1px solid var(--rmg-color-grey-3)', paddingBottom: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--rmg-color-text-heading)',
                }}
              >
                <span>{row.period_name}</span>
                {row.capacity_days !== null && <span>{row.capacity_days}d</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--rmg-color-text-light)', marginTop: 2 }}>
                {[sentenceCaseLocation(row.resource_location), row.role_title].filter(Boolean).join(' · ')}
                {' · '}
                {row.team_name ?? '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TechStackSection({ resource }: { resource: DirectoryResource }) {
  if (!resource.resource_primary_tech_stack && !resource.resource_secondary_tech_stack) return null

  return (
    <div>
      <SectionHeading>Tech Stack</SectionHeading>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {resource.resource_primary_tech_stack && <TechChip label={resource.resource_primary_tech_stack} variant="primary" />}
        {resource.resource_secondary_tech_stack && <TechChip label={resource.resource_secondary_tech_stack} variant="secondary" />}
      </div>
    </div>
  )
}

function TechChip({ label, variant }: { label: string; variant: 'primary' | 'secondary' }) {
  const isPrimary = variant === 'primary'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 'var(--rmg-radius-xs)',
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 500,
        background: isPrimary ? 'var(--rmg-color-grey-4)' : '#EBF5FB',
        color: isPrimary ? 'var(--rmg-color-text-body)' : 'var(--rmg-color-blue)',
      }}
    >
      {label}
    </span>
  )
}

function CommercialSection({ commercial, isPrivate }: { commercial: CommercialSnapshot; isPrivate: boolean }) {
  const blurStyle: CSSProperties | undefined = isPrivate
    ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }
    : undefined

  return (
    <div>
      <SectionHeading>Commercial{commercial.period_name ? ` · ${commercial.period_name}` : ''}</SectionHeading>
      {commercial.allocations.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--rmg-color-grey-1)' }}>No allocation in the current period.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {commercial.allocations.map((a) => (
            <div key={a.allocation_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <span style={{ color: 'var(--rmg-color-text-body)', ...blurStyle }}>
                {[a.role_title, sentenceCaseLocation(a.resource_location)].filter(Boolean).join(' · ')}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: 'var(--rmg-color-text-heading)',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  ...blurStyle,
                }}
              >
                {formatMoneyPence(a.day_rate)}/day
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
