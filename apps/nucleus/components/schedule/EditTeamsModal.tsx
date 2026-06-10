'use client'

import { useState, useEffect } from 'react'
import { TeamAssignmentBuilder } from './TeamAssignmentBuilder'
import {
  fetchWizardData,
  getTeamAssignments,
  updateTeamAssignments,
} from '@/app/actions/schedule-wizard'
import type { TeamOption } from '@/app/actions/schedule-wizard'
import type { TeamAssignment } from '@plato/schema'

const ACTIVE_RED = '#DA202A'
const HEADER_BG = '#2A2A2D'
const INACTIVE_GREY = '#8F9495'

export interface EditTeamsTarget {
  allocationId: string
  resourceId: string
  resourceName: string
  currentTeams: TeamAssignment[]
}

interface EditTeamsModalProps {
  target: EditTeamsTarget
  periodId: string
  onSave: (allocationId: string, newTeams: TeamAssignment[]) => void
  onClose: () => void
}

export function EditTeamsModal({ target, periodId, onSave, onClose }: EditTeamsModalProps) {
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [assignments, setAssignments] = useState<Array<{ teamId: string; split: number }>>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setSubmitError(null)
    Promise.all([
      fetchWizardData(),
      getTeamAssignments(target.resourceId, periodId),
    ])
      .then(([wizardData, fetched]) => {
        setTeams(wizardData.teams)
        if (fetched.length > 0) {
          setAssignments(fetched.map((a) => ({ teamId: a.teamId, split: a.split })))
        } else if (target.currentTeams.length > 0) {
          // Fall back to page-load state
          setAssignments(
            target.currentTeams.map((t) => ({
              teamId: t.teamId,
              split: Math.round(t.capacitySplit * 100),
            })),
          )
        } else {
          setAssignments([{ teamId: '', split: 100 }])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.resourceId, periodId])

  const total = assignments.reduce((s, a) => s + a.split, 0)
  const saveDisabled = isSubmitting || total !== 100

  async function handleSave() {
    setIsSubmitting(true)
    setSubmitError(null)
    const realAssignments = assignments.filter((a) => a.teamId !== '')
    const result = await updateTeamAssignments(
      target.resourceId,
      periodId,
      realAssignments.map((a) => ({ teamId: a.teamId, capacitySplit: a.split })),
    )
    setIsSubmitting(false)
    if (!result.success) {
      setSubmitError(result.error ?? 'Something went wrong. Please try again.')
      return
    }
    const newTeams: TeamAssignment[] = realAssignments.map((a) => {
      const team = teams.find((t) => t.team_id === a.teamId)
      return {
        teamId: a.teamId,
        teamName: team?.team_name ?? '',
        capacitySplit: a.split / 100,
      }
    })
    onSave(target.allocationId, newTeams)
    onClose()
  }

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
    width: 480,
    maxWidth: 'calc(100vw - 32px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    fontFamily: 'var(--rmg-font-body)',
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

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            background: HEADER_BG,
            color: '#fff',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Edit team assignments</span>
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

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          {/* Resource badge */}
          <div
            style={{
              background: '#F1F2F5',
              border: '1px solid #E0E0E0',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2A2A2D' }}>
              {target.resourceName}
            </span>
          </div>

          {loading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: 80,
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
              <style>{`@keyframes wizard-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <TeamAssignmentBuilder
              key={target.resourceId}
              value={assignments}
              onChange={setAssignments}
              teams={teams}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #EEEEEE',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div>
            {submitError && (
              <span style={{ fontSize: 12, color: ACTIVE_RED }}>{submitError}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...btnBase,
                background: 'transparent',
                color: '#404044',
                border: '1px solid #C0C0C0',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveDisabled}
              style={{
                ...btnBase,
                background: saveDisabled ? '#C0C0C0' : ACTIVE_RED,
                color: '#fff',
                cursor: saveDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
