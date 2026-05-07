'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const GROUP_COLOURS: Record<number, string> = {
  0:  '#1A2B5B',
  1:  '#DA202A',
  2:  '#E2611A',
  3:  '#7C3AED',
  4:  '#0892CB',
  5:  '#008A00',
  6:  '#9B0A6E',
  7:  '#3ABFB8',
  8:  '#FF8C00',
  9:  '#3D3D3D',
  10: '#8F9495',
  11: '#1976F2',
  12: '#8F9495',
}

interface Props {
  group: { id: string; name: string; group_number: number; is_active: boolean }
  completedCount: number
  totalCount: number
}

export function AppGroupRow({ group, completedCount, totalCount }: Props) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const isInactive = !group.is_active
  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const ragColour = pct === 0 ? '#D5D5D5' : pct <= 32 ? '#DA202A' : pct <= 65 ? '#F3920D' : '#008A00'

  return (
    <div
      onClick={() => { if (!isInactive) router.push(`/sessions?group=${group.id}`) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '6px',
        cursor: isInactive ? 'default' : 'pointer',
        background: hovered && !isInactive ? '#F8F8F8' : 'transparent',
        opacity: isInactive ? 0.4 : 1,
        transition: 'background 0.15s',
      }}
    >
      {/* Badge */}
      <div style={{
        width: 26, height: 26, borderRadius: 4, flexShrink: 0,
        background: GROUP_COLOURS[group.group_number] ?? '#2A2A2D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: 700, color: '#fff',
      }}>
        {group.group_number}
      </div>

      {/* Name */}
      <div style={{
        fontSize: '13px', fontWeight: 500, color: '#2A2A2D',
        flexShrink: 0, width: '150px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {group.name}
      </div>

      {/* Bar */}
      <div style={{
        flex: 1, height: '8px', background: '#EEEEEE',
        borderRadius: '100px', overflow: 'hidden', minWidth: 0,
      }}>
        {pct > 0 && !isInactive && (
          <div style={{
            height: '100%', width: `${pct}%`,
            borderRadius: '100px', background: ragColour,
          }} />
        )}
      </div>

      {/* Count */}
      <div style={{ fontSize: '11px', color: '#8F9495', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {isInactive ? '—' : `${completedCount} / ${totalCount}`}
      </div>

      {/* Percentage */}
      <div style={{
        fontSize: '12px', fontWeight: 700, flexShrink: 0,
        minWidth: '36px', textAlign: 'right', color: ragColour,
      }}>
        {isInactive ? '—' : `${Math.round(pct)}%`}
      </div>
    </div>
  )
}
