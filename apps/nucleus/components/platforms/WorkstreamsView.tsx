'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Button, Radio } from '@plato/ui/components/rmg'
import type { WorkstreamRow } from '@/lib/supabase/platformDetail'
import {
  createWorkstream,
  updateWorkstream,
  deleteWorkstream,
} from '@/lib/actions/workstreams'

type Props = {
  platformId: string
  platformSlug: string
  workstreams: WorkstreamRow[]
}

type ModalMode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; workstream: WorkstreamRow }

export function WorkstreamsView({ platformId, platformSlug, workstreams }: Props) {
  const [modal, setModal] = useState<ModalMode>({ kind: 'closed' })

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
      }}
    >
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
        <h1
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h3)',
            lineHeight: 'var(--rmg-leading-h3)',
            color: 'var(--rmg-color-text-heading)',
            margin: 0,
          }}
        >
          Workstreams
        </h1>
        <Button
          variant="solid"
          size="medium"
          background="light"
          onClick={() => setModal({ kind: 'create' })}
        >
          Add Workstream
        </Button>
      </div>

      {workstreams.length === 0 ? (
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
          {workstreams.map((ws) => (
            <WorkstreamItem
              key={ws.workstream_id}
              workstream={ws}
              onEdit={() => setModal({ kind: 'edit', workstream: ws })}
            />
          ))}
        </div>
      )}

      {modal.kind !== 'closed' && (
        <WorkstreamModal
          mode={modal}
          platformId={platformId}
          platformSlug={platformSlug}
          onClose={() => setModal({ kind: 'closed' })}
        />
      )}
    </div>
  )
}

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

const FUNDING_OPTIONS: { value: WorkstreamRow['funding_source']; label: string }[] = [
  { value: 'T4B', label: 'T4B' },
  { value: 'T4T', label: 'T4T' },
  { value: 'external', label: 'External' },
]

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
    formData.set('funding_source', fundingSource)

    startTransition(async () => {
      const result =
        isEdit && workstream
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

            <div style={{ marginBottom: 'var(--rmg-spacing-07)' }}>
              <FieldLabel htmlFor="workstream_description">Description</FieldLabel>
              <textarea
                id="workstream_description"
                name="workstream_description"
                rows={3}
                defaultValue={workstream?.workstream_description ?? ''}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
              />
            </div>

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

            <div style={{ display: 'flex', gap: 'var(--rmg-spacing-04)', flexWrap: 'wrap' }}>
              <Button variant="solid" size="medium" background="light" disabled={isPending}>
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
