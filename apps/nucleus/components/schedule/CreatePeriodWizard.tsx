'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarDatePicker } from '@plato/ui/components/rmg'
import { createPeriod, getPeriodAllocationCount } from '@/app/actions/schedule-period'
import { deriveNextQuarterPeriod } from '@/lib/schedule/periodQuarters'
import { workingDaysBetween } from '@/lib/schedule/format'

/* ── Constants (match AddResourceWizard) ─────────────────── */

const ACTIVE_RED = '#DA202A'
const DONE_GREEN = '#62A531'
const INACTIVE_GREY = '#8F9495'
const HEADER_BG = '#2A2A2D'
const SUMMARY_BG = '#F1F2F5'

type WizardStep = 1 | 2 | 3

export interface CreatePeriodWizardProps {
  open: boolean
  /** The most recent existing period — drives the next-quarter pre-fill and is
   *  the source when copying the schedule forward. */
  latestPeriod: {
    period_id: string
    period_name: string
    period_start_date: string
    period_end_date: string
  } | null
  /** Non-deleted allocation count of the latest period, used as the initial
   *  copy-summary figure (refined against the DB when the wizard opens). */
  sourceAllocationCount: number
  onClose: () => void
  onCreated: (newPeriodId: string, periodName: string) => void
}

function StepPills({ step }: { step: WizardStep }) {
  const pills: Array<{ n: WizardStep; label: string }> = [
    { n: 1, label: 'Period' },
    { n: 2, label: 'Copy forward' },
    { n: 3, label: 'Confirm' },
  ]
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
  return (
    <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderBottom: '1px solid #EEEEEE' }}>
      {pills.map(({ n, label }) => {
        const done = step > n
        const active = step === n
        const bg = done ? DONE_GREEN : active ? ACTIVE_RED : '#E5E7EA'
        const color = done || active ? '#fff' : INACTIVE_GREY
        return (
          <div key={n} style={{ ...pillBase, background: bg, color }}>
            {n} · {label}
          </div>
        )
      })}
    </div>
  )
}

export function CreatePeriodWizard({
  open,
  latestPeriod,
  sourceAllocationCount,
  onClose,
  onCreated,
}: CreatePeriodWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [copyForward, setCopyForward] = useState(true)
  const [sourceCount, setSourceCount] = useState(sourceAllocationCount)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Pre-fill the logical next quarter from the latest period whenever the modal
  // opens. Derived from the latest period's dates, so it's correct regardless
  // of when the wizard is run; all three fields stay user-editable.
  useEffect(() => {
    if (!open) return
    setStep(1)
    setSubmitError(null)
    setIsSubmitting(false)
    setCopyForward(true)
    setSourceCount(sourceAllocationCount)
    if (latestPeriod) {
      const next = deriveNextQuarterPeriod(latestPeriod.period_start_date)
      setName(next.period_name)
      setStartDate(next.period_start_date)
      setEndDate(next.period_end_date)
      // Refine the copy-summary count against the DB (the initial prop is the
      // currently-viewed period's count, which may differ from the latest).
      let cancelled = false
      getPeriodAllocationCount(latestPeriod.period_id)
        .then((n) => {
          if (!cancelled) setSourceCount(n)
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
    setName('')
    setStartDate('')
    setEndDate('')
  }, [open, latestPeriod, sourceAllocationCount])

  const workingDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    return workingDaysBetween(startDate, endDate)
  }, [startDate, endDate])

  const datesValid = !!startDate && !!endDate && endDate >= startDate
  const step1Valid = name.trim() !== '' && datesValid

  async function handleCreate() {
    setIsSubmitting(true)
    setSubmitError(null)
    const result = await createPeriod({
      periodName: name,
      startDate,
      endDate,
      copyFromPeriodId: copyForward && latestPeriod ? latestPeriod.period_id : null,
    })
    if (!result.success || !result.periodId) {
      setIsSubmitting(false)
      setSubmitError(result.error ?? 'Something went wrong. Please try again.')
      return
    }
    setIsSubmitting(false)
    onCreated(result.periodId, name.trim())
  }

  if (!open) return null

  /* ── Styles (match AddResourceWizard) ── */
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
    minHeight: 420,
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
  const bodyStyle: React.CSSProperties = { padding: '20px', overflowY: 'auto', flex: 1 }
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
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#404044',
    marginBottom: 4,
    display: 'block',
  }
  const fieldWrap: React.CSSProperties = { marginBottom: 14 }

  const nextDisabled = step === 1 && !step1Valid

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Create new period</span>
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

        <StepPills step={step} />

        {/* Body */}
        <div style={bodyStyle}>
          {step === 1 && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: INACTIVE_GREY, lineHeight: 1.5 }}>
                {latestPeriod ? (
                  <>Pre-filled with the quarter after <strong style={{ color: '#2A2A2D' }}>{latestPeriod.period_name}</strong>. Adjust any field before continuing.</>
                ) : (
                  'No existing periods — enter the first period manually.'
                )}
              </p>

              <div style={fieldWrap}>
                <label style={labelStyle}>Period name</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <CalendarDatePicker
                    size="small"
                    label="Start date"
                    value={startDate}
                    onChange={setStartDate}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <CalendarDatePicker
                    size="small"
                    label="End date"
                    value={endDate}
                    onChange={setEndDate}
                    minDate={startDate || undefined}
                  />
                </div>
              </div>

              <div
                style={{
                  background: SUMMARY_BG,
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#404044' }}>Working days</span>
                <strong style={{ color: datesValid ? '#2A2A2D' : ACTIVE_RED }}>
                  {datesValid ? workingDays : 'Check dates'}
                </strong>
              </div>
              {!datesValid && startDate && endDate && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: ACTIVE_RED }}>
                  End date must be on or after the start date.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#2A2A2D' }}>
                Copy the previous schedule as a starting basis?
              </p>
              <CopyOption
                selected={copyForward}
                onSelect={() => setCopyForward(true)}
                disabled={!latestPeriod}
                title="Yes — copy forward"
                body={
                  latestPeriod
                    ? `Carry the ${sourceCount} resource allocation${sourceCount === 1 ? '' : 's'} (teams, suppliers, roles) from ${latestPeriod.period_name} into the new draft. Everything stays editable — nothing is locked.`
                    : 'No previous period to copy from.'
                }
              />
              <CopyOption
                selected={!copyForward}
                onSelect={() => setCopyForward(false)}
                title="No — start empty"
                body="Create an empty draft period with no allocations, ready for manual setup."
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#2A2A2D' }}>
                Confirm &amp; create
              </p>
              <div style={{ background: SUMMARY_BG, borderRadius: 8, padding: '14px 16px' }}>
                <SummaryRow label="Period name" value={name.trim() || '—'} />
                <SummaryRow label="Start date" value={startDate} />
                <SummaryRow label="End date" value={endDate} />
                <SummaryRow label="Working days" value={String(workingDays)} />
                <SummaryRow label="Copy forward" value={copyForward && latestPeriod ? 'Yes' : 'No'} />
                {copyForward && latestPeriod && (
                  <SummaryRow
                    label="Allocations carried over"
                    value={`${sourceCount} from ${latestPeriod.period_name}`}
                  />
                )}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: INACTIVE_GREY, lineHeight: 1.5 }}>
                The new period is created as a <strong style={{ color: '#404044' }}>draft</strong> and becomes selectable
                from the period picker.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div>
            {step > 1 && (
              <button type="button" onClick={() => setStep((step - 1) as WizardStep)} style={btnSecondary}>
                ← Back
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {submitError && (
              <span style={{ fontSize: 12, color: ACTIVE_RED, maxWidth: 220 }}>{submitError}</span>
            )}
            <button type="button" onClick={onClose} style={btnSecondary}>
              Cancel
            </button>
            {step < 3 && (
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
                onClick={handleCreate}
                disabled={isSubmitting}
                style={isSubmitting ? btnDisabled : btnPrimary}
              >
                {isSubmitting ? 'Creating…' : 'Create period'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CopyOption({
  selected,
  onSelect,
  title,
  body,
  disabled,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  body: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'block',
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--rmg-font-body)',
        background: selected ? 'rgba(218,32,42,0.05)' : '#fff',
        border: selected ? `1.5px solid ${ACTIVE_RED}` : '1px solid #D0D0D0',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: `2px solid ${selected ? ACTIVE_RED : '#C0C0C0'}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {selected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACTIVE_RED }} />}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#2A2A2D' }}>{title}</span>
      </span>
      <span style={{ display: 'block', fontSize: 12, color: INACTIVE_GREY, lineHeight: 1.5, paddingLeft: 22 }}>
        {body}
      </span>
    </button>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 13 }}>
      <span style={{ color: INACTIVE_GREY }}>{label}</span>
      <span style={{ color: '#2A2A2D', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
