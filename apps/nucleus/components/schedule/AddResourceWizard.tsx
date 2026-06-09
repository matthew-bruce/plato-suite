'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ResourceLocation, PlanviewCode } from '@plato/schema'
import {
  searchResources,
  fetchWizardData,
  createResourceAndAllocation,
  checkResourceInPeriod,
  updateTeamAssignments,
} from '@/app/actions/schedule-wizard'
import type {
  ResourceSearchResult,
  SupplierOption,
  TeamOption,
  CheckPeriodRow,
} from '@/app/actions/schedule-wizard'

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
}

interface ForkInfo {
  target: ResourceSearchResult
  rows: CheckPeriodRow[]
  existingTeams: Array<{ teamId: string; teamName: string; capacitySplit: number }>
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

export interface AddResourceWizardProps {
  open: boolean
  periodId: string
  defaultSupplierId: string | null
  defaultSupplierName: string | null
  defaultSupplierColour: string
  activeSupplierFilter: string[]
  activeTeamFilter: string
  onClose: () => void
  onSuccess: (data: WizardSuccessPayload) => void
}

/* ── Step indicator ─────────────────────────────────────── */

function StepPills({ step }: { step: WizardStep }) {
  const pills: Array<{ n: WizardStep; label: string }> = [
    { n: 1, label: 'Search' },
    { n: 2, label: 'Details' },
    { n: 3, label: 'Confirm' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '12px 20px',
        borderBottom: '1px solid #EEEEEE',
      }}
    >
      {pills.map(({ n, label }) => {
        const done = step > n
        const active = step === n
        const bg = done ? DONE_GREEN : active ? ACTIVE_RED : '#E5E7EA'
        const color = done || active ? '#fff' : INACTIVE_GREY
        return (
          <div
            key={n}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: bg,
              color,
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--rmg-font-body)',
              transition: 'background 200ms',
            }}
          >
            {n} · {label}
          </div>
        )
      })}
    </div>
  )
}

/* ── Highlight matched substring ────────────────────────── */

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>
  const lower = text.toLowerCase()
  const q = query.toLowerCase().trim()
  const idx = lower.indexOf(q)
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <strong>{text.slice(idx, idx + q.length)}</strong>
      {text.slice(idx + q.length)}
    </span>
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
  onClose,
  onSuccess,
}: AddResourceWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [mode, setMode] = useState<WizardMode>('tbc')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ResourceSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedResource, setSelectedResource] = useState<ResourceSearchResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fork panel (duplicate detection)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
  const [showFork, setShowFork] = useState(false)
  const [forkInfo, setForkInfo] = useState<ForkInfo | null>(null)
  const [addSecondRowBanner, setAddSecondRowBanner] = useState(false)

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
  const [duplicateAdvisory, setDuplicateAdvisory] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1)
      setMode('tbc')
      setSearchQuery('')
      setSearchResults([])
      setIsSearching(false)
      setSelectedResource(null)
      setShowFork(false)
      setForkInfo(null)
      setAddSecondRowBanner(false)
      setIsCheckingDuplicate(false)
      setTeamRows([{ id: nextRowId(), teamId: '', pct: 100 }])
      setDuplicateAdvisory(null)
      setSubmitError(null)
      setForm(defaultForm())
    }
  }, [open, defaultForm])

  // Debounced search
  const runSearch = useCallback(
    (q: string) => {
      if (q.length < 2) {
        setSearchResults([])
        setIsSearching(false)
        return
      }
      setIsSearching(true)
      const supplierFilter = activeSupplierFilter.length === 1 ? activeSupplierFilter[0] : null
      searchResources(q, supplierFilter)
        .then((results) => {
          setSearchResults(results)
          setIsSearching(false)
        })
        .catch(() => {
          setSearchResults([])
          setIsSearching(false)
        })
    },
    [activeSupplierFilter],
  )

  function handleSearchChange(q: string) {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 300)
  }

  async function pickResource(r: ResourceSearchResult) {
    setIsCheckingDuplicate(true)
    let checkResult = { exists: false, rows: [] as CheckPeriodRow[], existingTeamAssignments: [] as Array<{ teamId: string; teamName: string; capacitySplit: number }> }
    try {
      checkResult = await checkResourceInPeriod(r.resource_id, periodId)
    } catch {
      // If check fails, proceed normally
    }
    setIsCheckingDuplicate(false)

    if (checkResult.exists) {
      setForkInfo({ target: r, rows: checkResult.rows, existingTeams: checkResult.existingTeamAssignments })
      setShowFork(true)
      return
    }

    advanceToStep2Existing(r)
  }

  function advanceToStep2Existing(r: ResourceSearchResult) {
    setSelectedResource(r)
    setMode('existing')
    setForm({
      supplierId: r.supplier_id ?? defaultSupplierId ?? '',
      supplierName: r.supplier_name ?? defaultSupplierName ?? '',
      roleTitle: r.resource_job_title ?? '',
      planviewCode: 'PR',
      resourceLocation: r.resource_location ?? 'onshore',
    })
    setStep(2)
  }

  function handleEditTeams() {
    const info = forkInfo!
    const rows =
      info.existingTeams.length > 0
        ? info.existingTeams.map((t) => ({ id: nextRowId(), teamId: t.teamId, pct: t.capacitySplit }))
        : [{ id: nextRowId(), teamId: '', pct: 100 }]
    setTeamRows(rows)
    setSelectedResource(info.target)
    setMode('edit-teams')
    setShowFork(false)
    setForkInfo(null)
    setForm({
      supplierId: info.target.supplier_id ?? defaultSupplierId ?? '',
      supplierName: info.target.supplier_name ?? defaultSupplierName ?? '',
      roleTitle: info.rows[0]?.role_title ?? '',
      planviewCode: (info.rows[0]?.planview_code as 'PR' | 'F_Gov' | 'BAU') ?? 'PR',
      resourceLocation: info.target.resource_location ?? 'onshore',
    })
    setStep(2)
  }

  function handleAddSecondRow() {
    const info = forkInfo!
    setAddSecondRowBanner(true)
    setShowFork(false)
    setForkInfo(null)
    advanceToStep2Existing(info.target)
  }

  function addAsNew(name: string) {
    setMode('new')
    setSelectedResource(null)
    setForm({
      supplierId: defaultSupplierId ?? '',
      supplierName: defaultSupplierName ?? '',
      roleTitle: name,
      planviewCode: 'PR',
      resourceLocation: 'onshore',
    })
    setStep(2)
  }

  function skipToTbc() {
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
    if (step !== 2 || mode !== 'new' || !form.roleTitle) {
      setDuplicateAdvisory(null)
      return
    }
    searchResources(form.roleTitle)
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
    const realTeamAssignments = teamRows
      .filter((r) => r.teamId !== '')
      .map((r) => ({ teamId: r.teamId, capacitySplit: r.pct }))

    const result = await createResourceAndAllocation({
      mode,
      resourceId: mode === 'existing' ? (selectedResource?.resource_id ?? null) : null,
      resourceName: mode === 'new' ? form.roleTitle : null,
      supplierId: form.supplierId,
      supplierName: form.supplierName,
      teamAssignments: realTeamAssignments.length > 0 ? realTeamAssignments : undefined,
      roleTitle: form.roleTitle,
      planviewCode: form.planviewCode,
      resourceLocation: form.resourceLocation,
      periodId,
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
            ? form.roleTitle
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
  const nextDisabled = step === 2 && (roleTitleRequired || teamTotal !== 100)
  const submitLabel = mode === 'edit-teams' ? 'Save changes' : 'Add to schedule'

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Add role / resource</span>
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
        <StepPills step={step} />

        {/* Body */}
        <div style={bodyStyle}>
          {step === 1 && (
            showFork && forkInfo ? (
              <ForkPanel
                info={forkInfo}
                onEditTeams={handleEditTeams}
                onAddSecondRow={handleAddSecondRow}
                onBack={() => { setShowFork(false); setForkInfo(null) }}
              />
            ) : (
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
            )
          )}
          {step === 2 && (
            <Step2Body
              mode={mode}
              selectedResource={selectedResource}
              form={form}
              suppliers={suppliers}
              teams={teams}
              teamRows={teamRows}
              teamTotal={teamTotal}
              duplicateAdvisory={duplicateAdvisory}
              addSecondRowBanner={addSecondRowBanner}
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
              teamRows={teamRows}
              teams={teams}
              summaryBg={SUMMARY_BG}
            />
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as WizardStep)}
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
            {step > 1 && step < 3 && (
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
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={isSubmitting ? btnDisabled : btnPrimary}
              >
                {isSubmitting ? 'Saving…' : submitLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Fork panel (duplicate detected) ───────────────────── */

function ForkPanel({
  info,
  onEditTeams,
  onAddSecondRow,
  onBack,
}: {
  info: ForkInfo
  onEditTeams: () => void
  onAddSecondRow: () => void
  onBack: () => void
}) {
  return (
    <div>
      <div
        style={{
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 16,
        }}
      >
        <p
          style={{
            margin: '0 0 6px',
            fontSize: 13,
            fontWeight: 600,
            color: '#2A2A2D',
          }}
        >
          ⚠ {info.target.resource_name} is already on this period&apos;s schedule
        </p>
        {info.rows.map((row, idx) => (
          <p key={idx} style={{ margin: '4px 0 0', fontSize: 12, color: INACTIVE_GREY }}>
            {[row.role_title, row.planview_code, row.team_names.join(', ') || 'No Team']
              .filter(Boolean)
              .join(' · ')}
          </p>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={onEditTeams}
          style={{
            background: '#2A2A2D',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--rmg-font-body)',
            textAlign: 'left',
          }}
        >
          Edit team assignments
        </button>
        <button
          type="button"
          onClick={onAddSecondRow}
          style={{
            background: 'transparent',
            color: '#404044',
            border: '1px solid #C0C0C0',
            borderRadius: 6,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--rmg-font-body)',
            textAlign: 'left',
          }}
        >
          Add second row
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
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
        ← Back to search
      </button>
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
  const noMatch = searchQuery.length >= 2 && !isSearching && results.length === 0

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
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

      {isSearching && (
        <p style={{ fontSize: 12, color: INACTIVE_GREY, margin: '0 0 8px' }}>Searching…</p>
      )}

      {!noMatch && results.length > 0 && (
        <div
          style={{
            border: '1px solid #EEEEEE',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          {results.map((r, idx) => (
            <button
              key={r.resource_id}
              type="button"
              onClick={() => onPickResource(r)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 14px',
                background: '#fff',
                border: 'none',
                borderBottom: idx < results.length - 1 ? '1px solid #F5F5F5' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--rmg-font-body)',
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
                  <HighlightMatch text={r.resource_name} query={searchQuery} />
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

      {noMatch && (
        <div
          style={{
            background: '#FFF8F8',
            border: '1px solid #FFD0D0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 12,
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

      <div style={{ marginTop: 8 }}>
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
  addSecondRowBanner,
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
  addSecondRowBanner: boolean
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

      {/* Add-second-row amber banner */}
      {addSecondRowBanner && (
        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #FCD34D',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#2A2A2D' }}>
            ⚠ This resource is already on the schedule — you are adding a second row.
          </p>
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
    </div>
  )
}

/* ── Step 3 body ────────────────────────────────────────── */

function Step3Body({
  mode,
  selectedResource,
  form,
  teamRows,
  teams,
  summaryBg,
}: {
  mode: WizardMode
  selectedResource: ResourceSearchResult | null
  form: FormState
  teamRows: TeamRow[]
  teams: TeamOption[]
  summaryBg: string
}) {
  const resourceLabel =
    mode === 'edit-teams'
      ? (selectedResource?.resource_name ?? '—')
      : mode === 'existing'
        ? (selectedResource?.resource_name ?? '—')
        : mode === 'new'
          ? `${form.roleTitle} (new person)`
          : 'TBC'

  const teamLabel = teamRows
    .filter((r) => r.teamId !== '')
    .map((r) => {
      const team = teams.find((t) => t.team_id === r.teamId)
      return `${team?.team_name ?? r.teamId} ${r.pct}%`
    })
    .join(', ') || 'No Team'

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
      {mode !== 'edit-teams' && (
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
