'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@plato/ui/components/rmg'
import type { WorkstreamRow, TeamRow } from '@/lib/supabase/platformDetail'
import { createTeam, updateTeam, deleteTeam } from '@/lib/actions/teams'

type Props = {
  platformId: string
  platformSlug: string
  workstreams: WorkstreamRow[]
  teams: TeamRow[]
}

type ModalMode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; team: TeamRow }

export function TeamsView({ platformId, platformSlug, workstreams, teams }: Props) {
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
          Teams
        </h1>
        <Button
          variant="solid"
          size="medium"
          background="light"
          onClick={() => setModal({ kind: 'create' })}
        >
          Add Team
        </Button>
      </div>

      {teams.length === 0 ? (
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
          {teams.map((team) => {
            const workstream = workstreams.find(
              (ws) => ws.workstream_id === team.workstream_id
            )
            return (
              <TeamCard
                key={team.team_id}
                team={team}
                workstreamName={workstream?.workstream_name ?? null}
                onEdit={() => setModal({ kind: 'edit', team })}
              />
            )
          })}
        </div>
      )}

      {modal.kind !== 'closed' && (
        <TeamModal
          mode={modal}
          platformId={platformId}
          platformSlug={platformSlug}
          workstreams={workstreams}
          onClose={() => setModal({ kind: 'closed' })}
        />
      )}
    </div>
  )
}

function TeamCard({
  team,
  workstreamName,
  onEdit,
}: {
  team: TeamRow
  workstreamName: string | null
  onEdit: () => void
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
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--rmg-spacing-03)',
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
          aria-label={`Edit ${team.team_name}`}
        >
          Edit
        </button>
      </div>
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

function TeamModal({
  mode,
  platformId,
  platformSlug,
  workstreams,
  onClose,
}: {
  mode: { kind: 'create' } | { kind: 'edit'; team: TeamRow }
  platformId: string
  platformSlug: string
  workstreams: WorkstreamRow[]
  onClose: () => void
}) {
  const isEdit = mode.kind === 'edit'
  const team = isEdit ? mode.team : null

  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const headingId = 'team-modal-heading'

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

    startTransition(async () => {
      const result =
        isEdit && team
          ? await updateTeam(team.team_id, platformSlug, formData)
          : await createTeam(platformId, platformSlug, formData)

      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  function handleDelete() {
    if (!team) return
    startTransition(async () => {
      const result = await deleteTeam(team.team_id, platformSlug)
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
            {isEdit ? 'Edit Team' : 'Add Team'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
              <FieldLabel htmlFor="team_name">Team Name</FieldLabel>
              <input
                ref={firstFieldRef}
                id="team_name"
                name="team_name"
                type="text"
                required
                defaultValue={team?.team_name ?? ''}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
              <FieldLabel htmlFor="workstream_id">Workstream</FieldLabel>
              <select
                id="workstream_id"
                name="workstream_id"
                defaultValue={team?.workstream_id ?? ''}
                style={{ ...inputStyle, height: '56px', appearance: 'auto' }}
              >
                <option value="">No workstream</option>
                {workstreams.map((ws) => (
                  <option key={ws.workstream_id} value={ws.workstream_id}>
                    {ws.workstream_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 'var(--rmg-spacing-07)' }}>
              <FieldLabel htmlFor="team_description">Description</FieldLabel>
              <textarea
                id="team_description"
                name="team_description"
                rows={3}
                defaultValue={team?.team_description ?? ''}
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
                {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add Team'}
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
                  Delete team
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
