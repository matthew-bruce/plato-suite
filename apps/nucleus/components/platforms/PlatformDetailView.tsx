'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button, Radio } from '@plato/ui/components/rmg'
import type {
  PlatformDetailData,
  WorkstreamRow,
  TeamRow,
} from '@/lib/supabase/platformDetail'
import {
  createWorkstream,
  updateWorkstream,
  deleteWorkstream,
} from '@/lib/actions/workstreams'

type Props = {
  platform: PlatformDetailData
}

type WorkstreamModalMode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; workstream: WorkstreamRow }

/* ── Page ───────────────────────────────────────────────────────────── */

export function PlatformDetailView({ platform }: Props) {
  const [wsModal, setWsModal] = useState<WorkstreamModalMode>({ kind: 'closed' })

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
      }}
    >
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-03)',
          marginBottom: 'var(--rmg-spacing-06)',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-b3)',
          lineHeight: 'var(--rmg-leading-b3)',
        }}
      >
        <Link
          href="/platforms"
          style={{ color: 'var(--rmg-color-text-accent)', textDecoration: 'none' }}
        >
          Platforms
        </Link>
        <span style={{ color: 'var(--rmg-color-text-light)' }} aria-hidden>›</span>
        <span style={{ color: 'var(--rmg-color-text-body)' }}>
          {platform.platform_name}
        </span>
      </nav>

      {/* Platform header */}
      <div style={{ marginBottom: 'var(--rmg-spacing-10)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--rmg-spacing-04)',
            flexWrap: 'wrap',
            marginBottom: 'var(--rmg-spacing-03)',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h2)',
              lineHeight: 'var(--rmg-leading-h2)',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
            }}
          >
            {platform.platform_name}
          </h1>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c1)',
              lineHeight: 'var(--rmg-leading-c1)',
              color: 'var(--rmg-color-text-light)',
              backgroundColor: 'var(--rmg-color-surface-light)',
              borderRadius: 'var(--rmg-radius-xs)',
              padding: '2px var(--rmg-spacing-03)',
              whiteSpace: 'nowrap',
            }}
          >
            {platform.platform_code}
          </span>
        </div>
        {platform.platform_description && (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b2)',
              lineHeight: 'var(--rmg-leading-b2)',
              color: 'var(--rmg-color-text-light)',
              margin: 0,
            }}
          >
            {platform.platform_description}
          </p>
        )}
      </div>

      {/* Workstreams section */}
      <section style={{ marginBottom: 'var(--rmg-spacing-11)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--rmg-spacing-05)',
            flexWrap: 'wrap',
            marginBottom: 'var(--rmg-spacing-07)',
            paddingBottom: 'var(--rmg-spacing-04)',
            borderBottom: '2px solid var(--rmg-color-red)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h3)',
              lineHeight: 'var(--rmg-leading-h3)',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
            }}
          >
            Workstreams
          </h2>
          <Button
            variant="solid"
            size="medium"
            background="light"
            onClick={() => setWsModal({ kind: 'create' })}
          >
            Add Workstream
          </Button>
        </div>

        {platform.workstreams.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b2)',
              lineHeight: 'var(--rmg-leading-b2)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            No workstreams configured.
          </p>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}
          >
            {platform.workstreams.map((ws) => (
              <WorkstreamItem
                key={ws.workstream_id}
                workstream={ws}
                onEdit={() => setWsModal({ kind: 'edit', workstream: ws })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Teams section */}
      <section style={{ marginBottom: 'var(--rmg-spacing-11)' }}>
        <h2
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h3)',
            lineHeight: 'var(--rmg-leading-h3)',
            color: 'var(--rmg-color-text-heading)',
            marginBottom: 'var(--rmg-spacing-07)',
            paddingBottom: 'var(--rmg-spacing-04)',
            borderBottom: '2px solid var(--rmg-color-red)',
          }}
        >
          Teams
        </h2>
        {platform.teams.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b2)',
              lineHeight: 'var(--rmg-leading-b2)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            No teams configured.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {platform.teams.map((team) => {
              const workstream = platform.workstreams.find(
                (ws) => ws.workstream_id === team.workstream_id
              )
              return (
                <TeamCard
                  key={team.team_id}
                  team={team}
                  workstreamName={workstream?.workstream_name ?? null}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Workstream modal */}
      {wsModal.kind !== 'closed' && (
        <WorkstreamModal
          mode={wsModal}
          platformId={platform.platform_id}
          platformSlug={platform.platform_slug}
          onClose={() => setWsModal({ kind: 'closed' })}
        />
      )}
    </div>
  )
}

/* ── WorkstreamItem ─────────────────────────────────────────────────── */

function WorkstreamItem({
  workstream,
  onEdit,
}: {
  workstream: WorkstreamRow
  onEdit: () => void
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-06) var(--rmg-spacing-07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rmg-spacing-02)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--rmg-spacing-04)',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--rmg-spacing-04)',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h6)',
              lineHeight: 'var(--rmg-leading-h6)',
              color: 'var(--rmg-color-text-heading)',
              fontWeight: 700,
            }}
          >
            {workstream.workstream_name}
          </span>
          <FundingBadge source={workstream.funding_source} />
        </div>
        <button
          type="button"
          onClick={onEdit}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-text-light)',
            padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
            borderRadius: 'var(--rmg-radius-xs)',
            flexShrink: 0,
          }}
          aria-label={`Edit ${workstream.workstream_name}`}
        >
          Edit
        </button>
      </div>
      {workstream.workstream_description && (
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            lineHeight: 'var(--rmg-leading-b3)',
            color: 'var(--rmg-color-text-light)',
            margin: 0,
          }}
        >
          {workstream.workstream_description}
        </p>
      )}
    </div>
  )
}

/* ── WorkstreamModal ────────────────────────────────────────────────── */

const FUNDING_OPTIONS: { value: WorkstreamRow['funding_source']; label: string }[] = [
  { value: 'T4B', label: 'T4B' },
  { value: 'T4T', label: 'T4T' },
  { value: 'external', label: 'External' },
]

function WorkstreamModal({
  mode,
  platformId,
  platformSlug,
  onClose,
}: {
  mode: { kind: 'create' } | { kind: 'edit'; workstream: WorkstreamRow }
  platformId: string
  platformSlug: string
  onClose: () => void
}) {
  const isEdit = mode.kind === 'edit'
  const workstream = isEdit ? mode.workstream : null

  const [fundingSource, setFundingSource] = useState<WorkstreamRow['funding_source']>(
    workstream?.funding_source ?? 'T4B'
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const headingId = 'workstream-modal-heading'

  useEffect(() => {
    firstFieldRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    // Ensure controlled funding_source state is in formData
    formData.set('funding_source', fundingSource)

    startTransition(async () => {
      const result = isEdit && workstream
        ? await updateWorkstream(workstream.workstream_id, platformSlug, formData)
        : await createWorkstream(platformId, platformSlug, formData)

      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  function handleDelete() {
    if (!workstream) return
    startTransition(async () => {
      const result = await deleteWorkstream(workstream.workstream_id, platformSlug)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(42, 42, 45, 0.5)',
          zIndex: 40,
        }}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--rmg-spacing-06)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: 'var(--rmg-shadow-megamenu)',
            padding: 'var(--rmg-spacing-08)',
            width: '100%',
            maxWidth: '480px',
            pointerEvents: 'auto',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          <h2
            id={headingId}
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h4)',
              lineHeight: 'var(--rmg-leading-h4)',
              color: 'var(--rmg-color-text-heading)',
              marginBottom: 'var(--rmg-spacing-07)',
            }}
          >
            {isEdit ? 'Edit Workstream' : 'Add Workstream'}
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Workstream Name */}
            <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
              <FieldLabel htmlFor="workstream_name">Workstream Name</FieldLabel>
              <input
                ref={firstFieldRef}
                id="workstream_name"
                name="workstream_name"
                type="text"
                required
                defaultValue={workstream?.workstream_name ?? ''}
                style={inputStyle}
              />
            </div>

            {/* Funding Source */}
            <fieldset
              style={{
                border: 'none',
                padding: 0,
                margin: 0,
                marginBottom: 'var(--rmg-spacing-06)',
              }}
            >
              <legend
                style={{
                  display: 'block',
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-b3)',
                  lineHeight: 'var(--rmg-leading-b3)',
                  color: 'var(--rmg-color-text-heading)',
                  fontWeight: 700,
                  marginBottom: 'var(--rmg-spacing-02)',
                  padding: 0,
                }}
              >
                Funding Source
              </legend>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {FUNDING_OPTIONS.map((opt) => (
                  <Radio
                    key={opt.value}
                    label={opt.label}
                    name="funding_source"
                    value={opt.value}
                    size="large"
                    checked={fundingSource === opt.value}
                    onChange={() => setFundingSource(opt.value)}
                  />
                ))}
              </div>
            </fieldset>

            {/* Description */}
            <div style={{ marginBottom: 'var(--rmg-spacing-07)' }}>
              <FieldLabel htmlFor="workstream_description">Description</FieldLabel>
              <textarea
                id="workstream_description"
                name="workstream_description"
                rows={3}
                defaultValue={workstream?.workstream_description ?? ''}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: '80px',
                }}
              />
            </div>

            {/* Inline error */}
            {error && (
              <p
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-b3)',
                  lineHeight: 'var(--rmg-leading-b3)',
                  color: 'var(--rmg-color-text-accent)',
                  marginBottom: 'var(--rmg-spacing-05)',
                }}
                role="alert"
              >
                {error}
              </p>
            )}

            {/* Submit row */}
            <div style={{ display: 'flex', gap: 'var(--rmg-spacing-04)', flexWrap: 'wrap' }}>
              <Button
                variant="solid"
                size="medium"
                background="light"
                disabled={isPending}
              >
                {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add Workstream'}
              </Button>
              <Button
                variant="outline"
                size="medium"
                background="light"
                type="button"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>

          {/* Delete section — edit mode only */}
          {isEdit && (
            <div
              style={{
                marginTop: 'var(--rmg-spacing-08)',
                paddingTop: 'var(--rmg-spacing-06)',
                borderTop: '1px solid var(--rmg-color-grey-3)',
              }}
            >
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-b3)',
                    lineHeight: 'var(--rmg-leading-b3)',
                    color: 'var(--rmg-color-text-accent)',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Delete workstream
                </button>
              ) : (
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-b3)',
                      lineHeight: 'var(--rmg-leading-b3)',
                      color: 'var(--rmg-color-text-body)',
                      marginBottom: 'var(--rmg-spacing-05)',
                    }}
                  >
                    Are you sure? This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--rmg-spacing-04)' }}>
                    <Button
                      variant="solid"
                      size="medium"
                      background="light"
                      onClick={handleDelete}
                      disabled={isPending}
                    >
                      {isPending ? 'Deleting…' : 'Confirm'}
                    </Button>
                    <Button
                      variant="outline"
                      size="medium"
                      background="light"
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ── FundingBadge ───────────────────────────────────────────────────── */

const FUNDING_BADGE_STYLES: Record<
  WorkstreamRow['funding_source'],
  { backgroundColor: string; color: string; label: string }
> = {
  T4B: {
    backgroundColor: 'var(--rmg-color-surface-light)',
    color: 'var(--rmg-color-blue)',
    label: 'T4B',
  },
  T4T: {
    backgroundColor: 'var(--rmg-color-tint-yellow)',
    color: 'var(--rmg-color-text-body)',
    label: 'T4T',
  },
  external: {
    backgroundColor: 'var(--rmg-color-grey-3)',
    color: 'var(--rmg-color-text-light)',
    label: 'External',
  },
}

function FundingBadge({ source }: { source: WorkstreamRow['funding_source'] }) {
  const { backgroundColor, color, label } = FUNDING_BADGE_STYLES[source]
  return (
    <span
      style={{
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c1)',
        lineHeight: 'var(--rmg-leading-c1)',
        fontWeight: 700,
        color,
        backgroundColor,
        borderRadius: 'var(--rmg-radius-xl)',
        padding: '2px var(--rmg-spacing-04)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

/* ── TeamCard ───────────────────────────────────────────────────────── */

function TeamCard({
  team,
  workstreamName,
}: {
  team: TeamRow
  workstreamName: string | null
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rmg-spacing-02)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h6)',
          lineHeight: 'var(--rmg-leading-h6)',
          color: 'var(--rmg-color-text-heading)',
          fontWeight: 700,
        }}
      >
        {team.team_name}
      </span>
      {workstreamName && (
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            lineHeight: 'var(--rmg-leading-b3)',
            color: 'var(--rmg-color-text-light)',
          }}
        >
          {workstreamName}
        </span>
      )}
    </div>
  )
}

/* ── Shared primitives ──────────────────────────────────────────────── */

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-b3)',
        lineHeight: 'var(--rmg-leading-b3)',
        color: 'var(--rmg-color-text-heading)',
        fontWeight: 700,
        marginBottom: 'var(--rmg-spacing-02)',
      }}
    >
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--rmg-font-body)',
  fontSize: 'var(--rmg-text-b2)',
  lineHeight: 'var(--rmg-leading-b2)',
  color: 'var(--rmg-color-text-body)',
  backgroundColor: 'var(--rmg-color-surface-white)',
  border: '1px solid var(--rmg-color-grey-2)',
  borderRadius: 'var(--rmg-radius-s)',
  padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
  outline: 'none',
}
