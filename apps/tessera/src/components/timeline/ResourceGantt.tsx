'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { TimelineResource } from '@/lib/timeline'
import type { DomainConfig } from '@/lib/timeline-domains'
import {
  TOTAL_MONTHS,
  MONTH_YEAR_LABELS,
  PHASES,
  buildPhaseGradient,
  getBarPosition,
} from '@/lib/timeline-utils'
import { generateExportHTML } from '@/lib/export-timeline'

// ── Constants ─────────────────────────────────────────────────────────

const NAME_COL  = 280
const ROW_H     = 26
const DOMAIN_H  = 34
const PHASE_H   = 26
const MONTH_H   = 24
const MIN_BAR_W = NAME_COL + 640  // minimum chart width before horizontal scroll


const PHASE_GRADIENT = buildPhaseGradient()

// ── Interfaces ────────────────────────────────────────────────────────

interface Props {
  resources: TimelineResource[]
  domainConfig: DomainConfig[]
}

interface DomainRow {
  domain: DomainConfig
  idx: number
  resources: TimelineResource[]
}


// ── Component ─────────────────────────────────────────────────────────

export function ResourceGantt({ resources, domainConfig }: Props) {
  // Derive unique suppliers sorted by their sort order
  const allSuppliers = useMemo(() => {
    const seen = new Map<string, { colour: string; sort: number }>()
    for (const r of resources) {
      if (!seen.has(r.supplier_abbreviation)) {
        seen.set(r.supplier_abbreviation, { colour: r.supplier_colour, sort: r.supplier_sort })
      }
    }
    return [...seen.entries()]
      .sort((a, b) => a[1].sort - b[1].sort)
      .map(([abbr, { colour }]) => ({ abbr, colour }))
  }, [resources])

  const supplierColours = useMemo(
    () => new Map(allSuppliers.map(({ abbr, colour }) => [abbr, colour])),
    [allSuppliers],
  )

  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(
    () => new Set(['CG', 'TCS']),
  )
  const [collapsedDomains, setCollapsedDomains] = useState<Set<number>>(new Set())

  // Index resource by name
  const resourceMap = useMemo(() => {
    const m = new Map<string, TimelineResource>()
    for (const r of resources) m.set(r.resource_name, r)
    return m
  }, [resources])

  // Build domain rows filtered to selected suppliers
  const domainRows = useMemo((): DomainRow[] => {
    return domainConfig.map((domain, idx) => ({
      domain,
      idx,
      resources: domain.resourceNames
        .map((n) => resourceMap.get(n))
        .filter((r): r is TimelineResource => r != null)
        .filter((r) => selectedSuppliers.has(r.supplier_abbreviation)),
    }))
  }, [domainConfig, resourceMap, selectedSuppliers])

  // Resources in no domain (ungrouped)
  const ungrouped = useMemo(() => {
    const assigned = new Set(domainConfig.flatMap((d) => d.resourceNames))
    return resources.filter(
      (r) => !assigned.has(r.resource_name) && selectedSuppliers.has(r.supplier_abbreviation),
    )
  }, [domainConfig, resources, selectedSuppliers])

  const totalVisible = useMemo(
    () => domainRows.reduce((s, { resources: rs }) => s + rs.length, 0) + ungrouped.length,
    [domainRows, ungrouped],
  )

  function toggleSupplier(abbr: string) {
    setSelectedSuppliers((prev) => {
      const next = new Set(prev)
      next.has(abbr) ? next.delete(abbr) : next.add(abbr)
      return next
    })
  }

  function toggleDomain(idx: number) {
    setCollapsedDomains((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function handleExport() {
    const domainGroups = domainRows
      .filter((row) => row.resources.length > 0)
      .map(({ domain, resources }) => ({
        domain: domain.name,
        resources: resources.map((r) => {
          const { startMonth, endMonth, isOngoing } = getBarPosition(
            r.resource_onboarded_date,
            r.resource_rolloff_date,
          )
          return {
            resource_name:        r.resource_name,
            resource_job_title:   r.resource_job_title,
            supplier_abbreviation: r.supplier_abbreviation,
            supplier_colour:      supplierColours.get(r.supplier_abbreviation) ?? '#999',
            startMonth,
            endMonth,
            isOngoing,
          }
        }),
      }))

    const html = generateExportHTML(domainGroups)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `transition-timeline-${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── Render helpers ─────────────────────────────────────────────────

  function PhaseBackgrounds() {
    return (
      <>
        {PHASES.map((phase, pi) => {
          const leftPct  = (PHASES.slice(0, pi).reduce((s, p) => s + p.months, 0) / TOTAL_MONTHS) * 100
          const widthPct = (phase.months / TOTAL_MONTHS) * 100
          return (
            <div
              key={pi}
              style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                backgroundColor: phase.colour,
                borderRight: pi < PHASES.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
              }}
            />
          )
        })}
        {MONTH_YEAR_LABELS.map((_, mi) =>
          mi === 0 ? null : (
            <div
              key={mi}
              style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: `${(mi / TOTAL_MONTHS) * 100}%`,
                width: 1,
                backgroundColor: 'rgba(0,0,0,0.05)',
              }}
            />
          ),
        )}
      </>
    )
  }

  function ResourceRow({ resource }: { resource: TimelineResource }) {
    const { startMonth, endMonth, isOngoing } = getBarPosition(
      resource.resource_onboarded_date,
      resource.resource_rolloff_date,
    )
    const leftPct  = (startMonth / TOTAL_MONTHS) * 100
    const widthPct = ((endMonth - startMonth) / TOTAL_MONTHS) * 100
    const colour   = supplierColours.get(resource.supplier_abbreviation) ?? '#999'

    return (
      <div
        style={{
          display: 'flex',
          height: ROW_H,
          borderBottom: '1px solid var(--rmg-color-grey-4)',
        }}
      >
        {/* Name cell */}
        <div
          style={{
            width: NAME_COL,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            backgroundColor: 'var(--rmg-color-surface-white)',
            zIndex: 2,
            borderRight: '1px solid var(--rmg-color-grey-3)',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 24,
            paddingRight: 8,
            gap: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: colour,
              flexShrink: 0,
            }}
          />
          <Link
            href={`/people?resource=${resource.resource_id}`}
            title={resource.resource_job_title
              ? `${resource.resource_name} — ${resource.resource_job_title}`
              : resource.resource_name}
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              color: 'var(--rmg-color-text-body)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textDecoration: 'none',
            }}
          >
            {resource.resource_name}
          </Link>
        </div>

        {/* Bar area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <PhaseBackgrounds />
          {widthPct > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                height: 14,
                backgroundColor: colour,
                borderRadius: isOngoing ? '3px 0 0 3px' : 3,
                opacity: 0.88,
                zIndex: 1,
              }}
            />
          )}
          {/* Ongoing: hatched right edge */}
          {isOngoing && widthPct > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                right: 0,
                width: 10,
                height: 14,
                backgroundImage: `repeating-linear-gradient(
                  90deg,
                  ${colour} 0px, ${colour} 2px,
                  transparent 2px, transparent 4px
                )`,
                opacity: 0.35,
                zIndex: 1,
              }}
            />
          )}
        </div>
      </div>
    )
  }

  function DomainSection({ domain, idx, resources: domainResources }: DomainRow) {
    const isCollapsed = collapsedDomains.has(idx)

    return (
      <div>
        {/* Domain header */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--rmg-color-grey-3)',
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleDomain(idx)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleDomain(idx) }}
            style={{
              width: NAME_COL,
              flexShrink: 0,
              position: 'sticky',
              left: 0,
              backgroundColor: 'var(--rmg-color-grey-4)',
              zIndex: 3,
              borderRight: '1px solid var(--rmg-color-grey-3)',
              padding: '0 8px 0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              userSelect: 'none',
              height: DOMAIN_H,
              outline: 'none',
            }}
          >
            <span
              style={{
                fontSize: 8,
                color: 'var(--rmg-color-text-light)',
                flexShrink: 0,
                transition: 'transform 150ms ease',
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                display: 'inline-block',
              }}
            >
              ▼
            </span>
            <span
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--rmg-color-text-heading)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
            >
              {domain.name}
            </span>
            <span
              style={{
                flexShrink: 0,
                fontFamily: 'monospace',
                fontSize: 10,
                color: 'var(--rmg-color-text-light)',
                minWidth: 16,
                textAlign: 'right',
              }}
            >
              {domainResources.length}
            </span>
          </div>

          {/* Domain header bar area */}
          <div
            style={{
              flex: 1,
              height: DOMAIN_H,
              background: PHASE_GRADIENT,
              opacity: 0.45,
            }}
          />
        </div>

        {/* Resource rows */}
        {!isCollapsed && domainResources.map((r) => (
          <ResourceRow key={`${domain.name}:${r.resource_name}`} resource={r} />
        ))}
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────

  return (
    <div
      style={{
        padding: '28px 24px',
        backgroundColor: 'var(--rmg-color-surface-light)',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: '1.75rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
            }}
          >
            Resource Transition Timeline
          </h1>
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 13,
              color: 'var(--rmg-color-text-light)',
              margin: '4px 0 0',
            }}
          >
            CG → TCS factory transition · Apr 2026 – Mar 2027
            {' · '}
            <strong style={{ color: 'var(--rmg-color-text-body)' }}>{totalVisible}</strong>
            {' resources visible'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Supplier pills */}
          {allSuppliers.map(({ abbr, colour }) => {
            const active = selectedSuppliers.has(abbr)
            return (
              <button
                key={abbr}
                type="button"
                onClick={() => toggleSupplier(abbr)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--rmg-radius-xl)',
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  border: `1.5px solid ${colour}`,
                  backgroundColor: active ? colour : 'transparent',
                  color: active ? '#ffffff' : colour,
                  whiteSpace: 'nowrap',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
              >
                {abbr}
              </button>
            )
          })}

          {/* Expand / Collapse all */}
          <button
            type="button"
            onClick={() => setCollapsedDomains(new Set())}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--rmg-radius-m)',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              border: '1.5px solid var(--rmg-color-grey-2)',
              backgroundColor: 'var(--rmg-color-surface-white)',
              color: 'var(--rmg-color-text-body)',
              whiteSpace: 'nowrap',
            }}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() =>
              setCollapsedDomains(new Set(domainRows.map((_, i) => i).concat([-1])))
            }
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--rmg-radius-m)',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              border: '1.5px solid var(--rmg-color-grey-2)',
              backgroundColor: 'var(--rmg-color-surface-white)',
              color: 'var(--rmg-color-text-body)',
              whiteSpace: 'nowrap',
            }}
          >
            Collapse all
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            style={{
              padding: '4px 14px',
              borderRadius: 'var(--rmg-radius-m)',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              border: '1.5px solid var(--rmg-color-grey-2)',
              backgroundColor: 'var(--rmg-color-surface-white)',
              color: 'var(--rmg-color-text-body)',
              whiteSpace: 'nowrap',
            }}
          >
            Export HTML
          </button>
        </div>
      </div>

      {/* Chart card */}
      <div
        style={{
          backgroundColor: 'var(--rmg-color-surface-white)',
          borderRadius: 'var(--rmg-radius-m)',
          boxShadow: 'var(--rmg-shadow-card)',
          overflow: 'auto',
        }}
      >
        <div style={{ minWidth: MIN_BAR_W }}>

          {/* ── Sticky header ────────────────────────────────────── */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'var(--rmg-color-surface-white)',
            }}
          >
            {/* Phase band row */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--rmg-color-grey-3)',
              }}
            >
              <div
                style={{
                  width: NAME_COL,
                  flexShrink: 0,
                  height: PHASE_H,
                  position: 'sticky',
                  left: 0,
                  backgroundColor: 'var(--rmg-color-surface-white)',
                  zIndex: 11,
                  borderRight: '1px solid var(--rmg-color-grey-3)',
                }}
              />
              {PHASES.map((phase, pi) => (
                <div
                  key={pi}
                  style={{
                    flex: phase.months,
                    height: PHASE_H,
                    backgroundColor: phase.colour,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 8,
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: phase.textColour,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    borderRight: pi < PHASES.length - 1
                      ? '1px solid rgba(0,0,0,0.06)'
                      : 'none',
                  }}
                >
                  {phase.label}
                </div>
              ))}
            </div>

            {/* Month label row */}
            <div
              style={{
                display: 'flex',
                borderBottom: '2px solid var(--rmg-color-grey-2)',
              }}
            >
              <div
                style={{
                  width: NAME_COL,
                  flexShrink: 0,
                  height: MONTH_H,
                  position: 'sticky',
                  left: 0,
                  backgroundColor: 'var(--rmg-color-surface-white)',
                  zIndex: 11,
                  borderRight: '1px solid var(--rmg-color-grey-3)',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--rmg-color-text-light)',
                  }}
                >
                  Resource
                </span>
              </div>
              {MONTH_YEAR_LABELS.map((label, mi) => (
                <div
                  key={mi}
                  style={{
                    flex: 1,
                    height: MONTH_H,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 10,
                    fontWeight: label.includes('⚑') ? 700 : 400,
                    color: label.includes('⚑') ? '#e8382a' : 'var(--rmg-color-text-light)',
                    borderRight: mi < TOTAL_MONTHS - 1
                      ? '1px solid var(--rmg-color-grey-4)'
                      : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Domain swim lanes ────────────────────────────────── */}
          {domainRows.map((row) => (
            <DomainSection key={row.domain.name} {...row} />
          ))}

          {/* Ungrouped resources */}
          {ungrouped.length > 0 && (
            <DomainSection
              domain={{ name: 'Other', risk: 'LOW', resourceNames: [] }}
              idx={-1}
              resources={ungrouped}
            />
          )}

        </div>
      </div>
    </div>
  )
}
