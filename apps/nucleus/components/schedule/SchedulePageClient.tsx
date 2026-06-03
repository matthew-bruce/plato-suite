'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type {
  SchedulePageData,
  ScheduleAllocation,
  PlatformCostItem,
} from '@plato/schema'
import { getSupabaseBrowserClient } from '@plato/schema'
import {
  PageToolbar,
  PageToolbarSearch,
  PageToolbarFilterPill,
  PageToolbarDropdown,
  PageToolbarExpandButton,
  PageToolbarResourceCount,
  PageToolbarPrimaryActions,
  PeriodContextStrip,
  LoadingOverlay,
  useLoadingOverlay,
} from '@plato/ui'
import type { PeriodOption } from '@plato/ui'
import { getPeriodStatus } from '@plato/ui'
import { workingDaysBetween } from '@/lib/schedule/format'
import { calcCostItemVat } from '@/lib/schedule/costItems'
import { highlightMatch } from '@/lib/schedule/highlightMatch'
import { getCapacitySplit } from '@/lib/scheduleUtils'
import {
  formatMoney,
  getUtilColour,
  isIncludedInBaseCost,
  isChargeableRow,
  getLocationColour,
  getPlanBadgeStyle,
  getTextColour,
  withAlpha,
  sortAllocations as sortByColumn,
  type SortableCol,
  type SortDir,
} from '@/lib/schedule/ui'
import styles from './schedule.module.css'

type Props = { data: SchedulePageData }

const ETP_AND_SS_PENCE = 11_743_400 // £117,434

const SCHEDULE_COLS = '15% 15% 10% 8% 6% 8% 8% 5% 8% 9% 8%'

const COL_PADDING = '0 16px 0 12px'

const RMG_SUPPLIER_NAME = 'Royal Mail Group'

type Allocation = ScheduleAllocation & { teams?: string[] }

interface SortState {
  col: SortableCol | null
  dir: SortDir
}

export function SchedulePageClient({ data }: Props) {
  const { period, costConfig, allocations: rawAllocations, allPeriods, costItems: initialCostItems } = data
  const vatPct = costConfig?.vat_uplift_percent ?? 0
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending] = useTransition()
  const { isLoading, loadingMessage, loadingSubMessage, setLoading, clearLoading } =
    useLoadingOverlay()

  // Current period ID from URL, falling back to the loaded period
  const activePeriodId = searchParams.get('period') ?? period.period_id

  const [search, setSearch] = useState('')
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [planviewFilter, setPlanviewFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [sort, setSort] = useState<SortState>({ col: 'resource', dir: 'asc' })
  const [isMobile, setIsMobile] = useState(false)
  const [localCostItems, setLocalCostItems] = useState<PlatformCostItem[]>(initialCostItems)
  const [editingAdHoc, setEditingAdHoc] = useState(false)
  const [localAllocations, setLocalAllocations] = useState<Allocation[]>(() => rawAllocations as Allocation[])
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [locked, setLocked] = useState(() =>
    getPeriodStatus(new Date(period.period_start_date), new Date(period.period_end_date)) === 'historic',
  )
  useEffect(() => {
    setLocalAllocations(rawAllocations as Allocation[])
    setLocalCostItems(initialCostItems)
    setEditingSchedule(false)
    setEditingAdHoc(false)
    setLocked(
      getPeriodStatus(new Date(period.period_start_date), new Date(period.period_end_date)) === 'historic',
    )
    // New schedule data has arrived for the selected period — dismiss the overlay.
    clearLoading()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.period_id])
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const workingDays = useMemo(
    () => workingDaysBetween(period.period_start_date, period.period_end_date),
    [period.period_start_date, period.period_end_date],
  )

  const supplierOptions = useMemo(() => {
    const map = new Map<string, { colour: string; sortOrder: number | null }>()
    for (const a of localAllocations) {
      if (a.supplier_name && !map.has(a.supplier_name)) {
        map.set(a.supplier_name, {
          colour: a.supplier_colour ?? '#8F9495',
          sortOrder: a.supplier_sort_order,
        })
      }
    }
    return Array.from(map.entries())
      .map(([name, { colour, sortOrder }]) => ({ name, colour, sortOrder }))
      .sort((a, b) => {
        const sa = a.sortOrder ?? Infinity
        const sb = b.sortOrder ?? Infinity
        if (sa !== sb) return sa - sb
        return a.name.localeCompare(b.name)
      })
  }, [localAllocations])

  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    for (const a of localAllocations) {
      for (const t of a.teams ?? []) set.add(t.teamName)
    }
    return Array.from(set).sort()
  }, [localAllocations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return localAllocations.filter((a) => {
      if (q) {
        const hay = `${a.resource_name} ${a.role_title ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (selectedSuppliers.length > 0 && !selectedSuppliers.includes(a.supplier_name ?? '')) return false
      if (planviewFilter !== 'all' && a.planview_code !== planviewFilter) return false
      if (locationFilter !== 'all' && a.resource_location !== locationFilter) return false
      if (teamFilter !== 'all' && !(a.teams ?? []).some((t) => t.teamName === teamFilter || t.teamId === teamFilter)) return false
      return true
    })
  }, [localAllocations, search, selectedSuppliers, planviewFilter, locationFilter, teamFilter])

  const groupedBySupplier = useMemo(() => {
    const groups = new Map<string | null, Allocation[]>()
    for (const a of filtered) {
      const arr = groups.get(a.supplier_name) ?? []
      arr.push(a)
      groups.set(a.supplier_name, arr)
    }
    return Array.from(groups.entries())
      .map(([name, rows]) => ({
        name,
        colour: rows[0]?.supplier_colour ?? '#8F9495',
        supplierId: rows[0]?.supplier_id ?? null,
        sortOrder: rows[0]?.supplier_sort_order ?? null,
        rows: sortByColumn([...rows].sort(sortAllocations), sort.col, sort.dir),
      }))
      .sort((a, b) => {
        const sa = a.sortOrder ?? Infinity
        const sb = b.sortOrder ?? Infinity
        if (sa !== sb) return sa - sb
        return (a.name ?? '').localeCompare(b.name ?? '')
      })
  }, [filtered, sort])

  const totals = useMemo(() => {
    const allocsBase = localAllocations.reduce(
      (sum, a) =>
        isIncludedInBaseCost(a.planview_code) ? sum + (a.base_total_pence ?? 0) : sum,
      0,
    )
    const allocsVat = localAllocations.reduce(
      (sum, a) =>
        isIncludedInBaseCost(a.planview_code) ? sum + (a.vat_total_pence ?? 0) : sum,
      0,
    )
    const adHocVat = localCostItems.reduce(
      (s, item) => s + calcCostItemVat(item.amount_pence, item.vat_applies, vatPct),
      0,
    )
    const totalPlatform = allocsVat + adHocVat
    const totalPlatformIncEtp = totalPlatform + ETP_AND_SS_PENCE
    const chargeableDays = localAllocations
      .filter((a) => isChargeableRow(a.planview_code))
      .reduce((s, a) => s + (a.capacity_days ?? 0) * (a.utilisation_percent / 100), 0)
    const calcRatePence = chargeableDays > 0 ? totalPlatform / chargeableDays : 0
    const calcRateIncEtp = chargeableDays > 0 ? totalPlatformIncEtp / chargeableDays : 0
    return {
      allocsBase,
      allocsVat,
      adHocVat,
      totalPlatform,
      totalPlatformIncEtp,
      chargeableDays,
      calcRatePence,
      calcRateIncEtp,
      headcount: localAllocations.length,
    }
  }, [localAllocations, localCostItems, vatPct])

  const isUnfiltered =
    search.trim() === '' &&
    selectedSuppliers.length === 0 &&
    planviewFilter === 'all' &&
    locationFilter === 'all' &&
    teamFilter === 'all'

  async function handleExportToExcel() {
    setLoading('Building export', period.period_name)
    try {
      const response = await fetch(`/api/export/schedule?periodId=${activePeriodId}`)
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = response.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="(.+)"/)
      a.download = match?.[1] ?? 'Rate_Calculator.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      clearLoading()
    }
  }

  async function refetchCostItems() {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase
      .from('platform_cost_items')
      .select('cost_item_id, label, amount_pence, vat_applies, sort_order, notes')
      .eq('period_id', period.period_id)
      .is('deleted_at', null)
      .order('sort_order')
    if (data) setLocalCostItems(data as PlatformCostItem[])
  }

  async function handleUpdateCostItem(
    id: string,
    updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes'>>,
  ) {
    setLocalCostItems((prev) => prev.map((item) => item.cost_item_id === id ? { ...item, ...updates } : item))
    const supabase = getSupabaseBrowserClient()
    await supabase.from('platform_cost_items').update(updates).eq('cost_item_id', id)
  }

  async function handleDeleteCostItem(id: string) {
    setLocalCostItems((prev) => prev.filter((item) => item.cost_item_id !== id))
    const supabase = getSupabaseBrowserClient()
    await supabase
      .from('platform_cost_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('cost_item_id', id)
  }

  async function handleAddCostItem() {
    const supabase = getSupabaseBrowserClient()
    const maxSort = localCostItems.length > 0
      ? Math.max(...localCostItems.map((i) => i.sort_order))
      : 0
    await supabase.from('platform_cost_items').insert({
      period_id: period.period_id,
      label: 'New item',
      amount_pence: 0,
      vat_applies: false,
      sort_order: maxSort + 1,
      notes: null,
    })
    await refetchCostItems()
  }

  async function handleUpdateAllocation(id: string, updates: AllocationUpdates) {
    setLocalAllocations((prev) => prev.map((a) => {
      if (a.allocation_id !== id) return a
      const next = { ...a, ...updates }
      const days = next.capacity_days ?? 0
      const base = Math.round(next.day_rate * days * (next.utilisation_percent / 100))
      const vatApplies = next.vat_applies !== false
      const vat = vatApplies ? Math.round(base * (1 + vatPct / 100)) : base
      return { ...next, base_total_pence: base, vat_total_pence: vat }
    }))
    const supabase = getSupabaseBrowserClient()
    await supabase.from('resource_period_allocations').update(updates).eq('allocation_id', id)
  }

  async function handleDeleteAllocation(id: string) {
    setLocalAllocations((prev) => prev.filter((a) => a.allocation_id !== id))
    const supabase = getSupabaseBrowserClient()
    await supabase
      .from('resource_period_allocations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('allocation_id', id)
  }

  async function handleAddAllocation(
    supplierId: string | null,
    supplierName: string | null,
    supplierColour: string,
  ) {
    const supabase = getSupabaseBrowserClient()
    const { data: inserted } = await supabase
      .from('resource_period_allocations')
      .insert({
        period_id: period.period_id,
        supplier_id: supplierId,
        role_title: null,
        planview_code: 'BAU',
        day_rate: 0,
        utilisation_percent: 100,
        capacity_days: 0,
        is_chargeable: false,
        vat_applies: true,
      })
      .select('allocation_id')
      .single()
    if (inserted?.allocation_id) {
      const supplierSortOrder =
        localAllocations.find((a) => a.supplier_id === supplierId)?.supplier_sort_order ?? null
      const newAlloc: Allocation = {
        allocation_id: inserted.allocation_id as string,
        resource_name: null,
        role_title: null,
        supplier_id: supplierId,
        supplier_name: supplierName,
        supplier_colour: supplierColour,
        supplier_sort_order: supplierSortOrder,
        resource_location: null,
        planview_code: 'BAU',
        day_rate: 0,
        utilisation_percent: 100,
        capacity_days: 0,
        is_chargeable: false,
        vat_applies: true,
        teams: [],
        base_total_pence: 0,
        vat_total_pence: 0,
      }
      setLocalAllocations((prev) => [...prev, newAlloc])
    }
  }

  const allExpanded =
    groupedBySupplier.length > 0 &&
    groupedBySupplier.every((g) => expandedMap[g.name ?? ''] !== false)

  function toggleSupplier(name: string | null) {
    const key = name ?? ''
    setExpandedMap((prev) => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }))
  }

  function toggleAll() {
    const next: Record<string, boolean> = {}
    const nextState = !allExpanded
    for (const g of groupedBySupplier) next[g.name ?? ''] = nextState
    setExpandedMap(next)
  }

  function onHeaderClick(col: SortableCol) {
    setSort((prev) => {
      if (prev.col !== col) return { col, dir: 'asc' }
      if (prev.dir === 'asc') return { col, dir: 'desc' }
      return { col: null, dir: 'asc' }
    })
  }

  const isClosed = period.period_status === 'closed'

  return (
    <>
    <div
      style={{
        background: '#ffffff',
        minHeight: 'calc(100vh - 40px)',
        padding: '24px 28px',
        fontFamily: 'var(--rmg-font-body)',
        color: '#2A2A2D',
        opacity: isPending ? 0.6 : 1,
        transition: 'opacity 120ms ease',
        boxSizing: 'border-box',
      }}
    >
      <PageHeader onCreateNewPeriod={() => console.log('Create New Period: coming soon')} />

      <PeriodContextStrip
        periodStart={new Date(period.period_start_date)}
        periodEnd={new Date(period.period_end_date)}
        workingDays={workingDays}
        platformName="Web Platform (WEB)"
        periods={allPeriods.map((p): PeriodOption => ({
          periodId: p.period_id,
          periodStart: new Date(p.period_start_date),
          periodEnd: new Date(p.period_end_date),
          workingDays: workingDaysBetween(p.period_start_date, p.period_end_date),
        }))}
        currentPeriodId={activePeriodId}
        onPeriodSelect={(id) => {
          if (id === activePeriodId) return
          const periodName = allPeriods.find((p) => p.period_id === id)?.period_name
          setLoading('Loading schedule', periodName)
          const params = new URLSearchParams(searchParams.toString())
          params.set('period', id)
          router.push(`/schedule?${params.toString()}`)
        }}
        locked={locked}
        onLockToggle={() => setLocked((v) => !v)}
        onDuplicate={() => console.log('Duplicate period: coming soon')}
        onActivate={() => console.log('Activate period: coming soon')}
        onExport={handleExportToExcel}
      />

      <KpiStrip totals={totals} costConfig={costConfig} />

      <div style={{ marginBottom: 14 }}>
        <PageToolbar
          primaryRow={
            <>
              <div style={isMobile ? { flex: '1 1 100%' } : { maxWidth: '400px', flexShrink: 0 }}>
                <PageToolbarSearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Search role or resource…"
                />
              </div>
              <div style={{ width: '1px', height: '18px', background: 'var(--rmg-color-grey-2)', flexShrink: 0, margin: '0 4px' }} />
              <PageToolbarDropdown
                label="Planview"
                value={planviewFilter}
                onChange={setPlanviewFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'PR', label: 'PR' },
                  { value: 'F_Gov', label: 'F_GOV' },
                  { value: 'BAU', label: 'BAU' },
                  { value: 'ETP', label: 'ETP' },
                ]}
              />
              <PageToolbarDropdown
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
              <PageToolbarDropdown
                label="Team"
                value={teamFilter}
                onChange={setTeamFilter}
                options={[
                  { value: 'all', label: 'All' },
                  ...teamOptions.map((t) => ({ value: t, label: t })),
                ]}
              />
              <PageToolbarPrimaryActions style={{ marginLeft: 'auto' }}>
                <PageToolbarResourceCount>
                  {filtered.length} resources
                </PageToolbarResourceCount>
                <PageToolbarExpandButton
                  expanded={allExpanded}
                  onToggle={toggleAll}
                />
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => setEditingSchedule((v) => !v)}
                    style={{
                      border: editingSchedule ? '1.5px solid var(--rmg-color-red)' : '1.5px solid var(--rmg-color-grey-2)',
                      borderRadius: 'var(--rmg-radius-s)',
                      background: editingSchedule ? '#FFF5F5' : 'var(--rmg-color-surface-white)',
                      color: editingSchedule ? 'var(--rmg-color-red)' : 'var(--rmg-color-text-body)',
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 12,
                      fontWeight: editingSchedule ? 600 : 400,
                      padding: '5px 10px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {editingSchedule ? 'Done editing' : 'Edit schedule'}
                  </button>
                )}
              </PageToolbarPrimaryActions>
            </>
          }
          filterRow={
            <>
              <PageToolbarFilterPill
                label="All suppliers"
                active={selectedSuppliers.length === 0}
                colour="--all"
                onClick={() => setSelectedSuppliers([])}
              />
              {supplierOptions.map((s) => (
                <PageToolbarFilterPill
                  key={s.name}
                  label={s.name}
                  active={selectedSuppliers.includes(s.name)}
                  colour={s.colour}
                  onClick={() =>
                    setSelectedSuppliers((prev) =>
                      prev.includes(s.name)
                        ? prev.filter((x) => x !== s.name)
                        : [...prev, s.name],
                    )
                  }
                />
              ))}
            </>
          }
        />
      </div>

      <ScheduleTable
        groups={groupedBySupplier}
        expandedMap={expandedMap}
        onToggle={toggleSupplier}
        sort={sort}
        onSort={onHeaderClick}
        vatPct={vatPct}
        isClosed={isClosed}
        activeTeamFilter={teamFilter === 'all' ? null : teamFilter}
        searchQuery={search}
        costItems={localCostItems}
        isUnfiltered={isUnfiltered}
        editingAdHoc={editingAdHoc}
        onToggleEditAdHoc={() => setEditingAdHoc((v) => !v)}
        onUpdateCostItem={handleUpdateCostItem}
        onDeleteCostItem={handleDeleteCostItem}
        onAddCostItem={handleAddCostItem}
        editingSchedule={editingSchedule}
        onUpdateAllocation={handleUpdateAllocation}
        onDeleteAllocation={handleDeleteAllocation}
        onAddAllocation={handleAddAllocation}
      />
    </div>
    <LoadingOverlay
      isLoading={isLoading}
      message={loadingMessage}
      subMessage={loadingSubMessage}
    />
    </>
  )
}

/* ── PageHeader ────────────────────────────────────────────────── */

function PageHeader({ onCreateNewPeriod }: { onCreateNewPeriod: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#2A2A2D',
          letterSpacing: '-0.03em',
          margin: 0,
        }}
      >
        Platform Schedule
      </h1>

      <GhostButton onClick={onCreateNewPeriod}>
        <span style={{ marginRight: 6, display: 'inline-flex', verticalAlign: 'middle' }} aria-hidden>
          <ClockIcon size={12} />
        </span>
        Create New Period
      </GhostButton>
    </div>
  )
}

function ClockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
    <div className={styles.kpiStrip}>
      <KpiCard
        label="Total Platform Cost"
        value={formatMoney(totals.totalPlatform, { decimals: 0 })}
        sub="Allocations + VAT + ad-hoc"
        accent="#DA202A"
      />
      <KpiCard
        label="Inc. ETP & Shared Services"
        value={formatMoney(totals.totalPlatformIncEtp, { decimals: 0 })}
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

/* ── Within-band row ordering ──────────────────────────────────── */

const PLANVIEW_RANK: Record<string, number> = { BAU: 0, F_Gov: 1, PR: 2 }

function sortAllocations(a: ScheduleAllocation, b: ScheduleAllocation): number {
  const rankA = PLANVIEW_RANK[a.planview_code ?? ''] ?? 99
  const rankB = PLANVIEW_RANK[b.planview_code ?? ''] ?? 99
  if (rankA !== rankB) return rankA - rankB
  const nameA = a.resource_name ?? 'ZZZZZ'
  const nameB = b.resource_name ?? 'ZZZZZ'
  return nameA.localeCompare(nameB)
}

/* ── ScheduleTable ─────────────────────────────────────────────── */

type AllocationUpdates = Partial<Pick<ScheduleAllocation, 'role_title' | 'day_rate' | 'capacity_days' | 'utilisation_percent' | 'planview_code' | 'vat_applies' | 'is_chargeable'>>

function ScheduleTable({
  groups,
  expandedMap,
  onToggle,
  sort,
  onSort,
  vatPct,
  isClosed,
  activeTeamFilter,
  searchQuery,
  costItems,
  isUnfiltered,
  editingAdHoc,
  onToggleEditAdHoc,
  onUpdateCostItem,
  onDeleteCostItem,
  onAddCostItem,
  editingSchedule,
  onUpdateAllocation,
  onDeleteAllocation,
  onAddAllocation,
}: {
  groups: { name: string | null; colour: string; supplierId: string | null; rows: Allocation[] }[]
  expandedMap: Record<string, boolean>
  onToggle: (name: string | null) => void
  sort: SortState
  onSort: (col: SortableCol) => void
  vatPct: number
  isClosed: boolean
  searchQuery: string
  activeTeamFilter: string | null
  costItems: PlatformCostItem[]
  isUnfiltered: boolean
  editingAdHoc: boolean
  onToggleEditAdHoc: () => void
  onUpdateCostItem: (id: string, updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes'>>) => Promise<void>
  onDeleteCostItem: (id: string) => Promise<void>
  onAddCostItem: () => Promise<void>
  editingSchedule: boolean
  onUpdateAllocation: (id: string, updates: AllocationUpdates) => Promise<void>
  onDeleteAllocation: (id: string) => Promise<void>
  onAddAllocation: (supplierId: string | null, supplierName: string | null, supplierColour: string) => Promise<void>
}) {
  const footerLabel = activeTeamFilter
    ? `Filtered totals — ${activeTeamFilter} (proportional)`
    : 'Filtered totals'

  const footerBase = groups.reduce((s, g) => {
    return s + g.rows.reduce((rs, r) => {
      if (!isIncludedInBaseCost(r.planview_code)) return rs
      return rs + Math.round((r.base_total_pence ?? 0) * getCapacitySplit(r.teams, activeTeamFilter))
    }, 0)
  }, 0)

  const footerVat = groups.reduce((s, g) => {
    return s + g.rows.reduce((rs, r) => {
      if (!isIncludedInBaseCost(r.planview_code)) return rs
      return rs + Math.round((r.vat_total_pence ?? 0) * getCapacitySplit(r.teams, activeTeamFilter))
    }, 0)
  }, 0)

  const costItemsBase = costItems.reduce((s, item) => s + item.amount_pence, 0)
  const costItemsVat = costItems.reduce((s, item) => s + calcCostItemVat(item.amount_pence, item.vat_applies, vatPct), 0)

  return (
    <div className={styles.tableScroller}>
      <div className={styles.tableInner}>
        <HeaderRow sort={sort} onSort={onSort} isClosed={isClosed} />
        {groups.map((g) => {
          const expanded = expandedMap[g.name ?? ''] !== false
          const base = g.rows.reduce((s, r) => {
            if (!isIncludedInBaseCost(r.planview_code)) return s
            const split = getCapacitySplit(r.teams, activeTeamFilter)
            return s + Math.round((r.base_total_pence ?? 0) * split)
          }, 0)
          const vat = g.rows.reduce((s, r) => {
            if (!isIncludedInBaseCost(r.planview_code)) return s
            const split = getCapacitySplit(r.teams, activeTeamFilter)
            return s + Math.round((r.vat_total_pence ?? 0) * split)
          }, 0)
          const days = g.rows.reduce((s, r) => {
            if (!isIncludedInBaseCost(r.planview_code)) return s
            const split = getCapacitySplit(r.teams, activeTeamFilter)
            return s + (r.capacity_days ?? 0) * (r.utilisation_percent / 100) * split
          }, 0)
          return (
            <SupplierSection
              key={g.name ?? '__vacant__'}
              name={g.name}
              colour={g.colour}
              supplierId={g.supplierId}
              rows={g.rows}
              expanded={expanded}
              onToggle={() => onToggle(g.name)}
              base={base}
              vat={vat}
              days={days}
              vatPct={vatPct}
              activeTeamFilter={activeTeamFilter}
              searchQuery={searchQuery}
              editingSchedule={editingSchedule}
              onUpdateAllocation={onUpdateAllocation}
              onDeleteAllocation={onDeleteAllocation}
              onAddAllocation={onAddAllocation}
            />
          )
        })}
        {isUnfiltered && <AdHocSection
          items={costItems}
          editingAdHoc={editingAdHoc}
          onToggleEditAdHoc={onToggleEditAdHoc}
          onUpdate={onUpdateCostItem}
          onDelete={onDeleteCostItem}
          onAdd={onAddCostItem}
          vatPct={vatPct}
          isClosed={isClosed}
        />}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: SCHEDULE_COLS,
            padding: COL_PADDING,
            background: '#F5F5F5',
            borderTop: '2px solid #E0E0E0',
          }}
        >
          <div
            className={styles.bandLeft}
            style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#404044' }}
          >
            {footerLabel}
          </div>
          <div style={{ gridColumn: 10 }}>
            <BandTotal label="Base" value={formatMoney(footerBase + (isUnfiltered ? costItemsBase : 0))} />
          </div>
          <div style={{ gridColumn: 11 }}>
            <BandTotal label="+VAT" value={formatMoney(footerVat + (isUnfiltered ? costItemsVat : 0))} />
          </div>
        </div>
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
      <Th label="Base" col="total" sort={sort} onSort={onSort} align="right" />
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
  supplierId,
  rows,
  expanded,
  onToggle,
  base,
  vat,
  days,
  vatPct,
  activeTeamFilter,
  searchQuery,
  editingSchedule,
  onUpdateAllocation,
  onDeleteAllocation,
  onAddAllocation,
}: {
  name: string | null
  colour: string
  supplierId: string | null
  rows: Allocation[]
  expanded: boolean
  onToggle: () => void
  base: number
  vat: number
  days: number
  vatPct: number
  activeTeamFilter: string | null
  searchQuery: string
  editingSchedule: boolean
  onUpdateAllocation: (id: string, updates: AllocationUpdates) => Promise<void>
  onDeleteAllocation: (id: string) => Promise<void>
  onAddAllocation: (supplierId: string | null, supplierName: string | null, supplierColour: string) => Promise<void>
}) {
  const isRMG = name === RMG_SUPPLIER_NAME
  const tint = isRMG ? withAlpha(colour, '08') : withAlpha(colour, '0F')
  const pillTextColour = getTextColour(colour)
  const weightedAvgDayRate = days > 0 ? (base / 100) / days : 0

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
        <div className={styles.bandLeft} style={{ gridColumn: '1 / span 8' }}>
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
            {name ?? 'Vacant / TBC'}
          </span>
          <span style={{ fontSize: 12, color: '#8F9495' }}>
            {rows.length} {rows.length === 1 ? 'resource' : 'resources'}
          </span>
        </div>
        <div
          style={{
            gridColumn: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '10px 8px 10px 0',
          }}
        >
          {days > 0 ? (
            <>
              <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--rmg-color-grey-1)', marginRight: '4px' }}>
                avg./day
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rmg-color-text-heading)' }}>
                £{weightedAvgDayRate.toFixed(2)}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--rmg-color-grey-1)' }}>—</span>
          )}
        </div>
        <div className={styles.bandMobileRow}>
          <div
            style={{
              gridColumn: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMoney(base)}
          </div>
          <div
            style={{
              gridColumn: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMoney(vat)}
          </div>
        </div>
      </div>

      {expanded &&
        rows.map((r) => (
          <AllocationRow
            key={r.allocation_id}
            row={r}
            vatPct={vatPct}
            activeTeamFilter={activeTeamFilter}
            searchQuery={searchQuery}
            editingSchedule={editingSchedule}
            onUpdate={onUpdateAllocation}
            onDelete={onDeleteAllocation}
          />
        ))}
      {expanded && editingSchedule && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px dashed #E0E0E0',
          }}
        >
          <button
            type="button"
            onClick={() => onAddAllocation(supplierId, name, colour)}
            style={{
              background: 'transparent',
              border: '1px dashed #C0C0C0',
              borderRadius: 6,
              color: '#8F9495',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Add resource
          </button>
        </div>
      )}
    </div>
  )
}

/* ── AdHocSection ──────────────────────────────────────────────── */

const ADHOC_COLOUR = '#9CA3AF'
const ADHOC_PILL_BG = '#6B7280'

function AdHocSection({
  items,
  editingAdHoc,
  onToggleEditAdHoc,
  onUpdate,
  onDelete,
  onAdd,
  vatPct,
  isClosed,
}: {
  items: PlatformCostItem[]
  editingAdHoc: boolean
  onToggleEditAdHoc: () => void
  onUpdate: (id: string, updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAdd: () => Promise<void>
  vatPct: number
  isClosed: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const base = items.reduce((s, item) => s + item.amount_pence, 0)
  const vat = items.reduce((s, item) => s + calcCostItemVat(item.amount_pence, item.vat_applies, vatPct), 0)

  return (
    <div style={{ borderLeft: `3px solid ${ADHOC_COLOUR}` }}>
      <div
        className={styles.bandRow}
        style={{
          display: 'grid',
          gridTemplateColumns: SCHEDULE_COLS,
          padding: COL_PADDING,
          background: '#F3F4F6',
          cursor: 'pointer',
        }}
      >
        <div
          className={styles.bandLeft}
          style={{ gridColumn: '1 / span 8' }}
          onClick={() => setExpanded((v) => !v)}
        >
          <span
            style={{
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 120ms ease',
              color: ADHOC_COLOUR,
              display: 'inline-flex',
            }}
            aria-hidden
          >
            <ChevronSmall />
          </span>
          <span
            style={{
              background: ADHOC_PILL_BG,
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 6,
            }}
          >
            Ad-hoc Quarterly Expenses
          </span>
          <span style={{ fontSize: 12, color: '#8F9495' }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          {!isClosed && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleEditAdHoc() }}
              style={{
                marginLeft: 8,
                background: editingAdHoc ? ADHOC_COLOUR : 'transparent',
                color: editingAdHoc ? 'white' : ADHOC_COLOUR,
                border: `1px solid ${ADHOC_COLOUR}`,
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--rmg-font-body)',
              }}
            >
              {editingAdHoc ? 'Done' : 'Edit items'}
            </button>
          )}
        </div>
        <div className={styles.bandMobileRow}>
          <div
            style={{
              gridColumn: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMoney(base)}
          </div>
          <div
            style={{
              gridColumn: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMoney(vat)}
          </div>
        </div>
      </div>

      {expanded && items.map((item) => (
        <AdHocRow
          key={item.cost_item_id}
          item={item}
          editing={editingAdHoc}
          vatPct={vatPct}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}

      {expanded && editingAdHoc && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: SCHEDULE_COLS,
            padding: COL_PADDING,
            borderTop: '1px solid #EEEEEE',
          }}
        >
          <div style={{ gridColumn: '1 / span 11', padding: '8px 0' }}>
            <button
              type="button"
              onClick={onAdd}
              style={{
                background: 'transparent',
                border: `1px dashed ${ADHOC_COLOUR}`,
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: ADHOC_COLOUR,
                cursor: 'pointer',
                fontFamily: 'var(--rmg-font-body)',
              }}
            >
              + Add item
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AdHocRow({
  item,
  editing,
  vatPct,
  onUpdate,
  onDelete,
}: {
  item: PlatformCostItem
  editing: boolean
  vatPct: number
  onUpdate: (id: string, updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [labelValue, setLabelValue] = useState(item.label)
  const [amountValue, setAmountValue] = useState((item.amount_pence / 100).toFixed(2))
  useEffect(() => setLabelValue(item.label), [item.label])
  useEffect(() => setAmountValue((item.amount_pence / 100).toFixed(2)), [item.amount_pence])

  const vatTotal = calcCostItemVat(item.amount_pence, item.vat_applies, vatPct)

  if (!editing) {
    return (
      <div className={styles.allocationRow} style={{ gridTemplateColumns: SCHEDULE_COLS }}>
        <Cell><span style={{ fontSize: 13, fontWeight: 500, color: '#2A2A2D' }}>{item.label}</span></Cell>
        <Cell><span /></Cell>
        <Cell><span /></Cell>
        <Cell><span /></Cell>
        <Cell><span /></Cell>
        <Cell><span /></Cell>
        <Cell><span /></Cell>
        <Cell align="right"><span /></Cell>
        <Cell align="right"><span /></Cell>
        <Cell align="right" dataLabel="Base">
          <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {formatMoney(item.amount_pence)}
          </span>
        </Cell>
        <Cell align="right" dataLabel="+VAT">
          <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: item.vat_applies ? '#2A2A2D' : '#8F9495' }}>
            {formatMoney(vatTotal)}
          </span>
        </Cell>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: SCHEDULE_COLS,
        padding: COL_PADDING,
        borderTop: '1px solid #EEEEEE',
        background: 'rgba(243,146,13,0.03)',
      }}
    >
      <div style={{ gridColumn: '1 / span 5', padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={labelValue}
          onChange={(e) => setLabelValue(e.target.value)}
          onBlur={() => { if (labelValue !== item.label) onUpdate(item.cost_item_id, { label: labelValue }) }}
          style={{
            width: '100%',
            border: '1px solid #D5D5D5',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: 'var(--rmg-font-body)',
            color: '#2A2A2D',
          }}
        />
      </div>
      <div style={{ gridColumn: '6 / span 4', padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#8F9495', flexShrink: 0 }}>£</span>
        <input
          type="number"
          value={amountValue}
          step="0.01"
          min="0"
          onChange={(e) => setAmountValue(e.target.value)}
          onBlur={() => {
            const pence = Math.round(parseFloat(amountValue) * 100)
            if (!isNaN(pence) && pence !== item.amount_pence) onUpdate(item.cost_item_id, { amount_pence: pence })
          }}
          style={{
            width: '80px',
            border: '1px solid #D5D5D5',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: 'var(--rmg-font-body)',
            color: '#2A2A2D',
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={item.vat_applies}
            onChange={(e) => onUpdate(item.cost_item_id, { vat_applies: e.target.checked })}
          />
          +VAT
        </label>
      </div>
      <div style={{ gridColumn: 11, padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => onDelete(item.cost_item_id)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#DA202A',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--rmg-font-body)',
            padding: '2px 6px',
          }}
        >
          Remove
        </button>
      </div>
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

const nullStyle: React.CSSProperties = {
  color: 'var(--rmg-color-text-subtle, #9CA3AF)',
  fontStyle: 'italic',
  fontSize: '13px',
  fontWeight: 400,
}

const editInputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #D5D5D5',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 12,
  fontFamily: 'var(--rmg-font-body)',
  color: '#2A2A2D',
  background: '#fff',
}

function AllocationRow({
  row,
  vatPct,
  activeTeamFilter,
  searchQuery,
  editingSchedule,
  onUpdate,
  onDelete,
}: {
  row: Allocation
  vatPct: number
  activeTeamFilter: string | null
  searchQuery: string
  editingSchedule: boolean
  onUpdate: (id: string, updates: AllocationUpdates) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [pendingDelete, setPendingDelete] = useState(false)
  const [roleValue, setRoleValue] = useState(row.role_title ?? '')
  const [dayRateValue, setDayRateValue] = useState(String(row.day_rate / 100))
  const [daysValue, setDaysValue] = useState(String(row.capacity_days ?? 0))
  const [utilValue, setUtilValue] = useState(String(row.utilisation_percent))
  useEffect(() => { setRoleValue(row.role_title ?? '') }, [row.role_title])
  useEffect(() => { setDayRateValue(String(row.day_rate / 100)) }, [row.day_rate])
  useEffect(() => { setDaysValue(String(row.capacity_days ?? 0)) }, [row.capacity_days])
  useEffect(() => { setUtilValue(String(row.utilisation_percent)) }, [row.utilisation_percent])

  const plan = row.planview_code
  const isFGov = plan === 'F_Gov'
  const isBAU = plan === 'BAU'
  const planLabel = plan === 'F_Gov' ? 'F_GOV' : (plan ?? '—')
  const planStyle = getPlanBadgeStyle(plan)
  const utilColour = getUtilColour(row.utilisation_percent)
  const locColour = getLocationColour(row.resource_location)
  const tbc = !row.resource_name

  const rawDays = row.capacity_days ?? 0
  const rawBase = row.base_total_pence ?? Math.round(row.day_rate * rawDays * (row.utilisation_percent / 100))
  const vatApplies = row.vat_applies !== false
  const rawVat = row.vat_total_pence ?? (vatApplies ? Math.round(rawBase * (1 + vatPct / 100)) : rawBase)

  const split = getCapacitySplit(row.teams, activeTeamFilter)
  const isProportional = split < 1.0

  const displayDays = isProportional ? rawDays * split : rawDays
  const displayBase = isProportional ? Math.round(rawBase * split) : rawBase
  const displayVat = isProportional ? Math.round(rawVat * split) : rawVat

  const rowBg = isFGov
    ? 'rgba(243,146,13,0.035)'
    : isBAU
      ? 'rgba(143,148,149,0.035)'
      : 'transparent'

  const teams = row.teams ?? []

  if (editingSchedule && pendingDelete) {
    return (
      <div
        className={styles.allocationRow}
        style={{ gridTemplateColumns: SCHEDULE_COLS, background: '#FFF5F5' }}
      >
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px' }}>
          <span style={{ fontSize: 13, color: '#DA202A', fontWeight: 500 }}>
            Delete {row.resource_name ?? row.role_title ?? 'this resource'}?
          </span>
          <button
            type="button"
            onClick={() => onDelete(row.allocation_id)}
            style={{ background: '#DA202A', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--rmg-font-body)' }}
          >
            Yes, delete
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(false)}
            style={{ background: 'transparent', color: '#555', border: '1px solid #D5D5D5', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--rmg-font-body)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (editingSchedule) {
    return (
      <div
        className={styles.allocationRow}
        style={{ gridTemplateColumns: SCHEDULE_COLS, background: rowBg, outline: '1px solid #E8E8E8' }}
      >
        {/* 1 Resource + delete */}
        <Cell>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: tbc ? 'var(--rmg-color-grey-1)' : '#2A2A2D', fontStyle: tbc ? 'italic' : 'normal', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tbc ? 'TBC' : row.resource_name}
            </span>
            <button
              type="button"
              onClick={() => setPendingDelete(true)}
              title="Delete row"
              style={{ background: 'transparent', border: 'none', color: '#DA202A', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        </Cell>
        {/* 2 Role */}
        <Cell>
          <input
            type="text"
            value={roleValue}
            onChange={(e) => setRoleValue(e.target.value)}
            onBlur={() => { if (roleValue !== (row.role_title ?? '')) onUpdate(row.allocation_id, { role_title: roleValue || null }) }}
            placeholder="Role title"
            style={editInputStyle}
          />
        </Cell>
        {/* 3 Team — read-only */}
        <Cell>
          {teams.length === 0 ? (
            <span style={nullStyle}>No Team</span>
          ) : (
            <span style={{ fontSize: '13px', color: '#555' }}>{teams.map((t) => t.teamName).join(', ')}</span>
          )}
        </Cell>
        {/* 4 Utilisation */}
        <Cell>
          <input
            type="number"
            value={utilValue}
            min="0"
            max="100"
            onChange={(e) => setUtilValue(e.target.value)}
            onBlur={() => {
              const v = Math.min(100, Math.max(0, parseFloat(utilValue) || 0))
              if (v !== row.utilisation_percent) onUpdate(row.allocation_id, { utilisation_percent: v })
            }}
            style={{ ...editInputStyle, width: '52px' }}
          />
        </Cell>
        {/* 5 Plan */}
        <Cell>
          <select
            value={plan ?? 'BAU'}
            onChange={(e) => onUpdate(row.allocation_id, { planview_code: e.target.value as Allocation['planview_code'] })}
            style={{ ...editInputStyle, width: 'auto' }}
          >
            <option value="PR">PR</option>
            <option value="F_Gov">F_GOV</option>
            <option value="BAU">BAU</option>
            <option value="ETP">ETP</option>
          </select>
        </Cell>
        {/* 6 Chargeable — computed */}
        <Cell>
          <span
            style={{
              display: 'inline-block',
              background: isChargeableRow(plan) ? '#C1E3C1' : '#EEEEEE',
              color: isChargeableRow(plan) ? '#1A6B00' : '#8F9495',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {isChargeableRow(plan) ? 'Chargeable' : 'Not charged'}
          </span>
        </Cell>
        {/* 7 Location — read-only */}
        <Cell>
          {row.resource_location ? (
            <span style={{ fontSize: 13, color: '#555', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: locColour, display: 'inline-block', flexShrink: 0 }} />
              {toTitle(row.resource_location)}
            </span>
          ) : (
            <span style={nullStyle}>—</span>
          )}
        </Cell>
        {/* 8 Days */}
        <Cell align="right">
          <input
            type="number"
            value={daysValue}
            min="0"
            onChange={(e) => setDaysValue(e.target.value)}
            onBlur={() => {
              const v = Math.max(0, parseFloat(daysValue) || 0)
              if (v !== (row.capacity_days ?? 0)) onUpdate(row.allocation_id, { capacity_days: v })
            }}
            style={{ ...editInputStyle, width: '52px', textAlign: 'right' }}
          />
        </Cell>
        {/* 9 Day Rate */}
        <Cell align="right">
          <input
            type="number"
            value={dayRateValue}
            min="0"
            step="0.01"
            onChange={(e) => setDayRateValue(e.target.value)}
            onBlur={() => {
              const pence = Math.round((parseFloat(dayRateValue) || 0) * 100)
              if (pence !== row.day_rate) onUpdate(row.allocation_id, { day_rate: pence })
            }}
            style={{ ...editInputStyle, width: '72px', textAlign: 'right' }}
          />
        </Cell>
        {/* 10 Base — computed */}
        <Cell align="right" dataLabel="Base">
          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#8F9495' }}>
            {formatMoney(displayBase)}
          </span>
        </Cell>
        {/* 11 +VAT — checkbox + computed */}
        <Cell align="right" dataLabel="+VAT">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: '#555' }}>
            <input
              type="checkbox"
              checked={vatApplies}
              onChange={(e) => onUpdate(row.allocation_id, { vat_applies: e.target.checked })}
            />
            <span style={{ fontVariantNumeric: 'tabular-nums', color: vatApplies ? '#2A2A2D' : '#8F9495' }}>
              {formatMoney(displayVat)}
            </span>
          </label>
        </Cell>
      </div>
    )
  }

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
          <span style={nullStyle}>TBC</span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, color: '#2A2A2D' }}>
            {highlightMatch(row.resource_name!, searchQuery)}
          </span>
        )}
      </Cell>

      {/* 2 Role */}
      <Cell>
        {row.role_title ? (
          <span style={{ fontSize: 13, color: '#333' }}>
            {highlightMatch(row.role_title, searchQuery)}
          </span>
        ) : (
          <span style={nullStyle}>—</span>
        )}
      </Cell>

      {/* 3 Team */}
      <Cell>
        {teams.length === 0 ? (
          <span style={nullStyle}>No Team</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {teams.map((t) => (
              <span
                key={t.teamId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '100px',
                  padding: '2px 10px',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: '#EBF6FC',
                  color: '#005F8A',
                  border: '1px solid #B8DFF2',
                  opacity:
                    activeTeamFilter &&
                    activeTeamFilter !== 'All' &&
                    t.teamName !== activeTeamFilter
                      ? 0.45
                      : 1,
                }}
              >
                {t.teamName} · {Math.round(t.capacitySplit * 100)}%
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
            letterSpacing: '0.06em',
          }}
        >
          {planLabel}
        </span>
      </Cell>

      {/* 6 Chargeable */}
      <Cell>
        <span
          style={{
            display: 'inline-block',
            background: isChargeableRow(plan) ? '#C1E3C1' : '#EEEEEE',
            color: isChargeableRow(plan) ? '#1A6B00' : '#8F9495',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {isChargeableRow(plan) ? 'Chargeable' : 'Not charged'}
        </span>
      </Cell>

      {/* 7 Location */}
      <Cell>
        {tbc || !row.resource_location ? (
          <span style={nullStyle}>—</span>
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
        {!isProportional && row.capacity_days === null ? (
          <span style={nullStyle}>—</span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {isProportional ? displayDays.toFixed(1) : row.capacity_days}
          </span>
        )}
      </Cell>

      {/* 9 Day Rate */}
      <Cell align="right" dataLabel="Day Rate">
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {formatMoney(row.day_rate, { decimals: 2 })}
        </span>
      </Cell>

      {/* 10 Base */}
      <Cell align="right" dataLabel="Base">
        <span
          style={{
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            color: displayBase === 0
              ? 'var(--rmg-color-text-subtle, #9CA3AF)'
              : 'var(--rmg-color-text-body)',
          }}
        >
          {formatMoney(displayBase)}
        </span>
      </Cell>

      {/* 11 +VAT */}
      <Cell align="right" dataLabel="+VAT">
        <span
          style={{
            fontSize: 13,
            fontVariantNumeric: 'tabular-nums',
            color: displayVat === 0
              ? 'var(--rmg-color-text-subtle, #9CA3AF)'
              : 'var(--rmg-color-text-body)',
          }}
        >
          {formatMoney(displayVat)}
        </span>
      </Cell>
    </div>
  )
}

function Cell({
  children,
  align,
  dataLabel,
}: {
  children: React.ReactNode
  align?: 'right'
  dataLabel?: string
}) {
  return (
    <div
      data-label={dataLabel}
      className={styles.cell}
      style={{
        padding: '9px 8px 9px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  )
}

/* ── Buttons / icons ───────────────────────────────────────────── */

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

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

