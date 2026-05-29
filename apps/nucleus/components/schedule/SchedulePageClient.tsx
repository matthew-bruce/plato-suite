'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type {
  SchedulePageData,
  ScheduleAllocation,
  PlanviewCode,
} from '@plato/schema'
import { workingDaysBetween, shortQuarterLabel } from '@/lib/schedule/format'
import {
  formatMoney,
  getUtilColour,
  isIncludedInBaseCost,
  isChargeableRow,
  getLocationColour,
  getPlanBadgeStyle,
  getTextColour,
  withAlpha,
  sortAllocations,
  type SortableCol,
  type SortDir,
} from '@/lib/schedule/ui'
import styles from './schedule.module.css'

type Props = { data: SchedulePageData }

// Hard-coded ad-hoc cost items kept for KPI maths (unchanged from previous build).
const AD_HOC_ITEMS_PENCE = [
  { name: 'Camel Resources', amount: 6_820_000 },
  { name: 'SLZ', amount: 4_708_000 },
  { name: 'Late Timesheets from 24/25', amount: 1_922_000 },
] as const

const ETP_AND_SS_PENCE = 11_743_400 // £117,434

const SCHEDULE_COLS =
  '165px 152px 120px 84px 50px 94px 90px 44px 78px 84px 84px'

const COL_PADDING = '0 16px 0 12px'

const RMG_SUPPLIER_NAME = 'Royal Mail Group'

type Allocation = ScheduleAllocation & { teams?: string[] }

interface SortState {
  col: SortableCol | null
  dir: SortDir
}

export function SchedulePageClient({ data }: Props) {
  const { period, costConfig, allocations: rawAllocations, allPeriods } = data
  const allocations = rawAllocations as Allocation[]
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [planviewFilter, setPlanviewFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [sort, setSort] = useState<SortState>({ col: 'resource', dir: 'asc' })
  const [alertDismissed, setAlertDismissed] = useState(false)

  const workingDays = useMemo(
    () => workingDaysBetween(period.period_start_date, period.period_end_date),
    [period.period_start_date, period.period_end_date],
  )

  const supplierOptions = useMemo(() => {
    const set = new Set<string>()
    allocations.forEach((a) => set.add(a.supplier_name))
    return Array.from(set).sort()
  }, [allocations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allocations.filter((a) => {
      if (q) {
        const hay = `${a.resource_name} ${a.role_title ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (supplierFilter !== 'all' && a.supplier_name !== supplierFilter) return false
      if (planviewFilter !== 'all' && a.planview_code !== planviewFilter) return false
      if (locationFilter !== 'all' && a.resource_location !== locationFilter) return false
      return true
    })
  }, [allocations, search, supplierFilter, planviewFilter, locationFilter])

  const groupedBySupplier = useMemo(() => {
    const groups = new Map<string, Allocation[]>()
    for (const a of filtered) {
      const arr = groups.get(a.supplier_name) ?? []
      arr.push(a)
      groups.set(a.supplier_name, arr)
    }
    return Array.from(groups.entries())
      .map(([name, rows]) => ({
        name,
        colour: rows[0]?.supplier_colour ?? '#8F9495',
        rows: sortAllocations(rows, sort.col, sort.dir),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [filtered, sort])

  const totals = useMemo(() => {
    const allocsBase = allocations.reduce(
      (sum, a) =>
        isIncludedInBaseCost(a.planview_code) ? sum + (a.base_total_pence ?? 0) : sum,
      0,
    )
    const allocsVat = allocations.reduce(
      (sum, a) =>
        isIncludedInBaseCost(a.planview_code) ? sum + (a.vat_total_pence ?? 0) : sum,
      0,
    )
    const adHoc = AD_HOC_ITEMS_PENCE.reduce((s, i) => s + i.amount, 0)
    const totalPlatform = allocsVat + adHoc
    const totalPlatformIncEtp = totalPlatform + ETP_AND_SS_PENCE
    const chargeableDays = allocations
      .filter((a) => isChargeableRow(a.planview_code))
      .reduce((s, a) => s + (a.capacity_days ?? 0) * (a.utilisation_percent / 100), 0)
    const calcRatePence = chargeableDays > 0 ? totalPlatform / chargeableDays : 0
    const calcRateIncEtp = chargeableDays > 0 ? totalPlatformIncEtp / chargeableDays : 0
    return {
      allocsBase,
      allocsVat,
      adHoc,
      totalPlatform,
      totalPlatformIncEtp,
      chargeableDays,
      calcRatePence,
      calcRateIncEtp,
      headcount: allocations.length,
    }
  }, [allocations])

  const allExpanded =
    groupedBySupplier.length > 0 &&
    groupedBySupplier.every((g) => expandedMap[g.name] !== false)

  function toggleSupplier(name: string) {
    setExpandedMap((prev) => ({
      ...prev,
      [name]: prev[name] === false ? true : false,
    }))
  }

  function toggleAll() {
    const next: Record<string, boolean> = {}
    const nextState = !allExpanded
    for (const g of groupedBySupplier) next[g.name] = nextState
    setExpandedMap(next)
  }

  function handlePeriodChange(newPeriodId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', newPeriodId)
    startTransition(() => router.push(`/schedule?${params.toString()}`))
  }

  function onHeaderClick(col: SortableCol) {
    setSort((prev) => {
      if (prev.col !== col) return { col, dir: 'asc' }
      if (prev.dir === 'asc') return { col, dir: 'desc' }
      return { col: null, dir: 'asc' }
    })
  }

  const isClosed = period.period_status === 'closed'
  const statusDot = isClosed
    ? '#8F9495'
    : period.period_status === 'active'
      ? '#008A00'
      : '#F3920D'
  const statusLabel =
    period.period_status === 'closed'
      ? 'Closed'
      : period.period_status === 'active'
        ? 'Active'
        : 'Draft'

  const shortQ = shortQuarterLabel(period.period_name)

  return (
    <div
      style={{
        padding: '24px 28px',
        maxWidth: 1600,
        margin: '0 auto',
        fontFamily: 'var(--rmg-font-body)',
        color: '#2A2A2D',
        opacity: isPending ? 0.6 : 1,
        transition: 'opacity 120ms ease',
      }}
    >
      <PageHeader
        period={period}
        shortQ={shortQ}
        statusDot={statusDot}
        statusLabel={statusLabel}
        workingDays={workingDays}
        allPeriods={allPeriods}
        onPeriodChange={handlePeriodChange}
        isClosed={isClosed}
      />

      {isClosed && !alertDismissed && (
        <ClosedPeriodAlert onDismiss={() => setAlertDismissed(true)} />
      )}

      <KpiStrip totals={totals} costConfig={costConfig} />

      <FilterShelf
        search={search}
        onSearch={setSearch}
        supplier={supplierFilter}
        onSupplier={setSupplierFilter}
        planview={planviewFilter}
        onPlanview={setPlanviewFilter}
        location={locationFilter}
        onLocation={setLocationFilter}
        supplierOptions={supplierOptions}
        resourceCount={filtered.length}
        allExpanded={allExpanded}
        onToggleAll={toggleAll}
      />

      <ScheduleTable
        groups={groupedBySupplier}
        expandedMap={expandedMap}
        onToggle={toggleSupplier}
        sort={sort}
        onSort={onHeaderClick}
        vatPct={costConfig?.vat_uplift_percent ?? 0}
        isClosed={isClosed}
      />
    </div>
  )
}

/* ── PageHeader ────────────────────────────────────────────────── */

function PageHeader({
  period,
  shortQ,
  statusDot,
  statusLabel,
  workingDays,
  allPeriods,
  onPeriodChange,
  isClosed,
}: {
  period: SchedulePageData['period']
  shortQ: string
  statusDot: string
  statusLabel: string
  workingDays: number
  allPeriods: SchedulePageData['allPeriods']
  onPeriodChange: (id: string) => void
  isClosed: boolean
}) {
  return (
    <>
      <nav
        style={{
          fontSize: 12,
          color: '#8F9495',
          marginBottom: 12,
        }}
      >
        Nucleus &nbsp;›&nbsp; Finance &nbsp;›&nbsp;{' '}
        <span style={{ color: '#2A2A2D' }}>Platform Schedule</span>
      </nav>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 26,
            fontWeight: 700,
            color: '#2A2A2D',
            letterSpacing: '-0.03em',
            margin: 0,
          }}
        >
          Platform Schedule
        </h1>

        <label
          style={{
            background: 'white',
            border: '1.5px solid #D5D5D5',
            borderRadius: 10,
            padding: '5px 12px',
            fontSize: 13,
            fontWeight: 600,
            color: '#2A2A2D',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <span>{shortQ}</span>
          <ChevronSmall />
          <select
            value={period.period_id}
            onChange={(e) => onPeriodChange(e.target.value)}
            aria-label="Quarter selector"
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'auto',
              width: 0,
              height: 0,
            }}
          >
            {allPeriods.map((p) => (
              <option key={p.period_id} value={p.period_id}>
                {p.period_name}
              </option>
            ))}
          </select>
        </label>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#8F9495',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusDot,
              display: 'inline-block',
            }}
          />
          {statusLabel}
        </span>

        <div style={{ flex: 1 }} />

        <GhostButton onClick={() => alert('Duplicate Quarter: coming soon')}>
          Duplicate Quarter
        </GhostButton>
        <GhostButton onClick={() => alert('Export to Excel: coming soon')}>
          Export to Excel
        </GhostButton>
        <PrimaryButton
          disabled={isClosed}
          onClick={() => alert('Add Resource: coming soon')}
        >
          {isClosed && (
            <span style={{ marginRight: 6 }} aria-hidden>
              {LockIcon(11)}
            </span>
          )}
          Add Resource
        </PrimaryButton>
      </div>

      <div
        style={{
          fontSize: 12,
          color: '#8F9495',
          marginBottom: 20,
        }}
      >
        {formatShortDate(period.period_start_date)} – {formatShortDate(period.period_end_date)} · {workingDays} working days · Web Platform (WEB)
      </div>
    </>
  )
}

/* ── ClosedPeriodAlert ─────────────────────────────────────────── */

function ClosedPeriodAlert({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      style={{
        background: '#FDDA24',
        borderRadius: 10,
        padding: '12px 18px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        marginBottom: 20,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2A2A2D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#2A2A2D' }}>
          This period is closed
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#2A2A2D',
            opacity: 0.78,
            marginTop: 2,
          }}
        >
          All values are read-only. To make changes, duplicate this quarter first.
          <button
            type="button"
            onClick={() => alert('Duplicate Quarter: coming soon')}
            style={{
              marginLeft: 10,
              background: 'rgba(0,0,0,0.1)',
              border: 'none',
              borderRadius: 6,
              padding: '3px 9px',
              fontSize: 12,
              fontWeight: 700,
              color: '#2A2A2D',
              cursor: 'pointer',
            }}
          >
            Duplicate Quarter
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          opacity: 0.45,
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          color: '#2A2A2D',
        }}
      >
        ✕
      </button>
    </div>
  )
}

/* ── KpiStrip ──────────────────────────────────────────────────── */

function KpiStrip({
  totals,
  costConfig,
}: {
  totals: {
    totalPlatform: number
    totalPlatformIncEtp: number
    calcRatePence: number
    calcRateIncEtp: number
    headcount: number
    chargeableDays: number
  }
  costConfig: SchedulePageData['costConfig']
}) {
  const overrideSet =
    costConfig?.blended_day_rate_override !== undefined &&
    costConfig?.blended_day_rate_override !== null
  const dayRateValue = overrideSet
    ? formatMoney(costConfig!.blended_day_rate_override!, { decimals: 2 })
    : formatMoney(Math.round(totals.calcRatePence), { decimals: 2 })

  return (
    <div
      className={styles.kpiStrip}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <KpiCard
        label="Total Platform Cost"
        value={formatMoney(totals.totalPlatform)}
        sub="Allocations + VAT + ad-hoc"
        accent="#DA202A"
      />
      <KpiCard
        label="Inc. ETP & Shared Services"
        value={formatMoney(totals.totalPlatformIncEtp)}
        sub="+£117,434 ETP & SS"
        accent="#404044"
      />
      <KpiCard
        label="Current Day Rate"
        value={dayRateValue}
        valueColor="#DA202A"
        sub={`Calculator: ${formatMoney(Math.round(totals.calcRatePence), { decimals: 2 })}/day`}
        accent="#DA202A"
        emphasised={overrideSet}
      />
      <KpiCard
        label="Rate Inc. ETP & SS"
        value={formatMoney(Math.round(totals.calcRateIncEtp), { decimals: 2 })}
        sub="Calculated, inc. ETP & SS"
        accent="#0892CB"
      />
      <KpiCard
        label="Headcount / PR Days"
        value={
          <>
            {totals.headcount}
            <span style={{ fontSize: 13, fontWeight: 400, color: '#8F9495' }}>
              {' '}
              / {Math.round(totals.chargeableDays).toLocaleString('en-GB')}
            </span>
          </>
        }
        sub="Allocations · chargeable days"
        accent="#8F9495"
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  valueColor,
  emphasised,
}: {
  label: string
  value: React.ReactNode
  sub: string
  accent: string
  valueColor?: string
  emphasised?: boolean
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 10,
        padding: '14px 16px 13px',
        border: emphasised
          ? '1.5px solid rgba(218,32,42,0.22)'
          : '1px solid #EEEEEE',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#8F9495',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 21,
          fontWeight: 700,
          color: valueColor ?? '#2A2A2D',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#8F9495', marginTop: 4 }}>{sub}</div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accent,
        }}
      />
    </div>
  )
}

/* ── FilterShelf ───────────────────────────────────────────────── */

function FilterShelf({
  search,
  onSearch,
  supplier,
  onSupplier,
  planview,
  onPlanview,
  location,
  onLocation,
  supplierOptions,
  resourceCount,
  allExpanded,
  onToggleAll,
}: {
  search: string
  onSearch: (v: string) => void
  supplier: string
  onSupplier: (v: string) => void
  planview: string
  onPlanview: (v: string) => void
  location: string
  onLocation: (v: string) => void
  supplierOptions: string[]
  resourceCount: number
  allExpanded: boolean
  onToggleAll: () => void
}) {
  return (
    <div
      style={{
        background: '#E8E8E8',
        border: '1px solid #D4D4D4',
        borderRadius: 10,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          background: 'white',
          border: '1px solid #DCDCDC',
          borderRadius: 7,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          minWidth: 160,
        }}
      >
        <SearchIcon />
        <input
          type="text"
          placeholder="Search role or resource…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13,
            color: '#2A2A2D',
            fontFamily: 'var(--rmg-font-body)',
          }}
        />
      </div>

      <FilterControl
        label="Supplier"
        value={supplier}
        onChange={onSupplier}
        options={[
          { value: 'all', label: 'All' },
          ...supplierOptions.map((s) => ({ value: s, label: s })),
        ]}
      />
      <FilterControl
        label="Planview"
        value={planview}
        onChange={onPlanview}
        options={[
          { value: 'all', label: 'All' },
          { value: 'PR', label: 'PR' },
          { value: 'F_Gov', label: 'F.Gov' },
          { value: 'BAU', label: 'BAU' },
          { value: 'ETP', label: 'ETP' },
        ]}
      />
      <FilterControl
        label="Location"
        value={location}
        onChange={onLocation}
        options={[
          { value: 'all', label: 'All' },
          { value: 'onshore', label: 'Onshore' },
          { value: 'nearshore', label: 'Nearshore' },
          { value: 'offshore', label: 'Offshore' },
        ]}
      />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>
          {resourceCount} resources
        </span>
        <button
          type="button"
          onClick={onToggleAll}
          style={{
            background: 'white',
            border: '1px solid #DCDCDC',
            borderRadius: 7,
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 700,
            color: '#2A2A2D',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <DoubleChevron up={allExpanded} />
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
    </div>
  )
}

function FilterControl({
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
    <label
      style={{
        background: 'white',
        border: '1px solid #DCDCDC',
        borderRadius: 7,
        padding: '5px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: '#8F9495',
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 13,
          fontWeight: 500,
          color: '#2A2A2D',
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

/* ── ScheduleTable ─────────────────────────────────────────────── */

function ScheduleTable({
  groups,
  expandedMap,
  onToggle,
  sort,
  onSort,
  vatPct,
  isClosed,
}: {
  groups: { name: string; colour: string; rows: Allocation[] }[]
  expandedMap: Record<string, boolean>
  onToggle: (name: string) => void
  sort: SortState
  onSort: (col: SortableCol) => void
  vatPct: number
  isClosed: boolean
}) {
  return (
    <div className={styles.tableScroller}>
      <div className={styles.tableInner}>
        <HeaderRow sort={sort} onSort={onSort} isClosed={isClosed} />
        {groups.map((g) => {
          const expanded = expandedMap[g.name] !== false
          const base = g.rows.reduce(
            (s, r) =>
              isIncludedInBaseCost(r.planview_code) ? s + (r.base_total_pence ?? 0) : s,
            0,
          )
          const vat = g.rows.reduce(
            (s, r) =>
              isIncludedInBaseCost(r.planview_code) ? s + (r.vat_total_pence ?? 0) : s,
            0,
          )
          return (
            <SupplierSection
              key={g.name}
              name={g.name}
              colour={g.colour}
              rows={g.rows}
              expanded={expanded}
              onToggle={() => onToggle(g.name)}
              base={base}
              vat={vat}
              vatPct={vatPct}
            />
          )
        })}
      </div>
    </div>
  )
}

const HEADERS: { col: SortableCol; label: string; align?: 'right' }[] = [
  { col: 'resource', label: 'Resource' },
  { col: 'role', label: 'Role' },
  { col: 'team', label: 'Team' },
  // utilisation is bar-only (not sortable), but we still need a cell for grid
  { col: 'plan', label: 'Plan' },
  { col: 'chargeable', label: 'Chargeable' },
  { col: 'location', label: 'Location' },
  { col: 'days', label: 'Days', align: 'right' },
  { col: 'dayRate', label: 'Day Rate', align: 'right' },
  { col: 'total', label: 'Total', align: 'right' },
  { col: 'vat', label: '+VAT', align: 'right' },
]

function HeaderRow({
  sort,
  onSort,
  isClosed,
}: {
  sort: SortState
  onSort: (col: SortableCol) => void
  isClosed: boolean
}) {
  return (
    <div
      className={styles.header}
      style={{
        display: 'grid',
        gridTemplateColumns: SCHEDULE_COLS,
        padding: COL_PADDING,
        background: '#EFEFEF',
        borderBottom: '2px solid #E0E0E0',
      }}
    >
      <Th
        label="Resource"
        col="resource"
        sort={sort}
        onSort={onSort}
      />
      <Th label="Role" col="role" sort={sort} onSort={onSort} />
      <Th label="Team" col="team" sort={sort} onSort={onSort} />
      <Th label="Utilisation" col={null} sort={sort} onSort={onSort} />
      <Th label="Plan" col="plan" sort={sort} onSort={onSort} />
      <Th label="Chargeable" col="chargeable" sort={sort} onSort={onSort} />
      <Th label="Location" col="location" sort={sort} onSort={onSort} />
      <Th label="Days" col="days" sort={sort} onSort={onSort} align="right" />
      <Th
        label="Day Rate"
        col="dayRate"
        sort={sort}
        onSort={onSort}
        align="right"
        trailing={isClosed ? LockIcon(11, 0.35) : null}
      />
      <Th label="Total" col="total" sort={sort} onSort={onSort} align="right" />
      <Th label="+VAT" col="vat" sort={sort} onSort={onSort} align="right" />
    </div>
  )
}

function Th({
  label,
  col,
  sort,
  onSort,
  align,
  trailing,
}: {
  label: string
  col: SortableCol | null
  sort: SortState
  onSort: (col: SortableCol) => void
  align?: 'right'
  trailing?: React.ReactNode
}) {
  const active = col !== null && sort.col === col
  const clickable = col !== null
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={() => col && onSort(col)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '9px 8px 9px 0',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: hovered && clickable ? '#DA202A' : '#404044',
        cursor: clickable ? 'pointer' : 'default',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        transition: 'color 120ms',
      }}
    >
      {label}
      {trailing}
      {clickable && (
        <SortIcon active={active} dir={active ? sort.dir : null} />
      )}
    </div>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir | null }) {
  const upColor = active && dir === 'asc' ? '#DA202A' : '#404044'
  const downColor = active && dir === 'desc' ? '#DA202A' : '#404044'
  const baseOpacity = active ? 1 : 0.3
  return (
    <svg width="9" height="12" viewBox="0 0 9 12" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M4.5 1 L8 5 L1 5 Z" fill={upColor} opacity={active && dir === 'asc' ? 1 : baseOpacity} />
      <path d="M4.5 11 L1 7 L8 7 Z" fill={downColor} opacity={active && dir === 'desc' ? 1 : baseOpacity} />
    </svg>
  )
}

/* ── SupplierSection ───────────────────────────────────────────── */

function SupplierSection({
  name,
  colour,
  rows,
  expanded,
  onToggle,
  base,
  vat,
  vatPct,
}: {
  name: string
  colour: string
  rows: Allocation[]
  expanded: boolean
  onToggle: () => void
  base: number
  vat: number
  vatPct: number
}) {
  const isRMG = name === RMG_SUPPLIER_NAME
  const tint = isRMG ? withAlpha(colour, '08') : withAlpha(colour, '0F')
  const pillTextColour = getTextColour(colour)

  return (
    <div style={{ borderLeft: `4px solid ${colour}` }}>
      <div
        className={styles.bandRow}
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: SCHEDULE_COLS,
          padding: COL_PADDING,
          background: tint,
          cursor: 'pointer',
        }}
      >
        <div className={styles.bandLeft}>
          <span
            style={{
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 120ms ease',
              color: colour,
              display: 'inline-flex',
            }}
            aria-hidden
          >
            <ChevronSmall />
          </span>
          <span
            style={{
              background: colour,
              color: pillTextColour,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 6,
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: 12, color: '#8F9495' }}>
            {rows.length} {rows.length === 1 ? 'resource' : 'resources'}
          </span>
        </div>
        <BandTotal label="Base" value={formatMoney(base)} />
        <BandTotal label="+VAT" value={formatMoney(vat)} />
      </div>

      {expanded &&
        rows.map((r) => (
          <AllocationRow key={r.allocation_id} row={r} vatPct={vatPct} isRMG={isRMG} />
        ))}
    </div>
  )
}

function BandTotal({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        textAlign: 'right',
        padding: '10px 8px 10px 0',
        alignSelf: 'center',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#8F9495',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#2A2A2D',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}

/* ── AllocationRow ─────────────────────────────────────────────── */

function AllocationRow({
  row,
  vatPct,
  isRMG,
}: {
  row: Allocation
  vatPct: number
  isRMG: boolean
}) {
  const plan = row.planview_code
  const isFGov = plan === 'F_Gov'
  const isBAU = plan === 'BAU'
  const planLabel = plan === 'F_Gov' ? 'F.Gov' : (plan ?? '—')
  const planStyle = getPlanBadgeStyle(plan)
  const utilColour = getUtilColour(row.utilisation_percent)
  const locColour = getLocationColour(row.resource_location)
  const tbc = !row.resource_name

  const days = row.capacity_days ?? 0
  const baseValue = row.base_total_pence ?? Math.round(row.day_rate * days * (row.utilisation_percent / 100))
  const vatValue =
    row.vat_total_pence ?? (isRMG ? baseValue : Math.round(baseValue * (1 + vatPct / 100)))

  const rowBg = isFGov
    ? 'rgba(243,146,13,0.035)'
    : isBAU
      ? 'rgba(143,148,149,0.035)'
      : 'transparent'

  const teams = row.teams ?? []

  return (
    <div
      className={styles.allocationRow}
      style={{
        gridTemplateColumns: SCHEDULE_COLS,
        background: rowBg,
      }}
    >
      {/* 1 Resource */}
      <Cell>
        {tbc ? (
          <span style={{ fontStyle: 'italic', color: '#8F9495', fontWeight: 400 }}>
            TBC
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, color: '#2A2A2D' }}>
            {row.resource_name}
          </span>
        )}
      </Cell>

      {/* 2 Role */}
      <Cell>
        <span style={{ fontSize: 13, color: '#333' }}>{row.role_title ?? '—'}</span>
      </Cell>

      {/* 3 Team */}
      <Cell>
        {teams.length === 0 ? (
          <span style={{ color: '#D5D5D5' }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {teams.map((t) => (
              <span
                key={t}
                style={{
                  background: '#EBF6FC',
                  border: '1px solid rgba(8,146,203,0.18)',
                  color: '#005F8A',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 20,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </Cell>

      {/* 4 Utilisation */}
      <Cell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 100,
              background: '#EEEEEE',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, row.utilisation_percent)}%`,
                height: '100%',
                background: utilColour,
              }}
            />
          </div>
          <span
            style={{ fontSize: 11, color: '#2A2A2D', fontVariantNumeric: 'tabular-nums' }}
          >
            {row.utilisation_percent}%
          </span>
        </div>
      </Cell>

      {/* 5 Plan */}
      <Cell>
        <span
          style={{
            display: 'inline-block',
            background: planStyle.background,
            color: planStyle.color,
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {planLabel}
        </span>
      </Cell>

      {/* 6 Chargeable */}
      <Cell>
        {isChargeableRow(plan) ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#008A00',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <TickIcon />
            Chargeable
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#D5D5D5' }}>— Not charged</span>
        )}
      </Cell>

      {/* 7 Location */}
      <Cell>
        {tbc || !row.resource_location ? (
          <span style={{ color: '#D5D5D5' }}>—</span>
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: '#555',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: locColour,
                display: 'inline-block',
              }}
            />
            {toTitle(row.resource_location)}
          </span>
        )}
      </Cell>

      {/* 8 Days */}
      <Cell align="right">
        <span
          style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
        >
          {row.capacity_days ?? '—'}
        </span>
      </Cell>

      {/* 9 Day Rate */}
      <Cell align="right">
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {formatMoney(row.day_rate, { decimals: 2 })}
        </span>
      </Cell>

      {/* 10 Total */}
      <Cell align="right">
        <span
          style={{
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            color: isBAU ? '#8F9495' : '#2A2A2D',
          }}
        >
          {formatMoney(baseValue)}
        </span>
      </Cell>

      {/* 11 +VAT */}
      <Cell align="right">
        <span
          style={{
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            color: isBAU || isRMG ? '#8F9495' : '#2A2A2D',
          }}
        >
          {formatMoney(vatValue)}
        </span>
      </Cell>
    </div>
  )
}

function Cell({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'right'
}) {
  return (
    <div
      style={{
        padding: '9px 8px 9px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        minWidth: 0,
      }}
    >
      {children}
    </div>
  )
}

/* ── Buttons / icons ───────────────────────────────────────────── */

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: '#DA202A',
        color: 'white',
        border: '1.5px solid #DA202A',
        borderRadius: 10,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--rmg-font-body)',
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  )
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        color: '#333',
        border: '1.5px solid #D5D5D5',
        borderRadius: 10,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--rmg-font-body)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function ChevronSmall() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d="M2 3 L5 7 L8 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DoubleChevron({ up }: { up: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      aria-hidden
      style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
    >
      <path d="M2 4 L6 7 L10 4" stroke="#2A2A2D" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 7 L6 10 L10 7" stroke="#2A2A2D" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="6" cy="6" r="4.2" stroke="#8F9495" strokeWidth="1.5" fill="none" />
      <path d="M9.2 9.2 L12 12" stroke="#8F9495" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TickIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
      <path d="M2 6.5 L4.8 9 L10 3.5" stroke="#008A00" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon(size: number, opacity = 1) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden
      style={{ opacity, verticalAlign: 'middle' }}
    >
      <rect x="2" y="5.5" width="8" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M4 5.5 V3.8 a2 2 0 0 1 4 0 V5.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
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

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// Suppress unused — kept exported via @plato/schema for completeness.
type _Unused = PlanviewCode
