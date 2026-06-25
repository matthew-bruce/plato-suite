'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ResourceLocation, PlanviewCode } from '@plato/schema'
import {
  searchResources,
  fetchWizardData,
  createResourceAndAllocation,
  updateTeamAssignments,
  insertResource,
  getTeamAssignments,
  findResourcePeriodConflicts,
  connectKeepExisting,
  connectUseVacant,
} from '@/app/actions/schedule-wizard'
import type {
  ResourceSearchResult,
  SupplierOption,
  TeamOption,
  ConflictAllocation,
} from '@/app/actions/schedule-wizard'
import {
  assignResourceToAllocation,
  unassignResourceFromAllocation,
} from '@/app/actions/schedule'
import { highlightMatch } from '@/lib/schedule/highlightMatch'
import { formatMoneyPence } from '@/lib/schedule/format'
import { computeConflictDayMath, describeConflictPresentation } from '@/lib/schedule/conflictDayMath'
import type { ConflictDayMath } from '@/lib/schedule/conflictDayMath'

/* ── Constants ──────────────────────────────────────────── */

const ACTIVE_RED = '#DA202A'
const DONE_GREEN = '#62A531'
const INACTIVE_GREY = '#8F9495'
const HEADER_BG = '#2A2A2D'
const SUMMARY_BG = '#F1F2F5'
const AMBER = '#D97706'

/* ── Types ──────────────────────────────────────────────── */

type WizardStep = 1 | 2 | 3
type WizardMode = 'existing' | 'new' | 'tbc' | 'edit-teams'

interface TeamRow {
  id: string
  teamId: string
  pct: number
}

interface FormState {
  supplierId: string
  supplierName: string
  roleTitle: string
  planviewCode: 'PR' | 'F_Gov' | 'BAU'
  resourceLocation: ResourceLocation
  /** Optional starting capacity in days, as a raw input string ('' = blank →
   *  defaults to 0, edit inline after adding). New-person / TBC paths only. */
  capacityDays?: string
  /** Optional starting day rate in pounds, as a raw input string. */
  dayRate?: string
}

/** Parse the optional Details-step capacity/rate inputs. Blank stays blank
 *  (undefined → the row defaults to 0). Days are stored as-is; the day rate is
 *  entered in pounds and stored as integer pence (matching inline editing). */
function parseOptionalFigures(form: FormState): { capacityDays?: number; dayRate?: number } {
  const capStr = form.capacityDays?.trim() ?? ''
  const rateStr = form.dayRate?.trim() ?? ''
  return {
    capacityDays: capStr === '' ? undefined : Math.max(0, parseFloat(capStr) || 0),
    dayRate: rateStr === '' ? undefined : Math.max(0, Math.round((parseFloat(rateStr) || 0) * 100)),
  }
}

/** A "new person" name must be a real name, not the role title it's being
 *  paired with — guards against accidentally creating a resources row whose
 *  name is just a job title. */
function isValidPersonName(name: string, roleTitle: string): boolean {
  const n = name.trim()
  if (!n) return false
  return n.toLowerCase() !== roleTitle.trim().toLowerCase()
}

export interface WizardSuccessPayload {
  allocationId: string | null
  isTeamEdit: boolean
  resourceId: string | null
  resourceName: string | null
  roleTitle: string
  supplierId: string | null
  supplierName: string | null
  supplierColour: string | null
  supplierSortOrder: number | null
  resourceLocation: ResourceLocation | null
  planviewCode: PlanviewCode
  teams: Array<{ teamId: string; teamName: string }>
  displayOrder: number | null
}

export interface AssignModeConfig {
  allocationId: string
  roleTitle: string
  supplierId: string | null
  supplierName: string | null
  resourceLocation?: ResourceLocation | null
  /** The vacant seat's own figures, shown in the same-period conflict dialog
   *  when the resource being assigned already holds another allocation. */
  capacityDays?: number | null
  dayRate?: number
  teamNames?: string[]
}

export interface AddResourceWizardProps {
  open: boolean
  periodId: string
  defaultSupplierId: string | null
  defaultSupplierName: string | null
  defaultSupplierColour: string
  activeSupplierFilter: string[]
  activeTeamFilter: string
  /** Period's standard working days, used by the same-period conflict dialog's
   *  day-math framing. */
  periodWorkingDays: number
  /** When set the wizard operates in assign-only mode (no new allocation is created). */
  assignMode?: AssignModeConfig
  onAssignSuccess?: (allocationId: string, resourceId: string | null, resourceName: string | null) => void
  /** Called after a same-period conflict is resolved by merging records (the
   *  "Connect and…" options), which soft-delete one row and rewrite another —
   *  the parent should re-fetch to reflect the merged state. */
  onConflictResolved?: () => void
  onClose: () => void
  onSuccess: (data: WizardSuccessPayload) => void
}

/* ── Step indicator ─────────────────────────────────────── */

function StepPills({ step, isAssignMode }: { step: WizardStep; isAssignMode: boolean }) {
  const pillBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--rmg-font-body)',
    transition: 'background 200ms',
  }
  const wrap: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    padding: '12px 20px',
    borderBottom: '1px solid #EEEEEE',
  }

  if (isAssignMode) {
    // Three pills: Search → Teams → Confirm
    const pills = [
      { label: '1 · Search', active: step === 1, done: step > 1 },
      { label: '2 · Teams', active: step === 2, done: step > 2 },
      { label: '3 · Confirm', active: step === 3, done: false },
    ]
    return (
      <div style={wrap}>
        {pills.map(({ label, active, done }) => {
          const bg = done ? DONE_GREEN : active ? ACTIVE_RED : '#E5E7EA'
          const color = done || active ? '#fff' : INACTIVE_GREY
          return <div key={label} style={{ ...pillBase, background: bg, color }}>{label}</div>
        })}
      </div>
    )
  }

  const pills: Array<{ n: WizardStep; label: string }> = [
    { n: 1, label: 'Search' },
    { n: 2, label: 'Details' },
    { n: 3, label: 'Confirm' },
  ]
  return (
    <div style={wrap}>
      {pills.map(({ n, label }) => {
        const done = step > n
        const active = step === n
        const bg = done ? DONE_GREEN : active ? ACTIVE_RED : '#E5E7EA'
        const color = done || active ? '#fff' : INACTIVE_GREY
        return <div key={n} style={{ ...pillBase, background: bg, color }}>{n} · {label}</div>
      })}
    </div>
  )
}

function locationLabel(loc: ResourceLocation | null): string {
  if (!loc) return '—'
  return loc.charAt(0).toUpperCase() + loc.slice(1)
}

let _teamRowCounter = 0
function nextRowId() {
  return `row-${++_teamRowCounter}`
}

/* ── Main component ─────────────────────────────────────── */

export function AddResourceWizard({
  open,
  periodId,
  defaultSupplierId,
  defaultSupplierName,
  defaultSupplierColour,
  activeSupplierFilter,
  activeTeamFilter,
  periodWorkingDays,
  assignMode,
  onAssignSuccess,
  onConflictResolved,
  onClose,
  onSuccess,
}: AddResourceWizardProps) {
  const isAssignMode = !!assignMode
  const [step, setStep] = useState<WizardStep>(1)
  const [mode, setMode] = useState<WizardMode>('tbc')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ResourceSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedResource, setSelectedResource] = useState<ResourceSearchResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Spinner shown while the same-period conflict check runs on pick.
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [teams, setTeams] = useState<TeamOption[]>([])

  // Multi-team builder rows
  const [teamRows, setTeamRows] = useState<TeamRow[]>([{ id: nextRowId(), teamId: '', pct: 100 }])

  const defaultForm = useCallback(
    (): FormState => ({
      supplierId: defaultSupplierId ?? '',
      supplierName: defaultSupplierName ?? '',
      roleTitle: '',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
    }),
    [defaultSupplierId, defaultSupplierName],
  )

  const [form, setForm] = useState<FormState>(defaultForm)
  // Generic (non-assign) "new person" mode only: dedicated name field, kept
  // separate from form.roleTitle so the two can never collapse into the same
  // value (see isValidPersonName).
  const [newPersonName, setNewPersonName] = useState('')
  const [duplicateAdvisory, setDuplicateAdvisory] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Same-period conflict dialog: shown when an already-recognised resource is
  // about to be connected while it already holds another active allocation in
  // this period. Variant A = filling a vacant seat (comparison + four options),
  // variant B = creating a new role (two options). Never a hard block.
  const [conflictDialog, setConflictDialog] = useState<{
    variant: 'A' | 'B'
    conflicts: ConflictAllocation[]
    dayMath: ConflictDayMath
  } | null>(null)

  // Load suppliers + teams when modal opens
  useEffect(() => {
    if (!open) return
    fetchWizardData()
      .then(({ suppliers: s, teams: t }) => {
        setSuppliers(s)
        setTeams(t)
        if (activeTeamFilter !== 'all') {
          const match = t.find((x) => x.team_name === activeTeamFilter)
          if (match) {
            setTeamRows([{ id: nextRowId(), teamId: match.team_id, pct: 100 }])
          }
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Assign mode: preload the TBC row's existing team assignment (if any) and
  // its current resource_location, so the destructive replace in
  // updateTeamAssignments doesn't silently drop pre-existing data.
  useEffect(() => {
    if (!open || !isAssignMode || !assignMode) return
    setForm((prev) => ({ ...prev, resourceLocation: assignMode.resourceLocation ?? 'onshore' }))
    getTeamAssignments(null, periodId, assignMode.allocationId)
      .then((rows) => {
        if (rows.length > 0) {
          setTeamRows(rows.map((r) => ({ id: nextRowId(), teamId: r.teamId, pct: r.split })))
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAssignMode, assignMode])

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1)
      setMode('tbc')
      setSearchQuery('')
      setSearchResults([])
      setIsSearching(false)
      setSelectedResource(null)
      setIsCheckingDuplicate(false)
      setTeamRows([{ id: nextRowId(), teamId: '', pct: 100 }])
      setDuplicateAdvisory(null)
      setSubmitError(null)
      setConflictDialog(null)
      setNewPersonName('')
      setForm(defaultForm())
    }
  }, [open, defaultForm])

  // Debounced search — no supplier filter: results include all suppliers
  const runSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    searchResources(q)
      .then((results) => {
        setSearchResults(results)
        setIsSearching(false)
      })
      .catch(() => {
        setSearchResults([])
        setIsSearching(false)
      })
  }, [])

  function handleSearchChange(q: string) {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 300)
  }

  // Set the existing-resource form (does not change step), so the conflict
  // checkpoint and the normal "continue to Details" path share one place.
  function prepareExistingForm(r: ResourceSearchResult) {
    setSelectedResource(r)
    setMode('existing')
    setForm({
      supplierId: r.supplier_id ?? defaultSupplierId ?? '',
      supplierName: r.supplier_name ?? defaultSupplierName ?? '',
      roleTitle: r.resource_job_title ?? '',
      planviewCode: 'PR',
      resourceLocation: r.resource_location ?? 'onshore',
    })
  }

  // Picking an existing resource fires the same-period conflict check inline,
  // as a checkpoint within Step 1 (Search) — before Teams/Details ever render.
  // Found conflicts → the conflict dialog (variant A for the vacant-seat path,
  // variant B for the new-role path). None → continue exactly as before.
  async function pickResource(r: ResourceSearchResult) {
    setIsCheckingDuplicate(true)
    let conflicts: ConflictAllocation[] = []
    try {
      conflicts = await findResourcePeriodConflicts(
        r.resource_id,
        periodId,
        isAssignMode ? assignMode!.allocationId : null,
      )
    } catch {
      // If the check fails, proceed without it.
    }
    setIsCheckingDuplicate(false)

    if (isAssignMode) {
      setSelectedResource(r)
      setMode('existing')
    } else {
      prepareExistingForm(r)
    }

    if (conflicts.length > 0) {
      const newCapacityDays = isAssignMode ? (assignMode!.capacityDays ?? 0) : 0
      const dayMath = computeConflictDayMath(
        conflicts.map((c) => c.capacity_days),
        newCapacityDays,
        periodWorkingDays,
      )
      setConflictDialog({ variant: isAssignMode ? 'A' : 'B', conflicts, dayMath })
      return
    }

    setStep(2)
  }

  function addAsNew(name: string) {
    if (isAssignMode) {
      setMode('new')
      setSelectedResource(null)
      setForm((prev) => ({ ...prev, roleTitle: name }))
      setStep(2)
      return
    }
    setMode('new')
    setSelectedResource(null)
    setNewPersonName(name)
    setForm({
      supplierId: defaultSupplierId ?? '',
      supplierName: defaultSupplierName ?? '',
      roleTitle: '',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
    })
    setStep(2)
  }

  function skipToTbc() {
    if (isAssignMode) {
      setMode('tbc')
      setSelectedResource(null)
      setStep(2)
      return
    }
    setMode('tbc')
    setSelectedResource(null)
    setForm({
      supplierId: defaultSupplierId ?? '',
      supplierName: defaultSupplierName ?? '',
      roleTitle: '',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
    })
    setStep(2)
  }

  // Duplicate advisory check when entering step 2 in new mode
  useEffect(() => {
    const nameToCheck = isAssignMode ? form.roleTitle : newPersonName
    if (step !== 2 || mode !== 'new' || !nameToCheck) {
      setDuplicateAdvisory(null)
      return
    }
    searchResources(nameToCheck)
      .then((results) => {
        if (results.length > 0) {
          const names = results
            .slice(0, 3)
            .map((r) => r.resource_name)
            .join(', ')
          setDuplicateAdvisory(`Similar name already found: ${names}`)
        } else {
          setDuplicateAdvisory(null)
        }
      })
      .catch(() => setDuplicateAdvisory(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode])

  function handleSupplierChange(supplierId: string) {
    const s = suppliers.find((x) => x.supplier_id === supplierId)
    setForm((prev) => ({
      ...prev,
      supplierId,
      supplierName: s?.supplier_name ?? prev.supplierName,
    }))
  }

  // Team builder handlers
  function addTeamRow() {
    setTeamRows((prev) => [...prev, { id: nextRowId(), teamId: '', pct: 0 }])
  }

  function removeTeamRow(id: string) {
    setTeamRows((prev) => prev.filter((r) => r.id !== id))
  }

  function updateTeamRow(id: string, field: 'teamId' | 'pct', value: string | number) {
    setTeamRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: field === 'pct' ? Number(value) : value } : r,
      ),
    )
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setSubmitError(null)

    // ── Assign mode: update an existing allocation row's resource ─────────────
    if (isAssignMode) {
      const { allocationId, supplierId } = assignMode!

      if (mode === 'tbc') {
        const result = await unassignResourceFromAllocation(allocationId)
        if (!result.success) {
          setIsSubmitting(false)
          setSubmitError(result.error ?? 'Something went wrong. Please try again.')
          return
        }
        const teamAssignments = teamRows
          .filter((r) => r.teamId !== '')
          .map((r) => ({ teamId: r.teamId, capacitySplit: r.pct }))
        await updateTeamAssignments(null, periodId, teamAssignments, allocationId)
        setIsSubmitting(false)
        onAssignSuccess?.(allocationId, null, null)
        onClose()
        return
      }

      if (mode === 'existing' && selectedResource) {
        const result = await assignResourceToAllocation(allocationId, selectedResource.resource_id, form.resourceLocation)
        if (!result.success) {
          setIsSubmitting(false)
          setSubmitError(result.error ?? 'Something went wrong. Please try again.')
          return
        }
        const teamAssignments = teamRows
          .filter((r) => r.teamId !== '')
          .map((r) => ({ teamId: r.teamId, capacitySplit: r.pct }))
        // Always call updateTeamAssignments: it DELETEs existing rows first,
        // then INSERTs new ones. This clears stale assignments even when
        // the user picks "No Team" or skips, avoiding unique constraint violations.
        await updateTeamAssignments(selectedResource.resource_id, periodId, teamAssignments)
        setIsSubmitting(false)
        onAssignSuccess?.(allocationId, selectedResource.resource_id, selectedResource.resource_name)
        onClose()
        return
      }

      if (mode === 'new') {
        if (!isValidPersonName(form.roleTitle, assignMode!.roleTitle)) {
          setIsSubmitting(false)
          setSubmitError("Enter the person's name")
          return
        }
        const insertResult = await insertResource(form.roleTitle, supplierId, form.resourceLocation)
        if (!insertResult.success || !insertResult.resourceId) {
          setIsSubmitting(false)
          setSubmitError(insertResult.error ?? 'Failed to create resource')
          return
        }
        const assignResult = await assignResourceToAllocation(allocationId, insertResult.resourceId, form.resourceLocation)
        if (!assignResult.success) {
          setIsSubmitting(false)
          setSubmitError(assignResult.error ?? 'Failed to assign resource')
          return
        }
        const teamAssignments = teamRows
          .filter((r) => r.teamId !== '')
          .map((r) => ({ teamId: r.teamId, capacitySplit: r.pct }))
        // Always call updateTeamAssignments — clears any pre-existing rows before inserting.
        await updateTeamAssignments(insertResult.resourceId, periodId, teamAssignments)
        setIsSubmitting(false)
        onAssignSuccess?.(allocationId, insertResult.resourceId, form.roleTitle)
        onClose()
        return
      }

      setIsSubmitting(false)
      return
    }

    if (mode === 'edit-teams') {
      const realAssignments = teamRows
        .filter((r) => r.teamId !== '')
        .map((r) => ({ teamId: r.teamId, capacitySplit: r.pct }))

      const result = await updateTeamAssignments(
        selectedResource!.resource_id,
        periodId,
        realAssignments,
      )

      setIsSubmitting(false)

      if (!result.success) {
        setSubmitError(result.error ?? 'Something went wrong. Please try again.')
        return
      }

      const teamPayload = realAssignments.map((a) => {
        const team = teams.find((t) => t.team_id === a.teamId)
        return { teamId: a.teamId, teamName: team?.team_name ?? '' }
      })
      const supplierData = suppliers.find((s) => s.supplier_id === form.supplierId)

      onSuccess({
        allocationId: null,
        isTeamEdit: true,
        resourceId: selectedResource!.resource_id,
        resourceName: selectedResource!.resource_name,
        roleTitle: form.roleTitle,
        supplierId: form.supplierId || null,
        supplierName: form.supplierName || null,
        supplierColour: supplierData?.supplier_colour ?? defaultSupplierColour,
        supplierSortOrder: supplierData?.sort_order ?? null,
        resourceLocation: form.resourceLocation,
        planviewCode: form.planviewCode,
        teams: teamPayload,
        displayOrder: null,
      })
      return
    }

    // Normal path: existing / new / tbc
    if (mode === 'new' && !isValidPersonName(newPersonName, form.roleTitle)) {
      setIsSubmitting(false)
      setSubmitError("Enter the person's name")
      return
    }

    const realTeamAssignments = teamRows
      .filter((r) => r.teamId !== '')
      .map((r) => ({ teamId: r.teamId, capacitySplit: r.pct }))

    const { capacityDays, dayRate } = parseOptionalFigures(form)

    const result = await createResourceAndAllocation({
      mode,
      resourceId: mode === 'existing' ? (selectedResource?.resource_id ?? null) : null,
      resourceName: mode === 'new' ? newPersonName.trim() : null,
      supplierId: form.supplierId,
      supplierName: form.supplierName,
      teamAssignments: realTeamAssignments.length > 0 ? realTeamAssignments : undefined,
      roleTitle: form.roleTitle,
      planviewCode: form.planviewCode,
      resourceLocation: form.resourceLocation,
      periodId,
      capacityDays,
      dayRate,
    })

    setIsSubmitting(false)

    if (!result.success || !result.allocationId) {
      setSubmitError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    const supplierData = suppliers.find((s) => s.supplier_id === form.supplierId)
    const teamPayload = teamRows
      .filter((r) => r.teamId !== '')
      .map((r) => {
        const team = teams.find((t) => t.team_id === r.teamId)
        return { teamId: r.teamId, teamName: team?.team_name ?? '' }
      })

    onSuccess({
      allocationId: result.allocationId,
      isTeamEdit: false,
      resourceId: result.resourceId ?? null,
      resourceName:
        mode === 'existing'
          ? (selectedResource?.resource_name ?? null)
          : mode === 'new'
            ? newPersonName.trim()
            : null,
      roleTitle: form.roleTitle,
      supplierId: form.supplierId || null,
      supplierName: form.supplierName || null,
      supplierColour: supplierData?.supplier_colour ?? defaultSupplierColour,
      supplierSortOrder: supplierData?.sort_order ?? null,
      resourceLocation: form.resourceLocation,
      planviewCode: form.planviewCode,
      teams: teamPayload,
      displayOrder: result.displayOrder ?? null,
    })
  }

  /* ── Same-period conflict resolution (variant A "Connect and…" options) ── */

  async function handleConnectKeepExisting() {
    if (!isAssignMode || !assignMode || !selectedResource) return
    setIsSubmitting(true)
    setSubmitError(null)
    const result = await connectKeepExisting(
      selectedResource.resource_id,
      periodId,
      assignMode.allocationId,
    )
    setIsSubmitting(false)
    if (!result.success) {
      setSubmitError(result.error ?? 'Something went wrong. Please try again.')
      return
    }
    setConflictDialog(null)
    onConflictResolved?.()
    onClose()
  }

  async function handleConnectUseVacant() {
    if (!isAssignMode || !assignMode || !selectedResource || !conflictDialog) return
    // The superseded standalone row is the resource's other active allocation.
    // (A resource holding several is the rare case; the first is superseded and
    // the rest are left untouched — still no hard block.)
    const supersededId = conflictDialog.conflicts[0]?.allocation_id
    if (!supersededId) return
    setIsSubmitting(true)
    setSubmitError(null)
    const result = await connectUseVacant(
      selectedResource.resource_id,
      periodId,
      assignMode.allocationId,
      supersededId,
      form.resourceLocation,
    )
    setIsSubmitting(false)
    if (!result.success) {
      setSubmitError(result.error ?? 'Something went wrong. Please try again.')
      return
    }
    setConflictDialog(null)
    onConflictResolved?.()
    onClose()
  }

  if (!open) return null

  /* ── Styles ── */
  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(241, 242, 245, 0.88)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  }

  const card: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: 12,
    width: 520,
    maxWidth: 'calc(100vw - 32px)',
    // The Details step stacks more fields than a fixed 560px card could hold,
    // which forced an inner scrollbar. Size to content instead: a minHeight
    // keeps the short steps roomy, maxHeight caps growth to the viewport, and
    // the body only scrolls if content genuinely exceeds that cap.
    minHeight: 520,
    maxHeight: 'calc(100vh - 64px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    fontFamily: 'var(--rmg-font-body)',
  }

  const headerStyle: React.CSSProperties = {
    background: HEADER_BG,
    color: '#fff',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  }

  const bodyStyle: React.CSSProperties = {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
  }

  const footerStyle: React.CSSProperties = {
    borderTop: '1px solid #EEEEEE',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    gap: 8,
  }

  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    padding: '7px 16px',
    border: 'none',
  }

  const btnPrimary: React.CSSProperties = { ...btnBase, background: ACTIVE_RED, color: '#fff' }
  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: 'transparent',
    color: '#404044',
    border: '1px solid #C0C0C0',
  }
  const btnDisabled: React.CSSProperties = { ...btnPrimary, background: '#C0C0C0', cursor: 'not-allowed' }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 13,
    padding: '8px 12px',
    border: '1px solid #D0D0D0',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#2A2A2D',
    background: '#fff',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#404044',
    marginBottom: 4,
    display: 'block',
  }

  const fieldWrap: React.CSSProperties = { marginBottom: 14 }

  const teamTotal = teamRows.reduce((s, r) => s + r.pct, 0)
  const roleTitleRequired = mode !== 'edit-teams' && !form.roleTitle.trim()
  const newPersonInvalid =
    mode === 'new' &&
    (isAssignMode
      ? !isValidPersonName(form.roleTitle, assignMode!.roleTitle)
      : !isValidPersonName(newPersonName, form.roleTitle))
  const nextDisabled = step === 2 && (
    isAssignMode
      ? (teamTotal !== 100 || newPersonInvalid)
      : (roleTitleRequired || teamTotal !== 100 || newPersonInvalid)
  )
  const submitLabel = mode === 'edit-teams' ? 'Save changes' : 'Add to schedule'

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{isAssignMode ? 'Assign resource' : 'Add role / resource'}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 6px',
              fontFamily: 'var(--rmg-font-body)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Step pills */}
        <StepPills step={step} isAssignMode={isAssignMode} />

        {/* Body */}
        <div style={bodyStyle}>
          {step === 1 && (
            <Step1Body
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              isSearching={isSearching || isCheckingDuplicate}
              results={searchResults}
              onPickResource={pickResource}
              onAddAsNew={addAsNew}
              onSkipToTbc={skipToTbc}
              inputStyle={inputStyle}
            />
          )}
          {step === 2 && isAssignMode && (
            <div>
              {/* Who is being assigned */}
              <div style={{ background: '#F1F2F5', border: '1px solid #E0E0E0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#2A2A2D' }}>
                  {mode === 'existing' ? (selectedResource?.resource_name ?? '—') : mode === 'new' ? form.roleTitle : 'TBC'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: INACTIVE_GREY }}>
                  Will be assigned to: {assignMode!.roleTitle || '—'}
                </p>
                {mode === 'new' && newPersonInvalid && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: ACTIVE_RED }}>
                    Enter the person&apos;s name
                  </p>
                )}
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Location</label>
                <select
                  value={form.resourceLocation}
                  onChange={(e) => setForm((prev) => ({ ...prev, resourceLocation: e.target.value as ResourceLocation }))}
                  style={selectStyle}
                >
                  <option value="onshore">Onshore</option>
                  <option value="nearshore">Nearshore</option>
                  <option value="offshore">Offshore</option>
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Team(s)</label>
                <TeamBuilder
                  rows={teamRows}
                  teams={teams}
                  total={teamTotal}
                  onAdd={addTeamRow}
                  onRemove={removeTeamRow}
                  onChange={updateTeamRow}
                  selectStyle={selectStyle}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setTeamRows([{ id: nextRowId(), teamId: '', pct: 100 }])
                  setStep(3)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 12,
                  color: INACTIVE_GREY,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  fontFamily: 'var(--rmg-font-body)',
                }}
              >
                Skip team assignment
              </button>
            </div>
          )}
          {step === 2 && !isAssignMode && (
            <Step2Body
              mode={mode}
              selectedResource={selectedResource}
              form={form}
              suppliers={suppliers}
              teams={teams}
              teamRows={teamRows}
              teamTotal={teamTotal}
              duplicateAdvisory={duplicateAdvisory}
              personName={newPersonName}
              personNameInvalid={newPersonInvalid}
              onPersonNameChange={setNewPersonName}
              onSupplierChange={handleSupplierChange}
              onAddTeamRow={addTeamRow}
              onRemoveTeamRow={removeTeamRow}
              onTeamRowChange={updateTeamRow}
              onFormChange={(key, val) => setForm((prev) => ({ ...prev, [key]: val }))}
              onChangeResource={() => setStep(1)}
              inputStyle={inputStyle}
              selectStyle={selectStyle}
              labelStyle={labelStyle}
              fieldWrap={fieldWrap}
            />
          )}
          {step === 3 && (
            <Step3Body
              mode={mode}
              selectedResource={selectedResource}
              form={form}
              personName={newPersonName}
              teamRows={teamRows}
              teams={teams}
              summaryBg={SUMMARY_BG}
              assignRoleTitle={isAssignMode ? (assignMode!.roleTitle || '—') : undefined}
            />
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as WizardStep)}
                style={btnSecondary}
              >
                ← Back
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {submitError && (
              <span style={{ fontSize: 12, color: ACTIVE_RED, maxWidth: 220 }}>
                {submitError}
              </span>
            )}
            <button type="button" onClick={onClose} style={btnSecondary}>
              Cancel
            </button>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as WizardStep)}
                disabled={nextDisabled}
                style={nextDisabled ? btnDisabled : btnPrimary}
              >
                Next →
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
                style={isSubmitting ? btnDisabled : btnPrimary}
              >
                {isSubmitting ? 'Saving…' : isAssignMode ? 'Assign' : submitLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {conflictDialog && (
        <ConflictDialog
          variant={conflictDialog.variant}
          dayMath={conflictDialog.dayMath}
          existingRows={conflictDialog.conflicts}
          resourceName={selectedResource?.resource_name ?? '—'}
          newRow={
            isAssignMode && assignMode
              ? {
                  heading: 'Vacant seat',
                  roleTitle: assignMode.roleTitle || '—',
                  capacityDays: assignMode.capacityDays ?? null,
                  dayRate: assignMode.dayRate ?? 0,
                  teamNames: assignMode.teamNames ?? [],
                }
              : {
                  heading: 'New role',
                  roleTitle: form.roleTitle || '—',
                  capacityDays: null,
                  dayRate: 0,
                  teamNames: [],
                }
          }
          isSubmitting={isSubmitting}
          onKeepExisting={handleConnectKeepExisting}
          onUseVacant={handleConnectUseVacant}
          onKeepBoth={() => {
            // "Keep both/all as separate rows" → continue into the normal Teams
            // (vacant-seat path) or Details (new-role path) step.
            setConflictDialog(null)
            setStep(2)
          }}
          onCancel={() => {
            // Back to Step 1 with the search cleared.
            setConflictDialog(null)
            setSelectedResource(null)
            setSearchQuery('')
            setSearchResults([])
            setMode('tbc')
            setStep(1)
          }}
        />
      )}
    </div>
  )
}

/* ── Same-period conflict dialog ─────────────────────────── */

interface NewRowSummary {
  /** "Vacant seat" (vacant-seat path) or "New role" (new-role path). */
  heading: string
  roleTitle: string
  capacityDays: number | null
  dayRate: number
  teamNames: string[]
}

/** One existing/new entry rendered as a single line in the multi-row list. */
function ConflictListRow({
  heading,
  role,
  teams,
  capacityDays,
  dayRate,
  isNew,
}: {
  heading: string
  role: string
  teams: string
  capacityDays: number | null
  dayRate: number
  isNew: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 6,
        marginBottom: 6,
        background: isNew ? 'rgba(218,32,42,0.05)' : 'var(--rmg-color-grey-4)',
        border: isNew ? '1px solid rgba(218,32,42,0.22)' : '1px solid var(--rmg-color-grey-3)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--rmg-color-text-body)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {isNew && (
          <span style={{ fontWeight: 700, color: ACTIVE_RED, marginRight: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            New
          </span>
        )}
        {[role || '—', teams, dayLabel(capacityDays), `${formatMoneyPence(dayRate)}/day`].join(' · ')}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rmg-color-grey-1)', flexShrink: 0 }}>
        {heading}
      </span>
    </div>
  )
}

function dayLabel(days: number | null): string {
  if (days === null) return '— days'
  return `${days} day${days === 1 ? '' : 's'}`
}

function teamLabel(names: string[]): string {
  return names.length > 0 ? names.join(', ') : 'No team'
}

/** One labelled record card used in the variant-A side-by-side comparison. */
function ConflictRecordCard({
  heading,
  role,
  teams,
  capacityDays,
  dayRate,
  emphasised,
}: {
  heading: string
  role: string
  teams: string
  capacityDays: number | null
  dayRate: number
  emphasised: boolean
}) {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 12,
    marginTop: 4,
  }
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--rmg-color-white)',
        border: emphasised
          ? '1.5px solid rgba(218,32,42,0.22)'
          : '1px solid var(--rmg-color-grey-3)',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--rmg-color-grey-1)',
        }}
      >
        {heading}
      </p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--rmg-color-text-heading)' }}>
        {role || '—'}
      </p>
      <div style={rowStyle}>
        <span style={{ color: 'var(--rmg-color-grey-1)' }}>Team</span>
        <span style={{ color: 'var(--rmg-color-text-body)', textAlign: 'right' }}>{teams}</span>
      </div>
      <div style={rowStyle}>
        <span style={{ color: 'var(--rmg-color-grey-1)' }}>Capacity</span>
        <span style={{ color: 'var(--rmg-color-text-body)' }}>{dayLabel(capacityDays)}</span>
      </div>
      <div style={rowStyle}>
        <span style={{ color: 'var(--rmg-color-grey-1)' }}>Rate</span>
        <span style={{ color: 'var(--rmg-color-text-body)' }}>{formatMoneyPence(dayRate)}/day</span>
      </div>
    </div>
  )
}

function ConflictDialog({
  variant,
  dayMath,
  existingRows,
  resourceName,
  newRow,
  isSubmitting,
  onKeepExisting,
  onUseVacant,
  onKeepBoth,
  onCancel,
}: {
  variant: 'A' | 'B'
  dayMath: ConflictDayMath
  existingRows: ConflictAllocation[]
  resourceName: string
  newRow: NewRowSummary
  isSubmitting: boolean
  onKeepExisting: () => void
  onUseVacant: () => void
  onKeepBoth: () => void
  onCancel: () => void
}) {
  // Display decision (pure): how many rows, which layout, button copy/count.
  const present = describeConflictPresentation(existingRows.length, variant === 'A')

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(42, 42, 45, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  }
  const card: React.CSSProperties = {
    background: 'var(--rmg-color-white)',
    borderRadius: 12,
    width: 480,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 64px)',
    overflowY: 'auto',
    boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
    fontFamily: 'var(--rmg-font-body)',
    padding: '20px',
  }

  // Shared button styles — emphasised (recommended) vs muted (de-emphasised)
  // follow the codebase conventions (ADR-023, inline styles, --rmg-* tokens).
  const btnBlock: React.CSSProperties = {
    width: '100%',
    textAlign: 'left',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: isSubmitting ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--rmg-font-body)',
    marginBottom: 8,
  }
  const btnEmphasised: React.CSSProperties = {
    ...btnBlock,
    background: ACTIVE_RED,
    color: 'var(--rmg-color-white)',
    border: 'none',
  }
  const btnNeutral: React.CSSProperties = {
    ...btnBlock,
    background: 'var(--rmg-color-black)',
    color: 'var(--rmg-color-white)',
    border: 'none',
  }
  const btnMuted: React.CSSProperties = {
    ...btnBlock,
    background: 'transparent',
    color: 'var(--rmg-color-grey-1)',
    border: '1px solid var(--rmg-color-grey-2)',
  }

  // Compare layout: over capacity → keeping existing details is recommended;
  // fitting within a quarter → keeping the rows separate is recommended. In the
  // list layout the only real action is keep-separate, so it's the primary.
  const keepExistingStyle = dayMath.overCapacity ? btnEmphasised : btnMuted
  const keepSeparateStyle =
    present.layout === 'list' ? btnEmphasised : dayMath.overCapacity ? btnMuted : btnEmphasised

  const framing = (
    <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--rmg-color-text-body)', lineHeight: 1.45 }}>
      {resourceName} already has {dayMath.existingCount} other active allocation
      {dayMath.existingCount === 1 ? '' : 's'} this period totalling{' '}
      {dayMath.existingTotalCapacityDays} day{dayMath.existingTotalCapacityDays === 1 ? '' : 's'}.
      With this row that is{' '}
      <strong style={{ color: dayMath.overCapacity ? ACTIVE_RED : 'var(--rmg-color-text-heading)' }}>
        {dayMath.combinedCapacityDays} of {dayMath.periodWorkingDays} working days
      </strong>{' '}
      in this period
      {dayMath.overCapacity ? ' — over a full quarter.' : '.'}
    </p>
  )

  return (
    <div style={overlay} onClick={(e) => e.stopPropagation()}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--rmg-color-text-heading)' }}>
          {resourceName} is already on this period&apos;s schedule
        </p>

        {framing}

        {present.layout === 'compare' ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <ConflictRecordCard
              heading={newRow.heading}
              role={newRow.roleTitle}
              teams={teamLabel(newRow.teamNames)}
              capacityDays={newRow.capacityDays}
              dayRate={newRow.dayRate}
              emphasised={!dayMath.overCapacity}
            />
            <ConflictRecordCard
              heading="Existing entry"
              role={existingRows[0]?.role_title ?? '—'}
              teams={teamLabel(existingRows[0]?.team_names ?? [])}
              capacityDays={existingRows[0]?.capacity_days ?? null}
              dayRate={existingRows[0]?.day_rate ?? 0}
              emphasised={dayMath.overCapacity}
            />
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {existingRows.map((row, idx) => (
              <ConflictListRow
                key={row.allocation_id}
                heading={`Existing ${idx + 1}`}
                role={row.role_title ?? '—'}
                teams={teamLabel(row.team_names)}
                capacityDays={row.capacity_days}
                dayRate={row.day_rate}
                isNew={false}
              />
            ))}
            <ConflictListRow
              heading={newRow.heading}
              role={newRow.roleTitle}
              teams={teamLabel(newRow.teamNames)}
              capacityDays={newRow.capacityDays}
              dayRate={newRow.dayRate}
              isNew
            />
          </div>
        )}

        {present.showConnectOptions && (
          <>
            <button type="button" style={keepExistingStyle} disabled={isSubmitting} onClick={onKeepExisting}>
              Connect and keep existing details
            </button>
            <button type="button" style={btnNeutral} disabled={isSubmitting} onClick={onUseVacant}>
              Connect and use vacant seat details
            </button>
          </>
        )}
        <button type="button" style={keepSeparateStyle} disabled={isSubmitting} onClick={onKeepBoth}>
          {present.keepLabel}
        </button>
        <button type="button" style={btnMuted} disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ── Team builder ───────────────────────────────────────── */

function TeamBuilder({
  rows,
  teams,
  total,
  onAdd,
  onRemove,
  onChange,
  selectStyle,
}: {
  rows: TeamRow[]
  teams: TeamOption[]
  total: number
  onAdd: () => void
  onRemove: (id: string) => void
  onChange: (id: string, field: 'teamId' | 'pct', value: string | number) => void
  selectStyle: React.CSSProperties
}) {
  const totalColour = total === 100 ? DONE_GREEN : total > 100 ? ACTIVE_RED : AMBER
  const canRemove = rows.length > 1

  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <select
            value={row.teamId}
            onChange={(e) => onChange(row.id, 'teamId', e.target.value)}
            style={{ ...selectStyle, flex: 1, marginBottom: 0 }}
          >
            <option value="">No Team</option>
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.team_name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={100}
            value={row.pct}
            onChange={(e) => onChange(row.id, 'pct', e.target.value)}
            style={{
              ...selectStyle,
              width: 72,
              flex: 'none',
              marginBottom: 0,
              textAlign: 'right',
            }}
          />
          <span style={{ fontSize: 13, color: '#404044', flexShrink: 0 }}>%</span>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              aria-label="Remove row"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: INACTIVE_GREY,
                fontSize: 16,
                lineHeight: 1,
                padding: '4px',
                flexShrink: 0,
                fontFamily: 'var(--rmg-font-body)',
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: 12,
          color: ACTIVE_RED,
          cursor: 'pointer',
          padding: '2px 0',
          fontFamily: 'var(--rmg-font-body)',
          fontWeight: 600,
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 8,
        }}
      >
        + Add team
      </button>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: totalColour,
          fontWeight: 600,
        }}
      >
        Total: {total}%
        {total === 100 && <span>✓</span>}
        {total !== 100 && (
          <span style={{ fontWeight: 400, color: INACTIVE_GREY }}>
            (must be 100% to continue)
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Step 1 body ────────────────────────────────────────── */

function Step1Body({
  searchQuery,
  onSearchChange,
  isSearching,
  results,
  onPickResource,
  onAddAsNew,
  onSkipToTbc,
  inputStyle,
}: {
  searchQuery: string
  onSearchChange: (q: string) => void
  isSearching: boolean
  results: ResourceSearchResult[]
  onPickResource: (r: ResourceSearchResult) => void
  onAddAsNew: (name: string) => void
  onSkipToTbc: () => void
  inputStyle: React.CSSProperties
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const noMatch = searchQuery.length >= 2 && !isSearching && results.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* keyframes for spinner — injected once per mount */}
      <style>{`@keyframes wizard-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ position: 'relative', marginBottom: 12, flexShrink: 0 }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#8F9495',
            pointerEvents: 'none',
            display: 'flex',
          }}
          aria-hidden
        >
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Search by name…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 32 }}
          autoFocus
        />
      </div>

      {/* Fixed-height results area — spinner / list / no-match / empty */}
      <div
        style={{
          height: 280,
          overflowY: 'auto',
          flexShrink: 0,
          marginBottom: 12,
        }}
      >
        {isSearching && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '2px solid #E5E7EA',
                borderTopColor: ACTIVE_RED,
                animation: 'wizard-spin 0.6s linear infinite',
              }}
            />
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div
            style={{
              border: '1px solid #EEEEEE',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {results.map((r, idx) => (
              <button
                key={r.resource_id}
                type="button"
                onClick={() => onPickResource(r)}
                onMouseEnter={() => setHoveredId(r.resource_id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 14px',
                  background: hoveredId === r.resource_id ? '#F5F5F5' : '#fff',
                  border: 'none',
                  borderBottom: idx < results.length - 1 ? '1px solid #F5F5F5' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--rmg-font-body)',
                  transition: 'background 100ms',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: r.supplier_colour ?? INACTIVE_GREY,
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2A2A2D' }}>
                    {highlightMatch(r.resource_name, searchQuery)}
                  </div>
                  <div style={{ fontSize: 11, color: INACTIVE_GREY, marginTop: 2 }}>
                    {r.resource_job_title ?? '—'} · {r.supplier_name ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: INACTIVE_GREY }}>
                    {locationLabel(r.resource_location)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!isSearching && noMatch && (
          <div
            style={{
              background: '#FFF8F8',
              border: '1px solid #FFD0D0',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <p style={{ fontSize: 13, color: '#2A2A2D', margin: '0 0 8px' }}>
              No match for &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => onAddAsNew(searchQuery)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: ACTIVE_RED,
                background: 'transparent',
                border: `1px solid ${ACTIVE_RED}`,
                borderRadius: 6,
                padding: '5px 10px',
                cursor: 'pointer',
                fontFamily: 'var(--rmg-font-body)',
              }}
            >
              Add &ldquo;{searchQuery}&rdquo; as new person
            </button>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        <button
          type="button"
          onClick={onSkipToTbc}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 12,
            color: INACTIVE_GREY,
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
            fontFamily: 'var(--rmg-font-body)',
          }}
        >
          Skip — add as TBC
        </button>
      </div>
    </div>
  )
}

/* ── Step 2 body ────────────────────────────────────────── */

function Step2Body({
  mode,
  selectedResource,
  form,
  suppliers,
  teams,
  teamRows,
  teamTotal,
  duplicateAdvisory,
  personName,
  personNameInvalid,
  onPersonNameChange,
  onSupplierChange,
  onAddTeamRow,
  onRemoveTeamRow,
  onTeamRowChange,
  onFormChange,
  onChangeResource,
  inputStyle,
  selectStyle,
  labelStyle,
  fieldWrap,
}: {
  mode: WizardMode
  selectedResource: ResourceSearchResult | null
  form: FormState
  suppliers: SupplierOption[]
  teams: TeamOption[]
  teamRows: TeamRow[]
  teamTotal: number
  duplicateAdvisory: string | null
  personName: string
  personNameInvalid: boolean
  onPersonNameChange: (val: string) => void
  onSupplierChange: (id: string) => void
  onAddTeamRow: () => void
  onRemoveTeamRow: (id: string) => void
  onTeamRowChange: (id: string, field: 'teamId' | 'pct', value: string | number) => void
  onFormChange: (key: keyof FormState, val: string) => void
  onChangeResource: () => void
  inputStyle: React.CSSProperties
  selectStyle: React.CSSProperties
  labelStyle: React.CSSProperties
  fieldWrap: React.CSSProperties
}) {
  return (
    <div>
      {/* Edit-teams banner */}
      {mode === 'edit-teams' && selectedResource && (
        <div
          style={{
            background: '#EDF2FF',
            border: '1px solid #BEC8FF',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#2A2A2D' }}>
            Editing team assignments for {selectedResource.resource_name}
          </p>
        </div>
      )}

      {/* Existing resource banner */}
      {mode === 'existing' && selectedResource && (
        <div
          style={{
            background: '#F1F2F5',
            border: '1px solid #E0E0E0',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: selectedResource.supplier_colour ?? INACTIVE_GREY,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2A2A2D' }}>
              {selectedResource.resource_name}
            </span>
            <span style={{ fontSize: 12, color: INACTIVE_GREY, marginLeft: 8 }}>
              {selectedResource.resource_job_title ?? '—'} · {selectedResource.supplier_name ?? '—'}
            </span>
          </div>
          <button
            type="button"
            onClick={onChangeResource}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 12,
              color: ACTIVE_RED,
              cursor: 'pointer',
              fontFamily: 'var(--rmg-font-body)',
              textDecoration: 'underline',
              padding: 0,
              flexShrink: 0,
            }}
          >
            Change
          </button>
        </div>
      )}

      {/* New person banner */}
      {mode === 'new' && (
        <div
          style={{
            background: '#FFF8ED',
            border: '1px solid #FFD98A',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#2A2A2D', fontWeight: 500 }}>
            New person — will be added to the resources table
          </p>
          {duplicateAdvisory && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#A06000' }}>
              ⚠ {duplicateAdvisory}
            </p>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div style={fieldWrap}>
          <label style={labelStyle}>
            Person&apos;s name <span style={{ color: ACTIVE_RED }}>*</span>
          </label>
          <input
            type="text"
            value={personName}
            onChange={(e) => onPersonNameChange(e.target.value)}
            placeholder="e.g. Sarah Chen"
            style={inputStyle}
          />
          {personNameInvalid && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: ACTIVE_RED }}>
              Enter the person&apos;s name
            </p>
          )}
        </div>
      )}

      <div style={fieldWrap}>
        <label style={labelStyle}>Supplier</label>
        <select
          value={form.supplierId}
          onChange={(e) => onSupplierChange(e.target.value)}
          style={selectStyle}
        >
          {suppliers.length === 0 ? (
            <option value={form.supplierId}>{form.supplierName || 'Loading…'}</option>
          ) : (
            suppliers.map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>
                {s.supplier_name}
              </option>
            ))
          )}
        </select>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle}>Team(s)</label>
        <TeamBuilder
          rows={teamRows}
          teams={teams}
          total={teamTotal}
          onAdd={onAddTeamRow}
          onRemove={onRemoveTeamRow}
          onChange={onTeamRowChange}
          selectStyle={selectStyle}
        />
      </div>

      {mode !== 'edit-teams' && (
        <div style={fieldWrap}>
          <label style={labelStyle}>
            Role title <span style={{ color: ACTIVE_RED }}>*</span>
          </label>
          <input
            type="text"
            value={form.roleTitle}
            onChange={(e) => onFormChange('roleTitle', e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            style={inputStyle}
          />
        </div>
      )}

      {mode !== 'edit-teams' && (
        <div style={fieldWrap}>
          <label style={labelStyle}>Plan</label>
          <select
            value={form.planviewCode}
            onChange={(e) => onFormChange('planviewCode', e.target.value)}
            style={selectStyle}
          >
            <option value="PR">PR</option>
            <option value="F_Gov">F_Gov</option>
            <option value="BAU">BAU</option>
          </select>
        </div>
      )}

      {mode !== 'edit-teams' && (
        <div style={fieldWrap}>
          <label style={labelStyle}>Location</label>
          <select
            value={form.resourceLocation}
            onChange={(e) => onFormChange('resourceLocation', e.target.value)}
            style={selectStyle}
          >
            <option value="onshore">Onshore</option>
            <option value="nearshore">Nearshore</option>
            <option value="offshore">Offshore</option>
          </select>
        </div>
      )}

      {/* Optional starting figures — brand-new-person and TBC rows are created
          at 0 days / £0 by default; fill these to seed them directly. */}
      {(mode === 'new' || mode === 'tbc') && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...fieldWrap, flex: 1 }}>
            <label style={labelStyle}>Capacity (days)</label>
            <input
              type="number"
              min={0}
              value={form.capacityDays ?? ''}
              onChange={(e) => onFormChange('capacityDays', e.target.value)}
              placeholder="Optional"
              style={inputStyle}
            />
          </div>
          <div style={{ ...fieldWrap, flex: 1 }}>
            <label style={labelStyle}>Day rate (£)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.dayRate ?? ''}
              onChange={(e) => onFormChange('dayRate', e.target.value)}
              placeholder="Optional"
              style={inputStyle}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Step 3 body ────────────────────────────────────────── */

function Step3Body({
  mode,
  selectedResource,
  form,
  personName,
  teamRows,
  teams,
  summaryBg,
  assignRoleTitle,
}: {
  mode: WizardMode
  selectedResource: ResourceSearchResult | null
  form: FormState
  personName: string
  teamRows: TeamRow[]
  teams: TeamOption[]
  summaryBg: string
  assignRoleTitle?: string
}) {
  // ── Assign mode: summary ─────────────────────────────────────────────────────
  if (assignRoleTitle !== undefined) {
    const resourceLabel =
      mode === 'tbc' ? 'TBC'
      : mode === 'existing' ? (selectedResource?.resource_name ?? '—')
      : `${form.roleTitle} (new person)` // assign-mode: form.roleTitle holds the person's name

    const teamLabel = teamRows
      .filter((r) => r.teamId !== '')
      .map((r) => {
        const team = teams.find((t) => t.team_id === r.teamId)
        return `${team?.team_name ?? r.teamId} ${r.pct}%`
      })
      .join(', ') || 'No Team'

    const summaryRows: Array<{ label: string; value: string }> = [
      { label: 'Resource', value: resourceLabel },
      { label: 'Will be assigned to', value: assignRoleTitle },
      { label: 'Team(s)', value: teamLabel },
    ]

    return (
      <div style={{ background: summaryBg, borderRadius: 8, overflow: 'hidden' }}>
        {summaryRows.map(({ label, value }, idx) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '9px 16px',
              borderBottom: idx < summaryRows.length - 1 ? '1px solid #E8E9EC' : 'none',
            }}
          >
            <span style={{ fontSize: 12, color: INACTIVE_GREY, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 13, color: '#2A2A2D', fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── Normal mode ──────────────────────────────────────────────────────────────
  const resourceLabel =
    mode === 'edit-teams'
      ? (selectedResource?.resource_name ?? '—')
      : mode === 'existing'
        ? (selectedResource?.resource_name ?? '—')
        : mode === 'new'
          ? `${personName} (new person)`
          : 'TBC'

  const teamLabel = teamRows
    .filter((r) => r.teamId !== '')
    .map((r) => {
      const team = teams.find((t) => t.team_id === r.teamId)
      return `${team?.team_name ?? r.teamId} ${r.pct}%`
    })
    .join(', ') || 'No Team'

  // Optional starting figures (new / TBC paths). When provided they appear in
  // the summary like any other field and the "edit inline" note drops away.
  const { capacityDays, dayRate } = parseOptionalFigures(form)
  const hasFigures = capacityDays !== undefined || dayRate !== undefined

  const rows: Array<{ label: string; value: string }> =
    mode === 'edit-teams'
      ? [
          { label: 'Resource', value: resourceLabel },
          { label: 'Team(s)', value: teamLabel },
        ]
      : [
          { label: 'Resource', value: resourceLabel },
          { label: 'Supplier', value: form.supplierName || '—' },
          { label: 'Team(s)', value: teamLabel },
          { label: 'Role', value: form.roleTitle || '—' },
          { label: 'Plan', value: form.planviewCode },
          { label: 'Location', value: locationLabel(form.resourceLocation) },
          ...(capacityDays !== undefined
            ? [{ label: 'Capacity (days)', value: String(capacityDays) }]
            : []),
          ...(dayRate !== undefined
            ? [{ label: 'Day rate', value: `${formatMoneyPence(dayRate)}/day` }]
            : []),
        ]

  return (
    <div>
      <div style={{ background: summaryBg, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
        {rows.map(({ label, value }, idx) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '9px 16px',
              borderBottom: idx < rows.length - 1 ? '1px solid #E8E9EC' : 'none',
            }}
          >
            <span style={{ fontSize: 12, color: INACTIVE_GREY, fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: 13, color: '#2A2A2D', fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>
      {mode !== 'edit-teams' && !hasFigures && (
        <p style={{ fontSize: 12, color: INACTIVE_GREY, margin: 0 }}>
          Days and rate default to 0 — edit inline after adding.
        </p>
      )}
    </div>
  )
}

/* ── Icon ───────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
