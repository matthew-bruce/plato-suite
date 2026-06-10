'use client'

import { useState } from 'react'
import type { TeamOption } from '@/app/actions/schedule-wizard'

const ACTIVE_RED = '#DA202A'
const DONE_GREEN = '#62A531'
const INACTIVE_GREY = '#8F9495'
const AMBER = '#D97706'

interface BuilderRow {
  id: string
  teamId: string
  split: number
}

let _rowCounter = 0
function nextRowId() {
  return `tab-${++_rowCounter}`
}

export interface TeamAssignmentBuilderProps {
  /** Initial assignments — drives the first render only. */
  value: Array<{ teamId: string; split: number }>
  onChange: (assignments: Array<{ teamId: string; split: number }>) => void
  teams: TeamOption[]
}

export function TeamAssignmentBuilder({ value, onChange, teams }: TeamAssignmentBuilderProps) {
  const [rows, setRows] = useState<BuilderRow[]>(() =>
    value.length > 0
      ? value.map((v) => ({ id: nextRowId(), teamId: v.teamId, split: v.split }))
      : [{ id: nextRowId(), teamId: '', split: 100 }],
  )

  const total = rows.reduce((s, r) => s + r.split, 0)
  const canRemove = rows.length > 1
  const totalColour = total === 100 ? DONE_GREEN : total > 100 ? ACTIVE_RED : AMBER

  const selectStyle: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 13,
    padding: '8px 12px',
    border: '1px solid #D0D0D0',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#2A2A2D',
    background: '#fff',
    cursor: 'pointer',
    width: '100%',
  }

  function applyRows(newRows: BuilderRow[]) {
    setRows(newRows)
    onChange(newRows.map((r) => ({ teamId: r.teamId, split: r.split })))
  }

  function addRow() {
    applyRows([...rows, { id: nextRowId(), teamId: '', split: 0 }])
  }

  function removeRow(id: string) {
    applyRows(rows.filter((r) => r.id !== id))
  }

  function updateRow(id: string, field: 'teamId' | 'split', val: string | number) {
    applyRows(
      rows.map((r) =>
        r.id === id ? { ...r, [field]: field === 'split' ? Number(val) : val } : r,
      ),
    )
  }

  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
        >
          <select
            value={row.teamId}
            onChange={(e) => updateRow(row.id, 'teamId', e.target.value)}
            style={{ ...selectStyle, flex: 1, width: 'auto' }}
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
            value={row.split}
            onChange={(e) => updateRow(row.id, 'split', e.target.value)}
            style={{
              ...selectStyle,
              width: 72,
              flex: 'none',
              textAlign: 'right',
              cursor: 'auto',
            }}
          />
          <span style={{ fontSize: 13, color: '#404044', flexShrink: 0 }}>%</span>
          {canRemove && (
            <button
              type="button"
              onClick={() => removeRow(row.id)}
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
        onClick={addRow}
        style={{
          background: 'transparent',
          border: 'none',
          fontSize: 12,
          color: ACTIVE_RED,
          cursor: 'pointer',
          padding: '2px 0',
          fontFamily: 'var(--rmg-font-body)',
          fontWeight: 600,
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
            (must be 100% to save)
          </span>
        )}
      </div>
    </div>
  )
}
