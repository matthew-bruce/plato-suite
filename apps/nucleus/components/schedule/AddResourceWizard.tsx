'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ResourceLocation, PlanviewCode } from '@plato/schema'
import {
  searchResources,
  fetchWizardData,
  createResourceAndAllocation,
} from '@/app/actions/schedule-wizard'
import type { ResourceSearchResult, SupplierOption, TeamOption } from '@/app/actions/schedule-wizard'

/* ── Constants ──────────────────────────────────────────── */

const ACTIVE_RED = '#DA202A'
const DONE_GREEN = '#62A531'
const INACTIVE_GREY = '#8F9495'
const HEADER_BG = '#2A2A2D'
const SUMMARY_BG = '#F1F2F5'

/* ── Types ──────────────────────────────────────────────── */

type WizardStep = 1 | 2 | 3
type WizardMode = 'existing' | 'new' | 'tbc'

interface FormState {
  supplierId: string
  supplierName: string
  teamId: string | null
  teamName: string | null
  roleTitle: string
  planviewCode: 'PR' | 'F_Gov' | 'BAU'
  resourceLocation: ResourceLocation
}

export interface WizardSuccessPayload {
  allocationId: string
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

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [teams, setTeams] = useState<TeamOption[]>([])

  const defaultForm = useCallback(
    (): FormState => ({
      supplierId: defaultSupplierId ?? '',
      supplierName: defaultSupplierName ?? '',
      teamId:
        activeTeamFilter !== 'all'
          ? null // will be resolved from teams list once loaded
          : null,
      teamName: activeTeamFilter !== 'all' ? activeTeamFilter : null,
      roleTitle: '',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
    }),
    [defaultSupplierId, defaultSupplierName, activeTeamFilter],
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
        // Resolve team_id from name if a team filter is active
        if (activeTeamFilter !== 'all') {
          const match = t.find((x) => x.team_name === activeTeamFilter)
          if (match) {
            setForm((prev) => ({ ...prev, teamId: match.team_id, teamName: match.team_name }))
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

  function resolveTeamFromFilter(): { teamId: string | null; teamName: string | null } {
    if (activeTeamFilter === 'all') return { teamId: null, teamName: null }
    const match = teams.find((t) => t.team_name === activeTeamFilter)
    return { teamId: match?.team_id ?? null, teamName: activeTeamFilter }
  }

  function pickResource(r: ResourceSearchResult) {
    setSelectedResource(r)
    setMode('existing')
    const { teamId, teamName } = resolveTeamFromFilter()
    setForm({
      supplierId: r.supplier_id ?? defaultSupplierId ?? '',
      supplierName: r.supplier_name ?? defaultSupplierName ?? '',
      teamId,
      teamName,
      roleTitle: r.resource_job_title ?? '',
      planviewCode: 'PR',
      resourceLocation: r.resource_location ?? 'onshore',
    })
    setStep(2)
  }

  function addAsNew(name: string) {
    setMode('new')
    setSelectedResource(null)
    const { teamId, teamName } = resolveTeamFromFilter()
    setForm({
      supplierId: defaultSupplierId ?? '',
      supplierName: defaultSupplierName ?? '',
      teamId,
      teamName,
      roleTitle: name,
      planviewCode: 'PR',
      resourceLocation: 'onshore',
    })
    setStep(2)
  }

  function skipToTbc() {
    setMode('tbc')
    setSelectedResource(null)
    const { teamId, teamName } = resolveTeamFromFilter()
    setForm({
      supplierId: defaultSupplierId ?? '',
      supplierName: defaultSupplierName ?? '',
      teamId,
      teamName,
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

  function handleTeamChange(teamId: string) {
    if (teamId === '') {
      setForm((prev) => ({ ...prev, teamId: null, teamName: null }))
    } else {
      const t = teams.find((x) => x.team_id === teamId)
      setForm((prev) => ({
        ...prev,
        teamId,
        teamName: t?.team_name ?? null,
      }))
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    setSubmitError(null)

    const result = await createResourceAndAllocation({
      mode,
      resourceId: mode === 'existing' ? (selectedResource?.resource_id ?? null) : null,
      resourceName: mode === 'new' ? form.roleTitle : null,
      supplierId: form.supplierId,
      supplierName: form.supplierName,
      teamId: form.teamId,
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

    onSuccess({
      allocationId: result.allocationId,
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
      teams:
        form.teamId && form.teamName
          ? [{ teamId: form.teamId, teamName: form.teamName }]
          : [],
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

  const nextDisabled = step === 2 && !form.roleTitle.trim()

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
            <Step1Body
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              isSearching={isSearching}
              results={searchResults}
              onPickResource={pickResource}
              onAddAsNew={addAsNew}
              onSkipToTbc={skipToTbc}
              inputStyle={inputStyle}
            />
          )}
          {step === 2 && (
            <Step2Body
              mode={mode}
              selectedResource={selectedResource}
              form={form}
              suppliers={suppliers}
              teams={teams}
              duplicateAdvisory={duplicateAdvisory}
              onSupplierChange={handleSupplierChange}
              onTeamChange={handleTeamChange}
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
                {isSubmitting ? 'Adding…' : 'Add to schedule'}
              </button>
            )}
          </div>
        </div>
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
  duplicateAdvisory,
  onSupplierChange,
  onTeamChange,
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
  duplicateAdvisory: string | null
  onSupplierChange: (id: string) => void
  onTeamChange: (id: string) => void
  onFormChange: (key: keyof FormState, val: string) => void
  onChangeResource: () => void
  inputStyle: React.CSSProperties
  selectStyle: React.CSSProperties
  labelStyle: React.CSSProperties
  fieldWrap: React.CSSProperties
}) {
  return (
    <div>
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
        <label style={labelStyle}>Team</label>
        <select
          value={form.teamId ?? ''}
          onChange={(e) => onTeamChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">No Team</option>
          {teams.map((t) => (
            <option key={t.team_id} value={t.team_id}>
              {t.team_name}
            </option>
          ))}
        </select>
      </div>

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
    </div>
  )
}

/* ── Step 3 body ────────────────────────────────────────── */

function Step3Body({
  mode,
  selectedResource,
  form,
  summaryBg,
}: {
  mode: WizardMode
  selectedResource: ResourceSearchResult | null
  form: FormState
  summaryBg: string
}) {
  const resourceLabel =
    mode === 'existing'
      ? (selectedResource?.resource_name ?? '—')
      : mode === 'new'
        ? `${form.roleTitle} (new person)`
        : 'TBC'

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Resource', value: resourceLabel },
    { label: 'Supplier', value: form.supplierName || '—' },
    { label: 'Team', value: form.teamName ?? 'No Team' },
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
      <p style={{ fontSize: 12, color: INACTIVE_GREY, margin: 0 }}>
        Days and rate default to 0 — edit inline after adding.
      </p>
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
