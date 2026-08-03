'use client'

import { Checkbox } from '@plato/ui/components/rmg'

const TEAMS = [
  'Cosmos', 'Cygnus', 'DST', 'ETP', 'Helion', 'Janus',
  'Nebula', 'Orion', 'Pluto', 'Pulsar', 'Sagan', 'Shared Resources',
]

export interface TeamFilterSheetProps {
  selected: string[]
  onChange: (teams: string[]) => void
  onClose: () => void
}

/** Multi-select team picker. Rendered as a centred sheet on both desktop
 *  (dropdown-equivalent) and mobile (bottom sheet) — one implementation
 *  satisfies both call sites in the design spec. */
export function TeamFilterSheet({ selected, onChange, onClose }: TeamFilterSheetProps) {
  function toggle(team: string) {
    onChange(selected.includes(team) ? selected.filter((t) => t !== team) : [...selected, team])
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Filter by team"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42,42,45,0.35)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 'var(--rmg-radius-m) var(--rmg-radius-m) 0 0',
          width: '100%',
          maxWidth: 420,
          maxHeight: '70vh',
          overflowY: 'auto',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
          fontFamily: 'var(--rmg-font-body)',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: '#fff',
            padding: '16px 20px',
            borderBottom: '1px solid var(--rmg-color-grey-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--rmg-color-text-heading)' }}>
            Filter by team
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--rmg-color-grey-1)' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TEAMS.map((team) => (
            <Checkbox
              key={team}
              label={team}
              size="small"
              checked={selected.includes(team)}
              onChange={() => toggle(team)}
            />
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--rmg-color-grey-3)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            style={{
              background: 'transparent',
              border: 'none',
              color: selected.length === 0 ? 'var(--rmg-color-grey-2)' : 'var(--rmg-color-red)',
              fontSize: 13,
              fontWeight: 600,
              cursor: selected.length === 0 ? 'default' : 'pointer',
              fontFamily: 'var(--rmg-font-body)',
            }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--rmg-color-red)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--rmg-radius-m)',
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--rmg-font-body)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export const ALL_TEAMS = TEAMS
