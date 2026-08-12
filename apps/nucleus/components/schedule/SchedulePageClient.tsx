'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { EyeOff, AlertTriangle, CircleCheck, Pencil, Copy } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { usePrivacyMode } from '@/context/PrivacyModeContext'
import { SortableRow } from './SortableRow'
import type {
  SchedulePageData,
  ScheduleAllocation,
  TeamAssignment,
  PlatformCostItem,
  ResourceLocation,
} from '@plato/schema'
import { getSupabaseBrowserClient, computeUnallocatedPct, selectDefaultPeriod } from '@plato/schema'
import {
  PageToolbar,
  PageToolbarSearch,
  PageToolbarFilterPill,
  PageToolbarExpandButton,
  PageToolbarResourceCount,
  PageToolbarPrimaryActions,
  PeriodContextStrip,
  LoadingOverlay,
  useLoadingOverlay,
  Notification,
} from '@plato/ui'
import type { PeriodOption } from '@plato/ui'
import {
  togglePeriodLocked,
  batchUpdateDisplayOrder,
  unassignResourceFromAllocation,
} from '@/app/actions/schedule'
import { CustomSelect } from '../ui/CustomSelect'
import { AddResourceWizard } from './AddResourceWizard'
import { CreatePeriodWizard } from './CreatePeriodWizard'
import type { WizardSuccessPayload, AssignModeConfig } from './AddResourceWizard'
import { EditTeamsModal } from './EditTeamsModal'
import type { EditTeamsTarget } from './EditTeamsModal'
import { ExportCurrentViewModal } from './ExportCurrentViewModal'
import type { ExportRow } from '@/lib/schedule/exportView'
import { workingDaysBetween } from '@/lib/schedule/format'
import { getRateEditability } from '@/lib/rates/editability'
import { setBlendedRate, updateCostConfiguration } from '@/app/actions/rates'
import { decideRateUpsert, type ExistingCostConfigRow } from '@/lib/rates/upsertDecision'
import { ConfirmDialog } from '../rates/ConfirmDialog'
import { calcCostItemVat } from '@/lib/schedule/costItems'
import { highlightMatch } from '@/lib/schedule/highlightMatch'
import { getCapacitySplit } from '@/lib/scheduleUtils'
import {
  formatMoney,
  getUtilColour,
  isIncludedInBaseCost,
  isChargeableRow,
  withDerivedChargeable,
  PLANVIEW_CODES,
  getLocationColour,
  getPlanBadgeStyle,
  getTextColour,
  withAlpha,
  sortAllocations as sortByColumn,
  sumFilteredDays,
  formatDaysTotal,
  calculateConfirmedCount,
  type SortableCol,
  type SortDir,
} from '@/lib/schedule/ui'
import styles from './schedule.module.css'

type Props = { data: SchedulePageData }

// 12-column layout. Confirmed is now visible in both view and edit mode
// (a read-only status icon in view mode, an editable checkbox in edit
// mode), so the whole resource-allocation table — header, supplier band
// rows, allocation rows, and the footer bar — always uses the 13-column
// RESOURCE_TABLE_COLS below instead. SCHEDULE_COLS survives only because
// the unrelated AdHoc/ETP-SS cost-item sections still use it — those have
// no Confirmed column and were never part of this feature.
const SCHEDULE_COLS = '24px 14% 14% 10% 8% 6% 8% 8% 5% 8% 8% 8%'

// The one column definition for the resource-allocation table, used
// unconditionally by both view and edit mode so the two can never drift
// apart again the way they briefly did when Confirmed was edit-mode-only.
// Column indices 1-12 (Handle..+VAT) match SCHEDULE_COLS's order, with
// widths trimmed slightly to make room for column 13 (Confirmed).
const RESOURCE_TABLE_COLS = '24px 12% 12% 8% 7% 6% 7% 7% 5% 8% 7% 7% 8%'

// Matches HEADER_HEIGHT in packages/ui/components/shell/PlatoShell.tsx —
// the fixed global header the sticky toolbar must clear.
const PLATO_SHELL_HEADER_HEIGHT = 40

const COL_PADDING = '0 16px 0 12px'

const RMG_SUPPLIER_NAME = 'Royal Mail Group'

// UK date, e.g. "1 Jul 2026" — used in the Applied Blended Rate update-confirm copy.
// timeZone pinned to UTC so a date-only ISO string (e.g. period_start_date)
// never shifts a day depending on the viewer's local timezone.
const UK_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
function formatUkDate(iso: string): string {
  return UK_DATE.format(new Date(iso))
}

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
  // Default sort is null so rows render in their persisted display_order on load.
  // Clicking a column header applies a session-only sort (never written to DB).
  const [sort, setSort] = useState<SortState>({ col: null, dir: 'asc' })
  // Shared error banner for allocation-table writes (reorder, and any
  // per-row field update including Confirmed) — one mechanism, not one per
  // field, so failures always surface the same way.
  const [allocationError, setAllocationError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [localCostItems, setLocalCostItems] = useState<PlatformCostItem[]>(initialCostItems)
  const [editingAdHoc, setEditingAdHoc] = useState(false)
  const [editingEtpSs, setEditingEtpSs] = useState(false)
  const [localAllocations, setLocalAllocations] = useState<Allocation[]>(() => rawAllocations as Allocation[])
  const [editingSchedule, setEditingSchedule] = useState(false)
  // Applied blended rate held in local state so a rate edit recomputes the
  // rate-derived KPIs through the same optimistic-state path as every other
  // inline edit on this page — not a separate router refetch.
  const [localBlendedRatePence, setLocalBlendedRatePence] = useState<number | null>(
    costConfig?.blended_day_rate_override ?? null,
  )
  // Editability is driven solely by the period's locked flag (not status).
  const [isLocked, setIsLocked] = useState(period.locked)
  const [lockPending, setLockPending] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardSupplier, setWizardSupplier] = useState<{
    supplierId: string | null
    supplierName: string | null
    supplierColour: string
  } | null>(null)
  const [assignWizardTarget, setAssignWizardTarget] = useState<AssignModeConfig | null>(null)
  const [exportViewOpen, setExportViewOpen] = useState(false)
  const [createPeriodOpen, setCreatePeriodOpen] = useState(false)

  // The most recent existing period drives the Create-New-Period pre-fill and
  // is the copy-forward source. Derived from the full period list (latest by
  // end date) so it's correct even when viewing an older period.
  const latestPeriod = useMemo(() => selectDefaultPeriod(allPeriods) ?? null, [allPeriods])
  useEffect(() => {
    setLocalAllocations(rawAllocations as Allocation[])
    setLocalCostItems(initialCostItems)
    setEditingSchedule(false)
    setEditingAdHoc(false)
    setEditingEtpSs(false)
    setIsLocked(period.locked)
    setLocalBlendedRatePence(costConfig?.blended_day_rate_override ?? null)
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

  // Tracks whether the sticky toolbar has scrolled away from its natural
  // resting position, so we can show a "now floating" shadow only then.
  const toolbarSentinelRef = useRef<HTMLDivElement>(null)
  const [toolbarStuck, setToolbarStuck] = useState(false)
  useEffect(() => {
    const sentinel = toolbarSentinelRef.current
    if (!sentinel) return

    function findScrollAncestor(el: HTMLElement): HTMLElement | null {
      let node = el.parentElement
      while (node) {
        if (/(auto|scroll)/.test(window.getComputedStyle(node).overflowY)) return node
        node = node.parentElement
      }
      return null
    }

    const scrollAncestor = findScrollAncestor(sentinel)
    const scrollTarget: HTMLElement | Window = scrollAncestor ?? window

    function handleScroll() {
      setToolbarStuck(sentinel!.getBoundingClientRect().top <= PLATO_SHELL_HEADER_HEIGHT)
    }

    handleScroll()
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollTarget.removeEventListener('scroll', handleScroll)
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
      if (teamFilter === 'no-team') {
        if ((a.teams ?? []).length > 0) return false
      } else if (teamFilter !== 'all') {
        if (!(a.teams ?? []).some((t) => t.teamName === teamFilter || t.teamId === teamFilter)) return false
      }
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
        // Base order = persisted manual display_order (NULLS LAST, then name).
        // A session column sort, when active, is layered on top.
        rows: sortByColumn([...rows].sort(byDisplayOrder), sort.col, sort.dir),
      }))
      .sort((a, b) => {
        const sa = a.sortOrder ?? Infinity
        const sb = b.sortOrder ?? Infinity
        if (sa !== sb) return sa - sb
        return (a.name ?? '').localeCompare(b.name ?? '')
      })
  }, [filtered, sort])

  // Flattened, on-screen order (supplier grouping + persisted display_order +
  // any active column sort already applied) — the "current filtered view" the
  // export modal snapshots. Read-only: sorting inside the modal never writes
  // back here.
  const exportRows = useMemo<ExportRow[]>(
    () =>
      groupedBySupplier.flatMap((g) =>
        g.rows.map((r) => ({
          allocation_id: r.allocation_id,
          resource_name: r.resource_name,
          role_title: r.role_title,
          resource_location: r.resource_location,
          capacity_days: r.capacity_days,
          base_total_pence: r.base_total_pence,
          teams: (r.teams as unknown as TeamAssignment[] | undefined) ?? [],
        })),
      ),
    [groupedBySupplier],
  )

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
    const vatMultiplier = 1 + vatPct / 100

    // Split cost items by category
    const adHocItems = localCostItems.filter((i) => i.cost_item_category === 'ADHOC')
    const etpAndSsItems = localCostItems.filter(
      (i) => i.cost_item_category === 'ETP' || i.cost_item_category === 'SHARED_SERVICES',
    )

    // adHocVat: only ADHOC items (with VAT applied per item's vat_applies flag)
    const adHocVat = adHocItems.reduce((sum, item) => {
      const base = item.amount_pence
      return sum + (item.vat_applies ? Math.round(base * vatMultiplier) : base)
    }, 0)

    // ETP + SS total: read directly from DB rows (VAT already embedded in ETP figure)
    const etpAndSsPence = etpAndSsItems.reduce((sum, i) => sum + i.amount_pence, 0)

    // Platform total WITHOUT ETP+SS (allocations + VAT + ad-hoc only)
    const totalPlatform = allocsVat + adHocVat

    // Platform total WITH ETP+SS
    const totalPlatformIncEtp = totalPlatform + etpAndSsPence
    const chargeableDays = localAllocations
      .filter((a) => isChargeableRow(a.planview_code))
      .reduce((s, a) => s + (a.capacity_days ?? 0) * (a.utilisation_percent / 100), 0)
    const calcRatePence = chargeableDays > 0 ? totalPlatform / chargeableDays : 0
    const calcRateIncEtp = chargeableDays > 0 ? totalPlatformIncEtp / chargeableDays : 0
    return {
      allocsBase,
      allocsVat,
      adHocVat,
      etpAndSsPence,
      totalPlatform,
      totalPlatformIncEtp,
      chargeableDays,
      calcRatePence,
      calcRateIncEtp,
      headcount: localAllocations.length,
    }
  }, [localAllocations, localCostItems, vatPct])

  // costConfig with the locally-edited blended rate folded in, so every reader
  // (KPI cards, team run-rate) reflects an in-session rate change immediately.
  const effectiveCostConfig = useMemo(
    () => (costConfig ? { ...costConfig, blended_day_rate_override: localBlendedRatePence } : costConfig),
    [costConfig, localBlendedRatePence],
  )

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

  async function handleToggleLocked() {
    if (lockPending) return
    const next = !isLocked
    setLockPending(true)
    try {
      const res = await togglePeriodLocked(period.period_id, next)
      setIsLocked(res.locked)
    } catch (err) {
      // On error leave isLocked unchanged so the UI reflects the true state.
      console.error('Failed to toggle period lock:', err)
    } finally {
      setLockPending(false)
    }
  }

  async function refetchCostItems() {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase
      .from('platform_cost_items')
      .select('cost_item_id, label, amount_pence, vat_applies, sort_order, notes, cost_item_category')
      .eq('period_id', period.period_id)
      .is('deleted_at', null)
      .order('sort_order')
    if (data) setLocalCostItems(data as PlatformCostItem[])
  }

  async function handleUpdateCostItem(
    id: string,
    updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes' | 'cost_item_category'>>,
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
      cost_item_category: 'ADHOC',
    })
    await refetchCostItems()
  }

  async function handleAddEtpSsItem() {
    const supabase = getSupabaseBrowserClient()
    const maxSort = localCostItems.length > 0
      ? Math.max(...localCostItems.map((i) => i.sort_order))
      : 0
    // ETP/SS items embed VAT in their amount, so vat_applies is always false.
    await supabase.from('platform_cost_items').insert({
      period_id: period.period_id,
      label: 'New item',
      amount_pence: 0,
      vat_applies: false,
      sort_order: maxSort + 1,
      notes: null,
      cost_item_category: 'ETP',
    })
    await refetchCostItems()
  }

  async function handleUpdateAllocation(id: string, updates: AllocationUpdates) {
    const finalUpdates = withDerivedChargeable(updates)
    const previous = localAllocations
    setLocalAllocations((prev) => prev.map((a) => {
      if (a.allocation_id !== id) return a
      const next = { ...a, ...finalUpdates }
      const days = next.capacity_days ?? 0
      const base = Math.round(next.day_rate * days * (next.utilisation_percent / 100))
      const vatApplies = next.vat_applies !== false
      const vat = vatApplies ? Math.round(base * (1 + vatPct / 100)) : base
      return { ...next, base_total_pence: base, vat_total_pence: vat }
    }))
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from('resource_period_allocations').update(finalUpdates).eq('allocation_id', id)
    if (error) {
      // Revert optimistic state and tell the user — same pattern as handleReorder.
      setLocalAllocations(previous)
      setAllocationError(error.message || 'Could not save the change. Please try again.')
    }
  }

  async function handleDeleteAllocation(id: string) {
    setLocalAllocations((prev) => prev.filter((a) => a.allocation_id !== id))
    const supabase = getSupabaseBrowserClient()
    await supabase
      .from('resource_period_allocations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('allocation_id', id)
  }

  function handleAssignSuccess(allocationId: string, _resourceId: string | null, resourceName: string | null): void {
    setLocalAllocations((prev) =>
      prev.map((a) => a.allocation_id === allocationId ? { ...a, resource_name: resourceName } : a),
    )
  }

  function handleOpenAssignWizard(allocationId: string, roleTitle: string, supplierId: string | null, supplierName: string | null, resourceLocation: ResourceLocation | null, seat?: { capacityDays: number | null; dayRate: number; teamNames: string[] }): void {
    setAssignWizardTarget({ allocationId, roleTitle, supplierId, supplierName, resourceLocation, capacityDays: seat?.capacityDays ?? null, dayRate: seat?.dayRate, teamNames: seat?.teamNames })
  }

  async function handleUnassignResource(allocationId: string): Promise<void> {
    const target = localAllocations.find((a) => a.allocation_id === allocationId)
    const prevName = target?.resource_name ?? null
    setLocalAllocations((prev) =>
      prev.map((a) => a.allocation_id === allocationId ? { ...a, resource_name: null } : a),
    )
    const result = await unassignResourceFromAllocation(allocationId)
    if (!result.success) {
      setLocalAllocations((prev) =>
        prev.map((a) => a.allocation_id === allocationId ? { ...a, resource_name: prevName } : a),
      )
    }
  }

  const [editTeamsTarget, setEditTeamsTarget] = useState<EditTeamsTarget | null>(null)

  function handleOpenEditTeams(
    allocationId: string,
    resourceId: string | null,
    resourceName: string,
    currentTeams: TeamAssignment[],
  ) {
    setEditTeamsTarget({ allocationId, resourceId, resourceName, currentTeams })
  }

  function handleEditTeamsSave(allocationId: string, newTeams: TeamAssignment[]) {
    const teams = newTeams as unknown as Allocation['teams']
    const unallocatedPct = computeUnallocatedPct(newTeams)
    setLocalAllocations((prev) =>
      prev.map((a) => a.allocation_id === allocationId ? { ...a, teams, unallocatedPct } : a),
    )
  }

  function handleOpenWizard(
    supplierId: string | null,
    supplierName: string | null,
    supplierColour: string,
  ): Promise<void> {
    setWizardSupplier({ supplierId, supplierName, supplierColour })
    setWizardOpen(true)
    return Promise.resolve()
  }

  function handleWizardSuccess(data: WizardSuccessPayload) {
    if (data.isTeamEdit || !data.allocationId) {
      setWizardOpen(false)
      setWizardSupplier(null)
      return
    }
    // Allocation.teams is typed as TeamAssignment[] & string[] via the local intersection
    // type. Assign via cast so both the filter logic (TeamAssignment[]) and the type
    // definition (& string[]) are satisfied without widening to any.
    const teams = data.teams.map((t) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      capacitySplit: 1.0,
    })) as unknown as Allocation['teams']
    const newAlloc: Allocation = {
      allocation_id: data.allocationId,
      resource_id: data.resourceId ?? null,
      resource_name: data.resourceName,
      role_title: data.roleTitle,
      supplier_id: data.supplierId,
      supplier_name: data.supplierName,
      supplier_colour: data.supplierColour,
      supplier_sort_order: data.supplierSortOrder,
      resource_location: data.resourceLocation,
      planview_code: data.planviewCode,
      day_rate: 0,
      utilisation_percent: 100,
      capacity_days: 0,
      is_chargeable: false,
      vat_applies: true,
      is_confirmed: false,
      teams,
      base_total_pence: 0,
      vat_total_pence: 0,
      display_order: data.displayOrder,
    }
    setLocalAllocations((prev) => [...prev, newAlloc])
    setWizardOpen(false)
    setWizardSupplier(null)
  }

  /**
   * Persist a manual reorder of one supplier group. `orderedIds` is the new
   * top-to-bottom order of allocation ids within that group. Updates local
   * state optimistically (re-numbering display_order from 1), persists to the
   * DB, and reverts + surfaces an error notification if the write fails.
   */
  async function handleReorder(orderedIds: string[]) {
    if (orderedIds.length === 0) return
    const previous = localAllocations
    const orderMap = new Map(orderedIds.map((id, index) => [id, index + 1]))

    setLocalAllocations((prev) =>
      prev.map((a) =>
        orderMap.has(a.allocation_id)
          ? { ...a, display_order: orderMap.get(a.allocation_id)! }
          : a,
      ),
    )

    const updates = orderedIds.map((id, index) => ({
      allocationId: id,
      displayOrder: index + 1,
    }))
    const res = await batchUpdateDisplayOrder(updates)
    if (!res.success) {
      // Revert optimistic state and tell the user.
      setLocalAllocations(previous)
      setAllocationError(res.error ?? 'Could not save the new row order. Please try again.')
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
      <PageHeader onCreateNewPeriod={() => setCreatePeriodOpen(true)} />

      {allocationError && (
        <div style={{ marginBottom: 12 }}>
          <Notification
            variant="banner"
            status="error"
            message={allocationError}
            paddingX={16}
            onDismiss={() => setAllocationError(null)}
          />
        </div>
      )}

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
        locked={isLocked}
        onLockToggle={handleToggleLocked}
        lockPending={lockPending}
        onExport={handleExportToExcel}
      />

      <KpiStrip
        totals={totals}
        costConfig={effectiveCostConfig}
        period={period}
        locked={isLocked}
        onRateSaved={(pence) => setLocalBlendedRatePence(pence)}
      />

      <div ref={toolbarSentinelRef} />
      <div
        style={{
          marginBottom: 14,
          position: 'sticky',
          // PlatoShell's global header is a fixed 40px bar (zIndex 100) above
          // everything — stick just below it, not behind it.
          top: PLATO_SHELL_HEADER_HEIGHT,
          zIndex: 10,
          boxShadow: toolbarStuck ? 'var(--rmg-shadow-header)' : 'none',
          transition: 'box-shadow 120ms ease',
        }}
      >
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
              <CustomSelect
                label="Planview"
                value={planviewFilter}
                onChange={setPlanviewFilter}
                options={[{ value: 'all', label: 'All' }, ...PLANVIEW_CODES]}
              />
              <CustomSelect
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
              <CustomSelect
                label="Team"
                value={teamFilter}
                onChange={setTeamFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'no-team', label: 'No Team' },
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
                <button
                  type="button"
                  onClick={() => setExportViewOpen(true)}
                  title="Export current view — copy a table of what's currently filtered"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    border: '1.5px solid var(--rmg-color-grey-2)', borderRadius: 'var(--rmg-radius-s)',
                    background: 'var(--rmg-color-surface-white)', color: 'var(--rmg-color-text-body)',
                    fontFamily: 'var(--rmg-font-body)', fontSize: 12, fontWeight: 400,
                    padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <Copy size={12} />
                  Copy view
                </button>
                {!isLocked && (
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
        locked={isLocked}
        activeTeamFilter={teamFilter === 'all' || teamFilter === 'no-team' ? null : teamFilter}
        searchQuery={search}
        costItems={localCostItems}
        isUnfiltered={isUnfiltered}
        editingAdHoc={editingAdHoc}
        onToggleEditAdHoc={() => setEditingAdHoc((v) => !v)}
        editingEtpSs={editingEtpSs}
        onToggleEditEtpSs={() => setEditingEtpSs((v) => !v)}
        onUpdateCostItem={handleUpdateCostItem}
        onDeleteCostItem={handleDeleteCostItem}
        onAddCostItem={handleAddCostItem}
        onAddEtpSsItem={handleAddEtpSsItem}
        editingSchedule={editingSchedule}
        onUpdateAllocation={handleUpdateAllocation}
        onDeleteAllocation={handleDeleteAllocation}
        onOpenAssignWizard={handleOpenAssignWizard}
        onUnassignResource={handleUnassignResource}
        onEditTeams={handleOpenEditTeams}
        onAddAllocation={handleOpenWizard}
        onReorder={handleReorder}
        blendedDayRate={(effectiveCostConfig?.blended_day_rate_override ?? 0) / 100}
        periodWorkingDays={workingDays}
      />
    </div>
    <LoadingOverlay
      isLoading={isLoading}
      message={loadingMessage}
      subMessage={loadingSubMessage}
    />
    <AddResourceWizard
      open={wizardOpen || assignWizardTarget !== null}
      periodId={period.period_id}
      defaultSupplierId={wizardSupplier?.supplierId ?? null}
      defaultSupplierName={wizardSupplier?.supplierName ?? null}
      defaultSupplierColour={wizardSupplier?.supplierColour ?? '#8F9495'}
      activeSupplierFilter={selectedSuppliers}
      activeTeamFilter={teamFilter}
      periodWorkingDays={workingDays}
      assignMode={assignWizardTarget ?? undefined}
      onAssignSuccess={handleAssignSuccess}
      onConflictResolved={() => router.refresh()}
      onClose={() => { setWizardOpen(false); setWizardSupplier(null); setAssignWizardTarget(null) }}
      onSuccess={handleWizardSuccess}
    />
    {editTeamsTarget && (
      <EditTeamsModal
        target={editTeamsTarget}
        periodId={period.period_id}
        onSave={handleEditTeamsSave}
        onClose={() => setEditTeamsTarget(null)}
      />
    )}
    <ExportCurrentViewModal
      open={exportViewOpen}
      onClose={() => setExportViewOpen(false)}
      rows={exportRows}
      activeTeamFilter={teamFilter === 'all' || teamFilter === 'no-team' ? null : teamFilter}
      periodName={period.period_name}
      workingDays={workingDays}
    />
    <CreatePeriodWizard
      open={createPeriodOpen}
      latestPeriod={latestPeriod}
      // Initial figure: the currently-viewed period's row count. The wizard
      // refines it against the actual latest period when it opens.
      sourceAllocationCount={localAllocations.length}
      onClose={() => setCreatePeriodOpen(false)}
      onCreated={(newPeriodId, periodName) => {
        setCreatePeriodOpen(false)
        setLoading('Loading schedule', periodName)
        const params = new URLSearchParams(searchParams.toString())
        params.set('period', newPeriodId)
        router.push(`/schedule?${params.toString()}`)
      }}
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
  period,
  locked,
  onRateSaved,
}: {
  totals: {
    totalPlatform: number
    totalPlatformIncEtp: number
    etpAndSsPence: number
    calcRatePence: number
    calcRateIncEtp: number
    headcount: number
    chargeableDays: number
  }
  costConfig: SchedulePageData['costConfig']
  period: SchedulePageData['period']
  locked: boolean
  onRateSaved: (newRatePence: number) => void
}) {
  const { isPrivate } = usePrivacyMode()

  const overrideSet =
    costConfig?.blended_day_rate_override !== undefined &&
    costConfig?.blended_day_rate_override !== null
  const dayRateValue = overrideSet
    ? formatMoney(costConfig!.blended_day_rate_override!, { decimals: 2 })
    : formatMoney(Math.round(totals.calcRatePence), { decimals: 2 })

  const currentRate = (costConfig?.blended_day_rate_override ?? 0) / 100
  const advisedRate = Math.round(totals.calcRateIncEtp) / 100
  const totalPRDays = totals.chargeableDays
  const recoveryVariance = (currentRate - advisedRate) * totalPRDays
  const recoveryVarianceFormatted = Math.abs(recoveryVariance).toLocaleString('en-GB', { maximumFractionDigits: 0 })

  let recoveryVarianceValue: string
  let recoveryVarianceColor: string
  let recoveryVarianceSub: string
  if (recoveryVariance < 0) {
    recoveryVarianceValue = `−£${recoveryVarianceFormatted}`
    recoveryVarianceColor = '#C8102E'
    recoveryVarianceSub = 'shortfall this period'
  } else if (recoveryVariance > 0) {
    recoveryVarianceValue = `+£${recoveryVarianceFormatted}`
    recoveryVarianceColor = '#3B6D11'
    recoveryVarianceSub = 'surplus this period'
  } else {
    recoveryVarianceValue = '£0'
    recoveryVarianceColor = '#2A2A2D'
    recoveryVarianceSub = 'on target'
  }

  return (
    <div className={styles.kpiStrip}>
      <KpiCard
        label="Total Platform Cost"
        value={formatMoney(totals.totalPlatformIncEtp, { decimals: 0 })}
        sub="Inc. ad-hoc, ETP & Shared Services, plus VAT"
        accent="#DA202A"
        blur={isPrivate}
      />
      <AppliedBlendedRateCard
        period={period}
        locked={locked}
        platformId={costConfig?.platform_id ?? null}
        displayValue={dayRateValue}
        overrideSet={overrideSet}
        currentRate={currentRate}
        advisedRate={advisedRate}
        totalPRDays={totalPRDays}
        onRateSaved={onRateSaved}
        isPrivate={isPrivate}
      />
      <KpiCard
        label="Advised Blended Rate"
        value={formatMoney(Math.round(totals.calcRateIncEtp), { decimals: 2 })}
        sub="Calculated, inc. ETP & SS"
        accent="#0892CB"
      />
      <KpiCard
        label="Recovery variance"
        value={recoveryVarianceValue}
        valueColor={recoveryVarianceColor}
        sub={recoveryVarianceSub}
        accent={recoveryVarianceColor}
        blur={isPrivate}
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

/* ── Applied Blended Rate card (merged display + inline editor) ─────── */

function AppliedBlendedRateCard({
  period,
  locked,
  platformId,
  displayValue,
  overrideSet,
  currentRate,
  advisedRate,
  totalPRDays,
  onRateSaved,
  isPrivate,
}: {
  period: SchedulePageData['period']
  locked: boolean
  platformId: string | null
  displayValue: string
  overrideSet: boolean
  currentRate: number
  advisedRate: number
  totalPRDays: number
  onRateSaved: (newRatePence: number) => void
  isPrivate: boolean
}) {
  // Editability reads the LIVE lock, not the page-load snapshot: fold the
  // current `locked` flag into the period before the check. locked === true
  // returns { kind: 'locked' } and hard-blocks editing regardless of status.
  const editState = getRateEditability({ ...period, locked })

  const [editing, setEditing] = useState(false)
  const [warnOpen, setWarnOpen] = useState(false)
  const [rate, setRate] = useState(String(currentRate || ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set once Save finds a live row already at this exact platform +
  // effective_from — the editor shows an inline correction confirm instead
  // of saving immediately. Cleared by its own Cancel (back to the input) or
  // by a successful update.
  const [pendingUpdate, setPendingUpdate] = useState<{
    costConfigurationId: string
    oldRatePence: number | null
    vatUpliftPercent: number
    onCostsUpliftPercent: number
    newRatePence: number
  } | null>(null)

  function openEditor() {
    // Defence in depth: a locked period can never open the editor, even if a
    // stale handler somehow fires.
    if (editState.kind === 'locked') return
    setRate(String(currentRate || ''))
    setError(null)
    setPendingUpdate(null)
    if (editState.kind === 'warn') {
      setWarnOpen(true)
    } else {
      setEditing(true)
    }
  }

  async function doInsert(pence: number) {
    if (!platformId) {
      setError('No cost configuration for this platform.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await setBlendedRate(platformId, period.period_start_date, pence)
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.')
      return
    }
    setEditing(false)
    onRateSaved(pence)
  }

  async function doUpdate() {
    if (!pendingUpdate) return
    setSaving(true)
    setError(null)
    const result = await updateCostConfiguration(pendingUpdate.costConfigurationId, {
      effectiveFrom: period.period_start_date,
      blendedRatePence: pendingUpdate.newRatePence,
      vatUpliftPercent: pendingUpdate.vatUpliftPercent,
      onCostsUpliftPercent: pendingUpdate.onCostsUpliftPercent,
    })
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.')
      return
    }
    setEditing(false)
    setPendingUpdate(null)
    onRateSaved(pendingUpdate.newRatePence)
  }

  // Save click: check whether a live row already exists at this exact
  // platform + effective_from before deciding insert vs update.
  // set_blended_rate is INSERT-only and would otherwise collide on the
  // (platform_id, effective_from) unique index — re-saving a period that
  // already has a rate is a normal correction, not an error.
  async function handleSaveClick() {
    if (!platformId) {
      setError('No cost configuration for this platform.')
      return
    }
    setSaving(true)
    setError(null)
    const pence = Math.round((parseFloat(rate) || 0) * 100)

    const supabase = getSupabaseBrowserClient()
    const { data: existing, error: lookupErr } = await supabase
      .from('cost_configurations')
      .select('cost_configuration_id, blended_day_rate_override, vat_uplift_percent, on_costs_uplift_percent')
      .eq('platform_id', platformId)
      .eq('effective_from', period.period_start_date)
      .is('deleted_at', null)
      .maybeSingle()

    if (lookupErr) {
      setSaving(false)
      setError(lookupErr.message)
      return
    }

    const decision = decideRateUpsert(existing as ExistingCostConfigRow | null)
    if (decision.kind === 'insert') {
      // No change to existing behaviour: save immediately.
      await doInsert(pence)
      return
    }
    setSaving(false)
    setPendingUpdate({
      costConfigurationId: decision.costConfigurationId,
      oldRatePence: decision.oldRatePence,
      vatUpliftPercent: decision.vatUpliftPercent,
      onCostsUpliftPercent: decision.onCostsUpliftPercent,
      newRatePence: pence,
    })
  }

  // Live variance preview against the advised-rate formula (recovery variance):
  // (proposed rate − advised rate) × chargeable PR days.
  const proposed = parseFloat(rate) || 0
  const previewVariance = (proposed - advisedRate) * totalPRDays
  const previewColour = previewVariance < 0 ? '#C8102E' : previewVariance > 0 ? '#3B6D11' : '#2A2A2D'
  const previewLabel =
    previewVariance < 0 ? 'shortfall' : previewVariance > 0 ? 'surplus' : 'on target'

  const card: React.CSSProperties = {
    background: 'white',
    borderRadius: 10,
    padding: '14px 16px 13px',
    border: editing
      ? '1.5px solid rgba(218,32,42,0.35)'
      : overrideSet
      ? '1.5px solid rgba(218,32,42,0.22)'
      : '1px solid #EEEEEE',
    position: 'relative',
    overflow: 'hidden',
  }
  const labelRow: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
    color: '#8F9495', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  }

  return (
    <div style={card}>
      <div style={labelRow}>
        <span>Applied Blended Rate</span>
        {editState.kind === 'locked' ? (
          <span title="Period locked — rate changes blocked" style={{ display: 'inline-flex', color: '#8F9495' }}>{LockIcon(12, 0.6)}</span>
        ) : !editing ? (
          <button
            type="button"
            onClick={openEditor}
            aria-label="Edit applied blended rate"
            title="Edit applied blended rate"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#DA202A', padding: 0, display: 'inline-flex' }}
          >
            <Pencil size={13} />
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div
          style={{
            fontFamily: 'var(--rmg-font-display)', fontSize: 21, fontWeight: 700, color: '#DA202A',
            letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6,
            filter: isPrivate ? 'blur(6px)' : undefined,
          }}
        >
          {displayValue}
          <span style={{ fontSize: 12, fontWeight: 400, color: '#8F9495', letterSpacing: 0 }}>/day</span>
        </div>
      ) : pendingUpdate ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#2A2A2D', lineHeight: 1.5 }}>
            A rate of{' '}
            <strong>
              {pendingUpdate.oldRatePence === null ? 'no rate' : `${formatMoney(pendingUpdate.oldRatePence, { decimals: 2 })}/day`}
            </strong>{' '}
            was already set for {period.period_name} ({formatUkDate(period.period_start_date)}). This will update it
            to <strong>{formatMoney(pendingUpdate.newRatePence, { decimals: 2 })}/day</strong> — are you sure?
          </p>
          {error && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#C8102E' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={doUpdate}
              disabled={saving}
              style={{
                background: saving ? '#C0C0C0' : '#DA202A', color: '#fff', border: 'none', borderRadius: 6,
                padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--rmg-font-body)',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setPendingUpdate(null); setError(null) }}
              style={{
                background: 'transparent', color: '#404044', border: '1px solid #C0C0C0', borderRadius: 6,
                padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--rmg-font-body)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            autoFocus
            onChange={(e) => setRate(e.target.value)}
            style={{
              width: '100%', fontFamily: 'var(--rmg-font-body)', fontSize: 14, padding: '6px 10px',
              border: '1px solid #D0D0D0', borderRadius: 6, outline: 'none', boxSizing: 'border-box', color: '#2A2A2D',
            }}
          />
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#8F9495' }}>
            Advised: {formatMoney(Math.round(advisedRate * 100), { decimals: 2 })}/day ·{' '}
            <span style={{ color: previewColour, fontWeight: 600 }}>
              {previewVariance < 0 ? '−' : previewVariance > 0 ? '+' : ''}£{Math.abs(Math.round(previewVariance)).toLocaleString('en-GB')} {previewLabel}
            </span>
          </p>
          {error && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#C8102E' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving}
              style={{
                background: saving ? '#C0C0C0' : '#DA202A', color: '#fff', border: 'none', borderRadius: 6,
                padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--rmg-font-body)',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null) }}
              style={{
                background: 'transparent', color: '#404044', border: '1px solid #C0C0C0', borderRadius: 6,
                padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--rmg-font-body)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom accent bar — matches the sibling KpiCards. */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#DA202A' }} />

      {warnOpen && editState.kind === 'warn' && (
        <ConfirmDialog
          message={editState.message}
          onConfirm={() => { setWarnOpen(false); setEditing(true) }}
          onCancel={() => setWarnOpen(false)}
        />
      )}
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
  blur,
}: {
  label: string
  value: React.ReactNode
  sub: string
  accent: string
  valueColor?: string
  emphasised?: boolean
  blur?: boolean
}) {
  const blurStyle: React.CSSProperties | undefined = blur
    ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }
    : undefined

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
          ...blurStyle,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#8F9495', marginTop: 4, ...blurStyle }}>{sub}</div>
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

// Persisted manual ordering within a supplier group: display_order ASC, NULLS
// LAST, falling back to resource name for stability. This is the base order
// rows render in on load; a session column sort (when active) layers on top.
function byDisplayOrder(a: ScheduleAllocation, b: ScheduleAllocation): number {
  const ao = a.display_order ?? Number.POSITIVE_INFINITY
  const bo = b.display_order ?? Number.POSITIVE_INFINITY
  if (ao !== bo) return ao - bo
  return (a.resource_name ?? 'ZZZZZ').localeCompare(b.resource_name ?? 'ZZZZZ')
}

/* ── ScheduleTable ─────────────────────────────────────────────── */

type AllocationUpdates = Partial<Pick<ScheduleAllocation, 'role_title' | 'day_rate' | 'capacity_days' | 'utilisation_percent' | 'planview_code' | 'vat_applies' | 'is_chargeable' | 'is_confirmed' | 'resource_location'>>

function ScheduleTable({
  groups,
  expandedMap,
  onToggle,
  sort,
  onSort,
  vatPct,
  locked,
  activeTeamFilter,
  searchQuery,
  costItems,
  isUnfiltered,
  editingAdHoc,
  onToggleEditAdHoc,
  editingEtpSs,
  onToggleEditEtpSs,
  onUpdateCostItem,
  onDeleteCostItem,
  onAddCostItem,
  onAddEtpSsItem,
  editingSchedule,
  onUpdateAllocation,
  onDeleteAllocation,
  onOpenAssignWizard,
  onUnassignResource,
  onEditTeams,
  onAddAllocation,
  onReorder,
  blendedDayRate,
  periodWorkingDays,
}: {
  groups: { name: string | null; colour: string; supplierId: string | null; rows: Allocation[] }[]
  expandedMap: Record<string, boolean>
  onToggle: (name: string | null) => void
  sort: SortState
  onSort: (col: SortableCol) => void
  vatPct: number
  locked: boolean
  searchQuery: string
  activeTeamFilter: string | null
  costItems: PlatformCostItem[]
  isUnfiltered: boolean
  editingAdHoc: boolean
  onToggleEditAdHoc: () => void
  editingEtpSs: boolean
  onToggleEditEtpSs: () => void
  onUpdateCostItem: (id: string, updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes' | 'cost_item_category'>>) => Promise<void>
  onDeleteCostItem: (id: string) => Promise<void>
  onAddCostItem: () => Promise<void>
  onAddEtpSsItem: () => Promise<void>
  editingSchedule: boolean
  onUpdateAllocation: (id: string, updates: AllocationUpdates) => Promise<void>
  onDeleteAllocation: (id: string) => Promise<void>
  onOpenAssignWizard: (allocationId: string, roleTitle: string, supplierId: string | null, supplierName: string | null, resourceLocation: ResourceLocation | null, seat?: { capacityDays: number | null; dayRate: number; teamNames: string[] }) => void
  onUnassignResource: (allocationId: string) => Promise<void>
  onEditTeams: (allocationId: string, resourceId: string | null, resourceName: string, currentTeams: TeamAssignment[]) => void
  onAddAllocation: (supplierId: string | null, supplierName: string | null, supplierColour: string) => Promise<void>
  onReorder: (orderedIds: string[]) => Promise<void>
  blendedDayRate: number
  periodWorkingDays: number
}) {
  const { isPrivate } = usePrivacyMode()

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

  const footerDays = sumFilteredDays(groups, activeTeamFilter)
  const footerConfirmed = calculateConfirmedCount(groups.flatMap((g) => g.rows))

  const costItemsBase = costItems.reduce((s, item) => s + item.amount_pence, 0)
  const costItemsVat = costItems.reduce((s, item) => s + calcCostItemVat(item.amount_pence, item.vat_applies, vatPct), 0)

  const totalCapacityDays = activeTeamFilter
    ? groups.reduce((s, g) => {
        return s + g.rows.reduce((rs, r) => {
          return rs + (r.capacity_days ?? 0) * getCapacitySplit(r.teams, activeTeamFilter)
        }, 0)
      }, 0)
    : 0

  return (
    <div className={styles.tableScroller}>
      <div className={styles.tableInner}>
        <HeaderRow sort={sort} onSort={onSort} locked={locked} />
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
              locked={locked}
              onUpdateAllocation={onUpdateAllocation}
              onDeleteAllocation={onDeleteAllocation}
              onOpenAssignWizard={onOpenAssignWizard}
              onUnassignResource={onUnassignResource}
              onEditTeams={onEditTeams}
              onAddAllocation={onAddAllocation}
              onReorder={onReorder}
            />
          )
        })}
        {isUnfiltered && <AdHocSection
          items={costItems.filter((i) => i.cost_item_category === 'ADHOC')}
          editingAdHoc={editingAdHoc}
          onToggleEditAdHoc={onToggleEditAdHoc}
          onUpdate={onUpdateCostItem}
          onDelete={onDeleteCostItem}
          onAdd={onAddCostItem}
          vatPct={vatPct}
          locked={locked}
        />}
        {isUnfiltered && (costItems.some(
          (i) => i.cost_item_category === 'ETP' || i.cost_item_category === 'SHARED_SERVICES',
        ) || editingEtpSs) && <EtpSsSection
          items={costItems.filter(
            (i) => i.cost_item_category === 'ETP' || i.cost_item_category === 'SHARED_SERVICES',
          )}
          vatPct={vatPct}
          locked={locked}
          editingEtpSs={editingEtpSs}
          onToggleEditEtpSs={onToggleEditEtpSs}
          onUpdate={onUpdateCostItem}
          onDelete={onDeleteCostItem}
          onAdd={onAddEtpSsItem}
        />}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: RESOURCE_TABLE_COLS,
            padding: COL_PADDING,
            background: '#F5F5F5',
            borderTop: '2px solid #E0E0E0',
          }}
        >
          <div
            className={styles.bandLeft}
            style={{ gridColumn: '1 / span 8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#404044' }}
          >
            {footerLabel}
          </div>
          <div style={{ gridColumn: 9 }}>
            <BandTotal label="Days" value={formatDaysTotal(footerDays)} />
          </div>
          <div style={{ gridColumn: 11 }}>
            <BandTotal label="Base" value={formatMoney(footerBase + (isUnfiltered ? costItemsBase : 0))} blur={isPrivate} />
          </div>
          <div style={{ gridColumn: 12 }}>
            <BandTotal label="+VAT" value={formatMoney(footerVat + (isUnfiltered ? costItemsVat : 0))} blur={isPrivate} />
          </div>
          <div style={{ gridColumn: 13 }}>
            <BandTotal label="Confirmed" value={`${footerConfirmed.confirmed}/${footerConfirmed.total}`} />
          </div>
        </div>
        {activeTeamFilter && (
          <TeamRunRateBar
            teamName={activeTeamFilter}
            totalCapacityDays={totalCapacityDays}
            blendedDayRate={blendedDayRate}
            periodWorkingDays={periodWorkingDays}
          />
        )}
      </div>
    </div>
  )
}

/* ── TeamRunRateBar ────────────────────────────────────────────── */

function TeamRunRateBar({
  teamName,
  totalCapacityDays,
  blendedDayRate,
  periodWorkingDays,
}: {
  teamName: string
  totalCapacityDays: number
  blendedDayRate: number
  periodWorkingDays: number
}) {
  const quarterCost = Math.round(totalCapacityDays * blendedDayRate)
  const sprintCost =
    periodWorkingDays > 0 ? Math.round((quarterCost / periodWorkingDays) * 10) : 0

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#639922',
  }
  const valueStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: '#3B6D11',
  }
  const dividerStyle: React.CSSProperties = {
    alignSelf: 'stretch',
    width: 0,
    borderLeft: '0.5px solid #C0DD97',
  }
  const statStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  }

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '9px 14px',
    background: '#EAF3DE',
    borderTop: '0.5px solid #C0DD97',
  }

  return (
    <div style={wrapperStyle}>
      <div style={labelStyle}>{teamName} — internal run rate</div>

      <div style={statStyle}>
        <span style={valueStyle}>{totalCapacityDays.toFixed(1)}</span>
        <span style={labelStyle}>capacity days</span>
      </div>

      <div style={dividerStyle} />

      <div style={statStyle}>
        <span style={valueStyle}>
          £{quarterCost.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
        </span>
        <span style={labelStyle}>full quarter</span>
      </div>

      <div style={dividerStyle} />

      <div style={statStyle}>
        <span style={valueStyle}>
          £{sprintCost.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
        </span>
        <span style={labelStyle}>per sprint (10d)</span>
      </div>

      <div style={{ marginLeft: 'auto', fontSize: 11, color: '#639922' }}>
        @ £{blendedDayRate.toLocaleString('en-GB', { maximumFractionDigits: 0 })}/day
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
  locked,
}: {
  sort: SortState
  onSort: (col: SortableCol) => void
  locked: boolean
}) {
  const { isPrivate } = usePrivacyMode()

  return (
    <div
      className={styles.header}
      style={{
        display: 'grid',
        gridTemplateColumns: RESOURCE_TABLE_COLS,
        padding: COL_PADDING,
        background: '#EFEFEF',
        borderBottom: '2px solid #E0E0E0',
      }}
    >
      <div />
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
        trailing={locked ? LockIcon(11, 0.35) : null}
        privacyIcon={isPrivate}
      />
      <Th label="Base" col="total" sort={sort} onSort={onSort} align="right" privacyIcon={isPrivate} />
      <Th label="+VAT" col="vat" sort={sort} onSort={onSort} align="right" privacyIcon={isPrivate} />
      <Th label="Confirmed" col={null} sort={sort} onSort={onSort} align="right" />
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
  privacyIcon,
}: {
  label: string
  col: SortableCol | null
  sort: SortState
  onSort: (col: SortableCol) => void
  align?: 'right'
  trailing?: React.ReactNode
  privacyIcon?: boolean
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
        color: privacyIcon
          ? 'var(--color-text-secondary)'
          : hovered && clickable
            ? '#DA202A'
            : '#404044',
        cursor: clickable ? 'pointer' : 'default',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        transition: 'color 120ms',
      }}
    >
      {privacyIcon && <EyeOff size={11} />}
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
  locked,
  onUpdateAllocation,
  onDeleteAllocation,
  onOpenAssignWizard,
  onUnassignResource,
  onEditTeams,
  onAddAllocation,
  onReorder,
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
  locked: boolean
  onUpdateAllocation: (id: string, updates: AllocationUpdates) => Promise<void>
  onDeleteAllocation: (id: string) => Promise<void>
  onOpenAssignWizard: (allocationId: string, roleTitle: string, supplierId: string | null, supplierName: string | null, resourceLocation: ResourceLocation | null, seat?: { capacityDays: number | null; dayRate: number; teamNames: string[] }) => void
  onUnassignResource: (allocationId: string) => Promise<void>
  onEditTeams: (allocationId: string, resourceId: string | null, resourceName: string, currentTeams: TeamAssignment[]) => void
  onAddAllocation: (supplierId: string | null, supplierName: string | null, supplierColour: string) => Promise<void>
  onReorder: (orderedIds: string[]) => Promise<void>
}) {
  const isRMG = name === RMG_SUPPLIER_NAME
  const tint = isRMG ? withAlpha(colour, '08') : withAlpha(colour, '0F')
  const pillTextColour = getTextColour(colour)
  const weightedAvgDayRate = days > 0 ? (base / 100) / days : 0
  const supplierConfirmed = calculateConfirmedCount(rows)
  const { isPrivate } = usePrivacyMode()
  const blurStyle: React.CSSProperties | undefined = isPrivate
    ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }
    : undefined

  // Drag-and-drop reordering is only active in edit mode on an unlocked period.
  const dragEnabled = editingSchedule && !locked
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )
  const rowIds = rows.map((r) => r.allocation_id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = rowIds.indexOf(String(active.id))
    const newIndex = rowIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(rowIds, oldIndex, newIndex)
    void onReorder(newOrder)
  }

  return (
    <div style={{ borderLeft: `4px solid ${colour}` }}>
      <div
        className={styles.bandRow}
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: RESOURCE_TABLE_COLS,
          padding: COL_PADDING,
          background: tint,
          cursor: 'pointer',
        }}
      >
        <div className={styles.bandLeft} style={{ gridColumn: '1 / span 9' }}>
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
            gridColumn: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '10px 8px 10px 0',
          }}
        >
          {days > 0 ? (
            <>
              <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--rmg-color-grey-1)', marginRight: '4px', ...blurStyle }}>
                avg./day
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rmg-color-text-heading)', ...blurStyle }}>
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
              gridColumn: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
              ...blurStyle,
            }}
          >
            {formatMoney(base)}
          </div>
          <div
            style={{
              gridColumn: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
              ...blurStyle,
            }}
          >
            {formatMoney(vat)}
          </div>
          <div
            style={{
              gridColumn: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                flexShrink: 0,
                borderRadius: '100px',
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                background: '#EEEEEE',
                color: '#8F9495',
              }}
            >
              {supplierConfirmed.confirmed}/{supplierConfirmed.total}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        dragEnabled ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              {rows.map((r) => (
                <SortableRow
                  key={r.allocation_id}
                  id={r.allocation_id}
                  isEditMode={editingSchedule}
                  isLocked={locked}
                >
                  {(dragHandleSlot) => (
                    <AllocationRow
                      key={r.allocation_id}
                      row={r}
                      vatPct={vatPct}
                      activeTeamFilter={activeTeamFilter}
                      searchQuery={searchQuery}
                      editingSchedule={editingSchedule}
                      onUpdate={onUpdateAllocation}
                      onDelete={onDeleteAllocation}
                      onOpenAssignWizard={onOpenAssignWizard}
                      onUnassignResource={onUnassignResource}
                      onEditTeams={onEditTeams}
                      dragHandleSlot={dragHandleSlot}
                    />
                  )}
                </SortableRow>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
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
              onOpenAssignWizard={onOpenAssignWizard}
              onUnassignResource={onUnassignResource}
              onEditTeams={onEditTeams}
              dragHandleSlot={null}
            />
          ))
        )
      )}
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
            Add role / resource
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
  locked,
}: {
  items: PlatformCostItem[]
  editingAdHoc: boolean
  onToggleEditAdHoc: () => void
  onUpdate: (id: string, updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAdd: () => Promise<void>
  vatPct: number
  locked: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const base = items.reduce((s, item) => s + item.amount_pence, 0)
  const vat = items.reduce((s, item) => s + calcCostItemVat(item.amount_pence, item.vat_applies, vatPct), 0)
  const { isPrivate } = usePrivacyMode()
  const blurStyle: React.CSSProperties | undefined = isPrivate
    ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }
    : undefined

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
          style={{ gridColumn: '1 / span 9' }}
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
          {!locked && (
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
              gridColumn: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
              ...blurStyle,
            }}
          >
            {formatMoney(base)}
          </div>
          <div
            style={{
              gridColumn: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
              ...blurStyle,
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
          <div style={{ gridColumn: '1 / span 12', padding: '8px 0' }}>
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

/* ── EtpSsSection ──────────────────────────────────────────────── */

const ETP_SS_COLOUR = '#5A5A5E'

const ETP_SS_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'ETP', label: 'Enterprise Tooling Platform' },
  { value: 'SHARED_SERVICES', label: 'Shared Services' },
]

function EtpSsSection({
  items,
  vatPct,
  locked,
  editingEtpSs,
  onToggleEditEtpSs,
  onUpdate,
  onDelete,
  onAdd,
}: {
  items: PlatformCostItem[]
  vatPct: number
  locked: boolean
  editingEtpSs: boolean
  onToggleEditEtpSs: () => void
  onUpdate: (id: string, updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes' | 'cost_item_category'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAdd: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(true)
  const base = items.reduce((s, item) => s + item.amount_pence, 0)
  const vat = items.reduce((s, item) => s + calcCostItemVat(item.amount_pence, item.vat_applies, vatPct), 0)
  const { isPrivate } = usePrivacyMode()
  const blurStyle: React.CSSProperties | undefined = isPrivate
    ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }
    : undefined

  return (
    <div style={{ borderLeft: `3px solid ${ETP_SS_COLOUR}` }}>
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
          style={{ gridColumn: '1 / span 9' }}
          onClick={() => setExpanded((v) => !v)}
        >
          <span
            style={{
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 120ms ease',
              color: ETP_SS_COLOUR,
              display: 'inline-flex',
            }}
            aria-hidden
          >
            <ChevronSmall />
          </span>
          <span
            style={{
              background: ETP_SS_COLOUR,
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 6,
            }}
          >
            ETP & Shared Services
          </span>
          <span style={{ fontSize: 12, color: '#8F9495' }}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          {!locked && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleEditEtpSs() }}
              style={{
                marginLeft: 8,
                background: editingEtpSs ? ETP_SS_COLOUR : 'transparent',
                color: editingEtpSs ? 'white' : ETP_SS_COLOUR,
                border: `1px solid ${ETP_SS_COLOUR}`,
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--rmg-font-body)',
              }}
            >
              {editingEtpSs ? 'Done' : 'Edit items'}
            </button>
          )}
        </div>
        <div className={styles.bandMobileRow}>
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
              ...blurStyle,
            }}
          >
            {formatMoney(base)}
          </div>
          <div
            style={{
              gridColumn: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '10px 8px 10px 0',
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--rmg-color-text-heading)',
              fontVariantNumeric: 'tabular-nums',
              ...blurStyle,
            }}
          >
            {formatMoney(vat)}
          </div>
        </div>
      </div>

      {expanded && items.map((item) => (
        editingEtpSs ? (
          <EtpSsEditRow
            key={item.cost_item_id}
            item={item}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ) : (
          <AdHocRow
            key={item.cost_item_id}
            item={item}
            editing={false}
            vatPct={vatPct}
            onUpdate={async () => {}}
            onDelete={async () => {}}
          />
        )
      ))}

      {expanded && editingEtpSs && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: SCHEDULE_COLS,
            padding: COL_PADDING,
            borderTop: '1px solid #EEEEEE',
          }}
        >
          <div style={{ gridColumn: '1 / span 12', padding: '8px 0' }}>
            <button
              type="button"
              onClick={onAdd}
              style={{
                background: 'transparent',
                border: `1px dashed ${ETP_SS_COLOUR}`,
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: ETP_SS_COLOUR,
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

function EtpSsEditRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: PlatformCostItem
  onUpdate: (id: string, updates: Partial<Pick<PlatformCostItem, 'label' | 'amount_pence' | 'vat_applies' | 'notes' | 'cost_item_category'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [labelValue, setLabelValue] = useState(item.label)
  const [amountValue, setAmountValue] = useState((item.amount_pence / 100).toFixed(2))
  useEffect(() => setLabelValue(item.label), [item.label])
  useEffect(() => setAmountValue((item.amount_pence / 100).toFixed(2)), [item.amount_pence])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: SCHEDULE_COLS,
        padding: COL_PADDING,
        borderTop: '1px solid #EEEEEE',
        background: 'rgba(90,90,94,0.03)',
      }}
    >
      <div style={{ gridColumn: 1 }} />
      <div style={{ gridColumn: '2 / span 4', padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center' }}>
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
      <div style={{ gridColumn: '6 / span 3', padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center' }}>
        <select
          value={item.cost_item_category}
          onChange={(e) => onUpdate(item.cost_item_id, { cost_item_category: e.target.value })}
          style={{
            width: '100%',
            border: '1px solid #D5D5D5',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: 'var(--rmg-font-body)',
            color: '#2A2A2D',
            background: '#fff',
          }}
        >
          {ETP_SS_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div style={{ gridColumn: '9 / span 3', padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
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
            width: '100px',
            border: '1px solid #D5D5D5',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: 'var(--rmg-font-body)',
            color: '#2A2A2D',
          }}
        />
      </div>
      <div style={{ gridColumn: 12, padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
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
  const { isPrivate } = usePrivacyMode()
  const blurStyle: React.CSSProperties | undefined = isPrivate
    ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }
    : undefined

  if (!editing) {
    return (
      <div className={styles.allocationRow} style={{ gridTemplateColumns: SCHEDULE_COLS }}>
        <Cell><span /></Cell>
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
          <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', ...blurStyle }}>
            {formatMoney(item.amount_pence)}
          </span>
        </Cell>
        <Cell align="right" dataLabel="+VAT">
          <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: item.vat_applies ? '#2A2A2D' : '#8F9495', ...blurStyle }}>
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
      <div style={{ gridColumn: 1 }} />
      <div style={{ gridColumn: '2 / span 5', padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center' }}>
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
      <div style={{ gridColumn: '7 / span 4', padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
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
      <div style={{ gridColumn: 12, padding: '6px 8px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
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

function BandTotal({ label, value, blur }: { label: string; value: string; blur?: boolean }) {
  const blurStyle: React.CSSProperties | undefined = blur
    ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }
    : undefined

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
          ...blurStyle,
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
          ...blurStyle,
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

function UserPlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  )
}

function UserMinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function UnallocatedWarning({ pct, name }: { pct: number; name: string }) {
  return (
    <span
      title={`${name} has ${100 - pct}% allocated. ${pct}% has no team assigned.`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        color: 'var(--rmg-color-red)',
        fontSize: 11,
        fontWeight: 600,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <AlertTriangle size={10} aria-hidden />
      {pct}% unassigned
    </span>
  )
}

// View-mode-only read-only status indicator — editing is exclusively via the
// edit-mode checkbox (see the 12 Confirmed cell in the editingSchedule
// branch above). No click handler, no write.
function ConfirmedStatusIcon({ isConfirmed, name }: { isConfirmed: boolean; name: string }) {
  return isConfirmed ? (
    <CircleCheck
      size={18}
      color="var(--rmg-color-green-contrast)"
      role="img"
      aria-label={`${name} confirmed`}
    />
  ) : (
    <AlertTriangle
      size={18}
      color="var(--rmg-color-orange)"
      role="img"
      aria-label={`${name} not yet confirmed`}
    />
  )
}

function AllocationRow({
  row,
  vatPct,
  activeTeamFilter,
  searchQuery,
  editingSchedule,
  onUpdate,
  onDelete,
  onOpenAssignWizard,
  onUnassignResource,
  onEditTeams,
  dragHandleSlot,
}: {
  row: Allocation
  vatPct: number
  activeTeamFilter: string | null
  searchQuery: string
  editingSchedule: boolean
  onUpdate: (id: string, updates: AllocationUpdates) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onOpenAssignWizard: (allocationId: string, roleTitle: string, supplierId: string | null, supplierName: string | null, resourceLocation: ResourceLocation | null, seat?: { capacityDays: number | null; dayRate: number; teamNames: string[] }) => void
  onUnassignResource: (allocationId: string) => Promise<void>
  onEditTeams: (allocationId: string, resourceId: string | null, resourceName: string, currentTeams: TeamAssignment[]) => void
  dragHandleSlot?: React.ReactNode
}) {
  const { isPrivate } = usePrivacyMode()
  const blurStyle: React.CSSProperties | undefined = isPrivate
    ? { filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none' }
    : undefined

  const [pendingDelete, setPendingDelete] = useState(false)
  const [unassignConfirm, setUnassignConfirm] = useState(false)

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
        style={{ gridTemplateColumns: RESOURCE_TABLE_COLS, background: '#FFF5F5' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dragHandleSlot}</div>
        <div style={{ gridColumn: '2 / -1', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px' }}>
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
        className={`${styles.allocationRow} ${styles.allocationRowEditing}`}
        style={{ gridTemplateColumns: RESOURCE_TABLE_COLS, background: rowBg, outline: '1px solid #E8E8E8' }}
      >
        {/* Handle */}
        <Cell><span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dragHandleSlot}</span></Cell>
        {/* 1 Resource + assign/unassign + delete */}
        <Cell>
          {unassignConfirm ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <span style={{ fontSize: 11, color: '#DA202A', fontWeight: 500, flex: 1, minWidth: 0 }}>Remove {row.resource_name} and keep as TBC?</span>
              <button type="button" onClick={() => { void onUnassignResource(row.allocation_id); setUnassignConfirm(false) }} style={{ background: '#DA202A', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 7px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--rmg-font-body)', flexShrink: 0 }}>Yes</button>
              <button type="button" onClick={() => setUnassignConfirm(false)} style={{ background: 'transparent', border: '1px solid #C0C0C0', borderRadius: 3, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--rmg-font-body)', flexShrink: 0 }}>No</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
              {tbc ? (
                <button
                  type="button"
                  onClick={() => onOpenAssignWizard(row.allocation_id, row.role_title ?? '', row.supplier_id, row.supplier_name, row.resource_location, { capacityDays: row.capacity_days, dayRate: row.day_rate, teamNames: (row.teams ?? []).map((t) => t.teamName) })}
                  title="Assign resource"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--rmg-color-grey-1)', background: 'transparent', border: '1px dashed var(--rmg-color-grey-2)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontFamily: 'var(--rmg-font-body)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  <UserPlusIcon /> Assign person
                </button>
              ) : (
                <>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#2A2A2D', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.resource_name}</span>
                  <button type="button" onClick={() => setUnassignConfirm(true)} title="Remove resource" style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, display: 'flex', alignItems: 'center' }}><UserMinusIcon /></button>
                </>
              )}
              <button
                type="button"
                onClick={() => setPendingDelete(true)}
                title="Delete row"
                style={{ background: 'transparent', border: 'none', color: '#DA202A', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          )}
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
        {/* 3 Team — read-only display + Edit teams button (named rows key on
            resource_id, TBC rows key on allocation_id) */}
        <Cell>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {teams.length === 0 ? <span style={nullStyle}>No Team</span> : teams.map((t) => t.teamName).join(', ')}
            </span>
            {row.unallocatedPct != null && (
              <UnallocatedWarning pct={row.unallocatedPct} name={row.resource_name ?? row.role_title ?? 'This row'} />
            )}
            <button
              type="button"
              onClick={() => onEditTeams(row.allocation_id, row.resource_id, row.resource_name ?? 'TBC', teams as TeamAssignment[])}
              title="Edit team assignments"
              style={{
                background: 'transparent',
                border: '1px solid #D0D0D0',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#555',
                padding: '1px 4px',
                lineHeight: 1,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                fontFamily: 'var(--rmg-font-body)',
              }}
            >
              <UsersIcon />
            </button>
          </div>
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
            {PLANVIEW_CODES.map((pc) => (
              <option key={pc.value} value={pc.value}>{pc.label}</option>
            ))}
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
        {/* 7 Location */}
        <Cell>
          <select
            value={row.resource_location ?? 'onshore'}
            onChange={(e) => onUpdate(row.allocation_id, { resource_location: e.target.value as Allocation['resource_location'] })}
            style={{ ...editInputStyle, width: 'auto' }}
          >
            <option value="onshore">Onshore</option>
            <option value="nearshore">Nearshore</option>
            <option value="offshore">Offshore</option>
          </select>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, width: '100%' }}>
            <input
              type="checkbox"
              checked={vatApplies}
              onChange={(e) => onUpdate(row.allocation_id, { vat_applies: e.target.checked })}
              style={{ flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: vatApplies ? '#2A2A2D' : '#8F9495' }}>
              {formatMoney(displayVat)}
            </span>
          </div>
        </Cell>
        {/* 12 Confirmed — checkbox */}
        <Cell align="right" dataLabel="Confirmed">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
            <input
              type="checkbox"
              checked={row.is_confirmed}
              onChange={(e) => onUpdate(row.allocation_id, { is_confirmed: e.target.checked })}
              style={{ flexShrink: 0, cursor: 'pointer' }}
            />
          </div>
        </Cell>
      </div>
    )
  }

  return (
    <div
      className={styles.allocationRow}
      style={{
        gridTemplateColumns: RESOURCE_TABLE_COLS,
        background: rowBg,
      }}
    >
      {/* Handle */}
      <Cell><span /></Cell>

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
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
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
            {row.unallocatedPct != null && (
              <UnallocatedWarning pct={row.unallocatedPct} name={row.resource_name ?? row.role_title ?? 'This row'} />
            )}
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
        {!row.resource_location ? (
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
        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', ...blurStyle }}>
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
            ...blurStyle,
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
            ...blurStyle,
          }}
        >
          {formatMoney(displayVat)}
        </span>
      </Cell>

      {/* 12 Confirmed — read-only status icon */}
      <Cell align="right" dataLabel="Confirmed">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
          <ConfirmedStatusIcon
            isConfirmed={row.is_confirmed}
            name={row.resource_name ?? row.role_title ?? 'This row'}
          />
        </div>
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

