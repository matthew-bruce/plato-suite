'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import type {
  SchedulePageData,
  ScheduleAllocation,
  PlanviewCode,
  ResourceLocation,
} from '@plato/schema'
import {
  formatMoneyPence,
  workingDaysBetween,
  shortQuarterLabel,
} from '@/lib/schedule/format'

type Props = { data: SchedulePageData }

// Hard-coded ad-hoc platform cost items for Q4 FY 25/26 — to be migrated
// to a cost_configuration line items table later.
const AD_HOC_ITEMS_PENCE = [
  { name: 'Camel Resources', amount: 6_820_000 },
  { name: 'SLZ', amount: 4_708_000 },
  { name: 'Late Timesheets from 24/25', amount: 1_922_000 },
] as const

const ETP_AND_SS_PENCE = 11_743_400 // £117,434

const PLANVIEW_BADGE_STYLE: Record<PlanviewCode, { bg: string; fg: string }> = {
  PR: { bg: '#E3F2FD', fg: '#0D7FB5' },
  F_Gov: { bg: '#FFF3E0', fg: '#D05000' },
  BAU: { bg: 'var(--rmg-color-grey-3)', fg: 'var(--rmg-color-grey-1)' },
  ETP: { bg: '#EDE7F6', fg: '#5B2D9A' },
}

const LOCATION_STYLE: Record<ResourceLocation, { fg: string; symbol: string }> = {
  onshore: { fg: '#008A00', symbol: '●' },
  nearshore: { fg: '#1565C0', symbol: '◆' },
  offshore: { fg: '#6A1B9A', symbol: '▲' },
}

function PERIOD_STATUS_STYLE(status: SchedulePageData['period']['period_status']): {
  bg: string
  fg: string
  label: string
} {
  if (status === 'active')
    return { bg: 'var(--rmg-color-tint-green)', fg: '#1A6B00', label: 'Active' }
  if (status === 'draft')
    return { bg: 'var(--rmg-color-tint-yellow)', fg: '#9A6900', label: 'Draft' }
  return {
    bg: 'var(--rmg-color-grey-3)',
    fg: 'var(--rmg-color-grey-1)',
    label: 'Closed',
  }
}

export function SchedulePageClient({ data }: Props) {
  const { period, costConfig, allocations, allPeriods } = data
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [planviewFilter, setPlanviewFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [collapsedSuppliers, setCollapsedSuppliers] = useState<Set<string | null>>(
    new Set(),
  )

  const workingDays = useMemo(
    () => workingDaysBetween(period.period_start_date, period.period_end_date),
    [period.period_start_date, period.period_end_date],
  )

  const supplierOptions = useMemo(() => {
    const set = new Set<string>()
    allocations.forEach((a) => { if (a.supplier_name) set.add(a.supplier_name) })
    return Array.from(set).sort()
  }, [allocations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allocations.filter((a) => {
      if (q) {
        const hay = `${a.resource_name ?? ''} ${a.role_title ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (supplierFilter !== 'all' && a.supplier_name !== supplierFilter) return false
      if (planviewFilter !== 'all' && a.planview_code !== planviewFilter) return false
      if (locationFilter !== 'all' && a.resource_location !== locationFilter) return false
      return true
    })
  }, [allocations, search, supplierFilter, planviewFilter, locationFilter])

  const groupedBySupplier = useMemo(() => {
    const groups = new Map<string | null, ScheduleAllocation[]>()
    for (const a of filtered) {
      const key = a.supplier_name
      const arr = groups.get(key) ?? []
      arr.push(a)
      groups.set(key, arr)
    }
    return Array.from(groups.entries())
      .map(([name, rows]) => ({
        name,
        colour: rows[0]?.supplier_colour ?? 'var(--rmg-color-grey-1)',
        rows: rows.sort((a, b) => {
          const r = (a.role_title ?? '').localeCompare(b.role_title ?? '')
          if (r !== 0) return r
          return (a.resource_name ?? '').localeCompare(b.resource_name ?? '')
        }),
      }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [filtered])

  // KPI computations
  const totals = useMemo(() => {
    const allocsBase = allocations.reduce(
      (sum, a) => (a.planview_code === 'BAU' ? sum : sum + (a.base_total_pence ?? 0)),
      0,
    )
    const allocsVat = allocations.reduce(
      (sum, a) => (a.planview_code === 'BAU' ? sum : sum + (a.vat_total_pence ?? 0)),
      0,
    )
    const adHoc = AD_HOC_ITEMS_PENCE.reduce((s, i) => s + i.amount, 0)
    const totalPlatform = allocsVat + adHoc
    const totalPlatformIncEtp = totalPlatform + ETP_AND_SS_PENCE

    const xChargeableDays = allocations
      .filter((a) => a.planview_code === 'PR')
      .reduce((s, a) => s + (a.capacity_days ?? 0) * (a.utilisation_percent / 100), 0)

    const calcRatePence = xChargeableDays > 0 ? totalPlatform / xChargeableDays : 0
    const calcRateIncEtpPence =
      xChargeableDays > 0 ? totalPlatformIncEtp / xChargeableDays : 0

    return {
      allocsBase,
      allocsVat,
      adHoc,
      totalPlatform,
      totalPlatformIncEtp,
      xChargeableDays,
      calcRatePence,
      calcRateIncEtpPence,
      headcount: allocations.length,
    }
  }, [allocations])

  const filteredTotals = useMemo(() => {
    let base = 0
    let vat = 0
    let days = 0
    for (const a of filtered) {
      base += a.base_total_pence ?? 0
      vat += a.vat_total_pence ?? 0
      days += (a.capacity_days ?? 0) * (a.utilisation_percent / 100)
    }
    return { base, vat, days }
  }, [filtered])

  function toggleSupplier(name: string | null) {
    setCollapsedSuppliers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function handlePeriodChange(newPeriodId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', newPeriodId)
    startTransition(() => router.push(`/schedule?${params.toString()}`))
  }

  const statusStyle = PERIOD_STATUS_STYLE(period.period_status)
  const shortQ = shortQuarterLabel(period.period_name)

  return (
    <div
      style={{
        padding: '24px 28px',
        maxWidth: 1600,
        margin: '0 auto',
        fontFamily: 'var(--rmg-font-body)',
        color: 'var(--rmg-color-text-body)',
        opacity: isPending ? 0.6 : 1,
        transition: 'opacity 120ms ease',
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--rmg-color-grey-1)',
          marginBottom: 12,
        }}
      >
        Nucleus &nbsp;›&nbsp; Finance &nbsp;›&nbsp;{' '}
        <span style={{ color: 'var(--rmg-color-text-body)' }}>Platform Schedule</span>
      </div>

      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--rmg-color-text-heading)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Platform Schedule
        </h1>

        <span
          style={{
            background: 'white',
            border: '1px solid var(--rmg-color-grey-2)',
            borderRadius: 'var(--rmg-radius-xs)',
            padding: '4px 10px',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--rmg-color-text-heading)',
          }}
        >
          {shortQ}
        </span>

        <span
          style={{
            background: statusStyle.bg,
            color: statusStyle.fg,
            borderRadius: 'var(--rmg-radius-xl)',
            padding: '3px 12px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {statusStyle.label}
        </span>

        <select
          value={period.period_id}
          onChange={(e) => handlePeriodChange(e.target.value)}
          aria-label="Quarter selector"
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 13,
            padding: '6px 10px',
            border: '1px solid var(--rmg-color-grey-2)',
            borderRadius: 'var(--rmg-radius-xs)',
            backgroundColor: 'white',
            cursor: 'pointer',
          }}
        >
          {allPeriods.map((p) => (
            <option key={p.period_id} value={p.period_id}>
              {p.period_name}
            </option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        <SecondaryButton onClick={() => alert('Duplicate Quarter: coming soon')}>
          Duplicate Quarter
        </SecondaryButton>
        <SecondaryButton onClick={() => alert('Export to Excel: coming soon')}>
          Export to Excel
        </SecondaryButton>
        <PrimaryButton onClick={() => alert('Add Resource: coming soon')}>
          + Add Resource
        </PrimaryButton>
      </div>

      {/* Period info bar */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-s)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          fontSize: 12,
          color: 'var(--rmg-color-text-light)',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <InfoItem
          label="Period dates"
          value={`${formatShortDate(period.period_start_date)} – ${formatShortDate(period.period_end_date)}`}
        />
        <InfoItem label="Working days" value={String(workingDays)} />
        <InfoItem label="Platform" value="Web Platform (WEB)" />
        <InfoItem
          label="Irrecov. VAT"
          value={
            costConfig
              ? `${costConfig.vat_uplift_percent.toFixed(3)}% · ×${(1 + costConfig.vat_uplift_percent / 100).toFixed(5)}`
              : '—'
          }
        />
        <div style={{ flex: 1 }} />
        {period.period_status === 'closed' && (
          <span style={{ color: 'var(--rmg-color-grey-1)', fontStyle: 'italic' }}>
            This period is closed — values are read-only.
          </span>
        )}
        {period.period_status === 'draft' && (
          <span style={{ color: '#9A6900', fontStyle: 'italic' }}>
            Draft period — not yet active.
          </span>
        )}
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <KpiCard
          accent="var(--rmg-color-red)"
          label={`Total Platform Cost (${shortQ})`}
          value={formatMoneyPence(totals.totalPlatform)}
          sub="Allocations + VAT + ad-hoc"
        />
        <KpiCard
          accent="var(--rmg-color-red)"
          label="Total Platform Cost (inc. ETP & SS)"
          value={formatMoneyPence(totals.totalPlatformIncEtp)}
          sub="+ £117,434 ETP & Shared Services"
        />
        <KpiCard
          accent="var(--rmg-color-black)"
          label="Current Day Rate"
          value={
            costConfig?.blended_day_rate_override !== undefined &&
            costConfig?.blended_day_rate_override !== null
              ? formatMoneyPence(costConfig.blended_day_rate_override, { decimals: 2 })
              : '—'
          }
          badge="SET"
          sub={`Calculator recommends: ${formatMoneyPence(Math.round(totals.calcRatePence), { decimals: 2 })}/day`}
        />
        <KpiCard
          label="Rate inc. ETP & SS"
          value={formatMoneyPence(Math.round(totals.calcRateIncEtpPence), {
            decimals: 2,
          })}
          sub="Calculated, inc. ETP & SS"
        />
        <KpiCard
          label="Headcount / X-Chargeable Days"
          value={`${totals.headcount} / ${Math.round(totals.xChargeableDays).toLocaleString('en-GB')}`}
          sub="Allocations · PR days"
        />
      </div>

      {/* Filter bar */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-s)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <input
          type="text"
          placeholder="Search role or resource…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            border: 'none',
            outline: 'none',
            fontSize: 13,
            backgroundColor: 'transparent',
            color: 'var(--rmg-color-text-body)',
            fontFamily: 'var(--rmg-font-body)',
          }}
        />
        <Select
          label="Supplier"
          value={supplierFilter}
          onChange={setSupplierFilter}
          options={[
            { value: 'all', label: 'All suppliers' },
            ...supplierOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          label="Planview"
          value={planviewFilter}
          onChange={setPlanviewFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'PR', label: 'PR' },
            { value: 'F_Gov', label: 'F.Gov' },
            { value: 'BAU', label: 'BAU' },
            { value: 'ETP', label: 'ETP' },
          ]}
        />
        <Select
          label="Location"
          value={locationFilter}
          onChange={setLocationFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'onshore', label: 'Onshore' },
            { value: 'nearshore', label: 'Nearshore' },
            { value: 'offshore', label: 'Offshore' },
          ]}
        />
        <span
          style={{
            fontSize: 12,
            color: 'var(--rmg-color-grey-1)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Showing {filtered.length} resources
        </span>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid var(--rmg-color-grey-3)',
          borderRadius: 'var(--rmg-radius-s)',
          overflow: 'hidden',
          boxShadow: 'var(--rmg-shadow-card, 0 4px 56px rgba(0,0,0,0.06))',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              minWidth: 1100,
              borderCollapse: 'collapse',
              fontSize: 12.5,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--rmg-color-grey-4)' }}>
                <Th width={60}>Plan</Th>
                <Th>Role</Th>
                <Th>Resource</Th>
                <Th>Team</Th>
                <Th>Location</Th>
                <Th align="left">Utilisation</Th>
                <Th align="right" width={70}>Days</Th>
                <Th align="right" width={110}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Day Rate
                    <Lock size={11} strokeWidth={2.4} />
                  </span>
                </Th>
                <Th align="right" width={110}>Total</Th>
                <Th align="right" width={110}>+VAT</Th>
                <Th width={130}>Chargeable</Th>
              </tr>
            </thead>
            <tbody>
              {groupedBySupplier.map((group) => {
                const collapsed = collapsedSuppliers.has(group.name)
                const groupBase = group.rows.reduce(
                  (s, r) => s + (r.base_total_pence ?? 0),
                  0,
                )
                const groupVat = group.rows.reduce(
                  (s, r) => s + (r.vat_total_pence ?? 0),
                  0,
                )
                return (
                  <SupplierGroup
                    key={group.name ?? '__tbc__'}
                    name={group.name}
                    colour={group.colour}
                    count={group.rows.length}
                    base={groupBase}
                    vat={groupVat}
                    collapsed={collapsed}
                    onToggle={() => toggleSupplier(group.name)}
                    rows={group.rows}
                  />
                )
              })}

              {/* Ad-hoc platform cost items */}
              <tr>
                <td
                  colSpan={11}
                  style={{
                    backgroundColor: 'var(--rmg-color-tint-yellow)',
                    color: 'var(--rmg-color-text-heading)',
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '8px 14px',
                    borderTop: '1px solid var(--rmg-color-grey-2)',
                  }}
                >
                  Ad-hoc Platform Cost Items — recovered via blended rate this period
                </td>
              </tr>
              {AD_HOC_ITEMS_PENCE.map((item) => (
                <tr key={item.name} style={{ borderBottom: '1px solid var(--rmg-color-grey-3)' }}>
                  <Td />
                  <Td>{item.name}</Td>
                  <Td>
                    <span style={{ color: 'var(--rmg-color-grey-1)', fontStyle: 'italic' }}>
                      —
                    </span>
                  </Td>
                  <Td colSpan={5}>
                    <span style={{ color: 'var(--rmg-color-grey-1)' }}>Platform-level</span>
                  </Td>
                  <Td align="right">{formatMoneyPence(item.amount)}</Td>
                  <Td align="right">{formatMoneyPence(item.amount)}</Td>
                  <Td>
                    <span style={{ color: 'var(--rmg-color-grey-1)' }}>— Ad-hoc</span>
                  </Td>
                </tr>
              ))}

              {/* Grand total */}
              <tr style={{ backgroundColor: 'var(--rmg-color-black)', color: 'white' }}>
                <td
                  colSpan={6}
                  style={{
                    padding: '12px 14px',
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Filtered totals
                </td>
                <td
                  style={{
                    padding: '12px 8px',
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(filteredTotals.days).toLocaleString('en-GB')}
                </td>
                <td />
                <td
                  style={{
                    padding: '12px 8px',
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                >
                  {formatMoneyPence(filteredTotals.base)}
                </td>
                <td
                  style={{
                    padding: '12px 8px',
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                >
                  {formatMoneyPence(filteredTotals.vat)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--rmg-color-grey-1)',
          marginTop: 16,
          lineHeight: 1.6,
        }}
      >
        Day rates and totals are denominated in GBP, stored as integer pence per ADR-029.
        Internal RMG allocations do not attract irrecoverable VAT; external supplier rows
        apply the uplift of {costConfig ? `${costConfig.vat_uplift_percent.toFixed(3)}%` : 'n/a'}.
      </div>
    </div>
  )
}

/* ── Subcomponents ──────────────────────────────────────────────── */

function SupplierGroup({
  name,
  colour,
  count,
  base,
  vat,
  collapsed,
  onToggle,
  rows,
}: {
  name: string | null
  colour: string
  count: number
  base: number
  vat: number
  collapsed: boolean
  onToggle: () => void
  rows: ScheduleAllocation[]
}) {
  const displayName = name ?? 'Vacant / TBC'
  const isVacant = name === null
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          backgroundColor: '#F1F2F5',
          cursor: 'pointer',
          borderTop: '1px solid var(--rmg-color-grey-2)',
        }}
      >
        <td colSpan={5} style={{ padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--rmg-color-text-heading)',
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: isVacant ? 'var(--rmg-color-grey-2)' : colour,
                display: 'inline-block',
              }}
            />
            <span style={isVacant ? { color: 'var(--rmg-color-grey-1)', fontStyle: 'italic' } : undefined}>
              {displayName}
            </span>
            <span
              style={{
                color: 'var(--rmg-color-grey-1)',
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              · {count} {count === 1 ? 'resource' : 'resources'}
            </span>
          </span>
        </td>
        <td colSpan={3} />
        <td
          style={{
            padding: '8px 8px',
            textAlign: 'right',
            fontWeight: 700,
          }}
        >
          {formatMoneyPence(base)}
        </td>
        <td
          style={{
            padding: '8px 8px',
            textAlign: 'right',
            fontWeight: 700,
          }}
        >
          {formatMoneyPence(vat)}
        </td>
        <td />
      </tr>
      {!collapsed &&
        rows.map((r) => <AllocationRow key={r.allocation_id} row={r} />)}
    </>
  )
}

function AllocationRow({ row }: { row: ScheduleAllocation }) {
  const plan = row.planview_code
  const planStyle = plan
    ? PLANVIEW_BADGE_STYLE[plan]
    : { bg: 'var(--rmg-color-grey-3)', fg: 'var(--rmg-color-grey-1)' }
  const planLabel = plan === 'F_Gov' ? 'F.Gov' : (plan ?? '—')
  const loc = row.resource_location ? LOCATION_STYLE[row.resource_location] : null
  const isVacant = row.resource_name === null
  return (
    <tr style={{
      borderBottom: '1px solid var(--rmg-color-grey-3)',
      backgroundColor: isVacant ? 'var(--rmg-color-grey-4)' : undefined,
    }}>
      <Td>
        <span
          style={{
            display: 'inline-block',
            background: planStyle.bg,
            color: planStyle.fg,
            borderRadius: 'var(--rmg-radius-xs)',
            padding: '2px 7px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {planLabel}
        </span>
      </Td>
      <Td>{row.role_title ?? '—'}</Td>
      <Td>
        {row.resource_name ? (
          row.resource_name
        ) : (
          <span style={{ color: 'var(--rmg-color-grey-1)', fontStyle: 'italic' }}>TBC</span>
        )}
      </Td>
      <Td>
        {row.teams.length === 0 ? (
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>No team</span>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {row.teams.map((name) => (
              <span
                key={name}
                style={{
                  background: 'var(--color-background-info)',
                  color: 'var(--color-text-info)',
                  border: '0.5px solid var(--color-border-info)',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '2px 9px',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </Td>
      <Td>
        {loc ? (
          <span style={{ color: loc.fg, fontWeight: 600, fontSize: 12 }}>
            {loc.symbol} {row.resource_location}
          </span>
        ) : (
          <span style={{ color: 'var(--rmg-color-grey-1)' }}>—</span>
        )}
      </Td>
      <Td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 36,
              height: 3,
              backgroundColor: 'var(--rmg-color-grey-3)',
              borderRadius: 100,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, row.utilisation_percent)}%`,
                height: '100%',
                backgroundColor: row.utilisation_percent >= 100 ? '#008A00' : '#0892CB',
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: 'var(--rmg-color-text-body)' }}>
            {row.utilisation_percent}%
          </span>
        </div>
      </Td>
      <Td align="right">{row.capacity_days ?? '—'}</Td>
      <Td align="right">{formatMoneyPence(row.day_rate, { decimals: 2 })}</Td>
      <Td align="right">{formatMoneyPence(row.base_total_pence ?? 0)}</Td>
      <Td align="right">{formatMoneyPence(row.vat_total_pence ?? 0)}</Td>
      <Td>
        {row.is_chargeable ? (
          <span style={{ color: '#008A00', fontWeight: 600 }}>✔ Chargeable</span>
        ) : (
          <span style={{ color: 'var(--rmg-color-grey-1)' }}>— Not charged</span>
        )}
      </Td>
    </tr>
  )
}

function Th({
  children,
  align = 'left',
  width,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  width?: number
}) {
  return (
    <th
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        textAlign: align,
        padding: '10px 8px',
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--rmg-color-grey-1)',
        backgroundColor: 'var(--rmg-color-grey-4)',
        borderBottom: '1px solid var(--rmg-color-grey-2)',
        width,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  colSpan,
}: {
  children?: React.ReactNode
  align?: 'left' | 'right'
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: '8px 8px',
        textAlign: align,
        verticalAlign: 'middle',
        fontFamily: 'var(--rmg-font-body)',
      }}
    >
      {children}
    </td>
  )
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  badge,
}: {
  label: string
  value: string
  sub: string
  accent?: string
  badge?: string
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--rmg-color-grey-3)',
        borderRadius: 'var(--rmg-radius-s)',
        borderTop: accent ? `3px solid ${accent}` : '1px solid var(--rmg-color-grey-3)',
        padding: '14px 16px',
        minHeight: 96,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--rmg-color-grey-1)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--rmg-color-text-heading)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {value}
        {badge && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '2px 6px',
              background: 'var(--rmg-color-black)',
              color: 'white',
              borderRadius: 'var(--rmg-radius-xs)',
              letterSpacing: '0.08em',
              fontFamily: 'var(--rmg-font-body)',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--rmg-color-grey-1)', marginTop: 4 }}>
        {sub}
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--rmg-color-grey-1)',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--rmg-color-text-body)', fontWeight: 500 }}>
        {value}
      </div>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--rmg-color-grey-1)',
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 12,
          padding: '4px 6px',
          border: '1px solid var(--rmg-color-grey-2)',
          borderRadius: 'var(--rmg-radius-xs)',
          backgroundColor: 'white',
          fontFamily: 'var(--rmg-font-body)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        background: 'var(--rmg-color-red)',
        color: 'white',
        border: '1px solid var(--rmg-color-red)',
        borderRadius: 'var(--rmg-radius-xs)',
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'var(--rmg-font-body)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        background: 'white',
        color: 'var(--rmg-color-text-body)',
        border: '1px solid var(--rmg-color-grey-2)',
        borderRadius: 'var(--rmg-radius-xs)',
        padding: '7px 12px',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'var(--rmg-font-body)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
