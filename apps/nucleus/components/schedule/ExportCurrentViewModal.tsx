'use client'

import { useMemo, useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { formatMoney } from '@/lib/schedule/ui'
import {
  sortExportRows,
  nextExportSortState,
  sortIndicator,
  splitTeamAssignments,
  getTeamCellStyle,
  type ExportRow,
  type ExportSortableCol,
  type ExportSortState,
} from '@/lib/schedule/exportView'

const HEADER_BG = '#2A2A2D'

// Percentage-based (not pixel) column widths so the table scales
// proportionally in the modal AND in whatever it's pasted into.
const COL_WIDTHS: Record<'resource' | 'role' | 'team' | 'location' | 'days' | 'total', string> = {
  resource: '16%',
  role: '24%',
  team: '22%',
  location: '12%',
  days: '8%',
  total: '18%',
}

const SORTABLE_HEADERS: { col: ExportSortableCol; label: string; align: 'left' | 'right' }[] = [
  { col: 'resource', label: 'Resource', align: 'left' },
  { col: 'role', label: 'Role', align: 'left' },
  { col: 'location', label: 'Location', align: 'left' },
  { col: 'days', label: 'Days', align: 'right' },
  { col: 'total', label: 'Run rate cost', align: 'right' },
]

function capitalise(s: string | null): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
}

export interface ExportCurrentViewModalProps {
  open: boolean
  onClose: () => void
  rows: ExportRow[]
  /** Team filter value ('all'/'no-team' already normalised to null by the caller). */
  activeTeamFilter: string | null
  periodName: string
  workingDays: number
}

export function ExportCurrentViewModal({
  open,
  onClose,
  rows,
  activeTeamFilter,
  periodName,
  workingDays,
}: ExportCurrentViewModalProps) {
  // In-memory only — never persisted, never affects the schedule page behind it.
  const [sort, setSort] = useState<ExportSortState>({ col: null, dir: 'asc' })
  const [copied, setCopied] = useState(false)

  const sortedRows = useMemo(() => sortExportRows(rows, sort.col, sort.dir), [rows, sort])

  const totals = useMemo(
    () => ({
      days: rows.reduce((s, r) => s + (r.capacity_days ?? 0), 0),
      costPence: rows.reduce((s, r) => s + (r.base_total_pence ?? 0), 0),
    }),
    [rows],
  )

  if (!open) return null

  function handleHeaderClick(col: ExportSortableCol) {
    setSort((prev) => nextExportSortState(col, prev))
  }

  async function handleCopy() {
    const html = buildCopyHtml(sortedRows, activeTeamFilter, periodName)
    const text = buildCopyText(sortedRows)
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(text)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.error('Copy to clipboard failed:', err)
    }
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
    padding: 24,
  }

  const card: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: 12,
    width: 860,
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 48px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    fontFamily: 'var(--rmg-font-body)',
  }

  const th = (align: 'left' | 'right'): React.CSSProperties => ({
    textAlign: align,
    padding: '8px 10px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#555',
    userSelect: 'none',
  })

  const td = (align: 'left' | 'right'): React.CSSProperties => ({
    textAlign: align,
    padding: '7px 10px',
    fontSize: 12,
    color: '#2A2A2D',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    borderTop: '1px solid #EEEEEE',
  })

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
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Export current view</div>
            <div style={{ fontSize: 11, color: '#B8B8BC', marginTop: 2 }}>
              {periodName} · {rows.length} resource{rows.length !== 1 ? 's' : ''}
              {activeTeamFilter ? ` · filtered by ${activeTeamFilter}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Table */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: COL_WIDTHS.resource }} />
              <col style={{ width: COL_WIDTHS.role }} />
              <col style={{ width: COL_WIDTHS.team }} />
              <col style={{ width: COL_WIDTHS.location }} />
              <col style={{ width: COL_WIDTHS.days }} />
              <col style={{ width: COL_WIDTHS.total }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '2px solid #E0E0E0' }}>
                {SORTABLE_HEADERS.slice(0, 2).map(({ col, label, align }) => (
                  <SortableHeader key={col} col={col} label={label} align={align} sort={sort} onClick={handleHeaderClick} style={th(align)} />
                ))}
                <th style={th('left')}>Team(s)</th>
                {SORTABLE_HEADERS.slice(2).map(({ col, label, align }) => (
                  <SortableHeader key={col} col={col} label={label} align={align} sort={sort} onClick={handleHeaderClick} style={th(align)} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const teamDisplay = splitTeamAssignments(r.teams, activeTeamFilter)
                return (
                  <tr key={r.allocation_id}>
                    <td style={td('left')}>{r.resource_name ?? 'TBC'}</td>
                    <td style={td('left')}>{r.role_title ?? '—'}</td>
                    <td style={{ ...td('left'), whiteSpace: 'normal' }}>
                      {teamDisplay.length === 0 ? (
                        <span style={{ color: '#8F9495' }}>No Team</span>
                      ) : (
                        teamDisplay.map((t, i) => {
                          const cellStyle = getTeamCellStyle(t.emphasis)
                          return (
                            <span
                              key={t.teamId}
                              style={{
                                fontWeight: cellStyle.fontWeight,
                                fontSize: cellStyle.fontSize,
                                color: cellStyle.color,
                              }}
                            >
                              {i > 0 ? ', ' : ''}
                              {cellStyle.prefix}
                              {t.teamName} {Math.round(t.capacitySplit * 100)}%
                            </span>
                          )
                        })
                      )}
                    </td>
                    <td style={td('left')}>{capitalise(r.resource_location)}</td>
                    <td style={td('right')}>{(r.capacity_days ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 1 })}</td>
                    <td style={td('right')}>{formatMoney(r.base_total_pence ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '12px 20px', borderTop: '1px solid #E0E0E0', background: '#FAFAFA', flexShrink: 0, flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 11, color: '#8F9495' }}>
            {rows.length} resource{rows.length !== 1 ? 's' : ''} · {totals.days.toLocaleString('en-GB', { maximumFractionDigits: 1 })} days · {formatMoney(totals.costPence)} · {workingDays} working days this period
          </div>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: copied ? '#1B5E20' : '#DA202A', color: '#fff', border: 'none', borderRadius: 6,
              padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--rmg-font-body)',
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sortable header cell ──────────────────────────────────────── */

function SortableHeader({
  col,
  label,
  align,
  sort,
  onClick,
  style,
}: {
  col: ExportSortableCol
  label: string
  align: 'left' | 'right'
  sort: ExportSortState
  onClick: (col: ExportSortableCol) => void
  style: React.CSSProperties
}) {
  return (
    <th style={style}>
      <button
        type="button"
        onClick={() => onClick(col)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
          font: 'inherit', color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
          flexDirection: align === 'right' ? 'row-reverse' : 'row',
        }}
      >
        <span>{label}</span>
        <span style={{ color: sort.col === col ? '#DA202A' : '#B0B0B0', fontSize: 10 }}>
          {sortIndicator(col, sort)}
        </span>
      </button>
    </th>
  )
}

/* ── Clipboard payload builders ───────────────────────────────────
   The copied HTML prefers wrapping over ellipsis — the paste target
   (email / Teams) controls the available width, not this modal. ── */

function buildCopyHtml(rows: ExportRow[], activeTeamFilter: string | null, periodName: string): string {
  const cell = (content: string, align: 'left' | 'right' = 'left'): string =>
    `<td style="padding:6px 10px;font-size:12px;color:#2A2A2D;border-top:1px solid #EEEEEE;text-align:${align};white-space:normal;word-break:break-word;">${content}</td>`

  const headerCell = (label: string, width: string, align: 'left' | 'right' = 'left'): string =>
    `<th style="width:${width};padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#555;background:#FAFAFA;border-bottom:2px solid #E0E0E0;text-align:${align};">${label}</th>`

  const rowsHtml = rows
    .map((r) => {
      const teamDisplay = splitTeamAssignments(r.teams, activeTeamFilter)
      const teamHtml =
        teamDisplay.length === 0
          ? '<span style="color:#8F9495;">No Team</span>'
          : teamDisplay
              .map((t) => {
                const s = getTeamCellStyle(t.emphasis)
                return `<span style="font-weight:${s.fontWeight};font-size:${s.fontSize}px;color:${s.color};">${s.prefix}${escapeHtml(t.teamName)} ${Math.round(t.capacitySplit * 100)}%</span>`
              })
              .join(', ')
      return (
        '<tr>' +
        cell(escapeHtml(r.resource_name ?? 'TBC')) +
        cell(escapeHtml(r.role_title ?? '—')) +
        cell(teamHtml) +
        cell(escapeHtml(capitalise(r.resource_location))) +
        cell((r.capacity_days ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 1 }), 'right') +
        cell(escapeHtml(formatMoney(r.base_total_pence ?? 0)), 'right') +
        '</tr>'
      )
    })
    .join('')

  return (
    `<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-family:sans-serif;">` +
    `<caption style="caption-side:top;text-align:left;font-size:12px;font-weight:600;padding-bottom:6px;">${escapeHtml(periodName)}</caption>` +
    '<colgroup>' +
    `<col style="width:${COL_WIDTHS.resource}"/><col style="width:${COL_WIDTHS.role}"/><col style="width:${COL_WIDTHS.team}"/>` +
    `<col style="width:${COL_WIDTHS.location}"/><col style="width:${COL_WIDTHS.days}"/><col style="width:${COL_WIDTHS.total}"/>` +
    '</colgroup>' +
    '<thead><tr>' +
    headerCell('Resource', COL_WIDTHS.resource) +
    headerCell('Role', COL_WIDTHS.role) +
    headerCell('Team(s)', COL_WIDTHS.team) +
    headerCell('Location', COL_WIDTHS.location) +
    headerCell('Days', COL_WIDTHS.days, 'right') +
    headerCell('Run rate cost', COL_WIDTHS.total, 'right') +
    '</tr></thead>' +
    `<tbody>${rowsHtml}</tbody>` +
    '</table>'
  )
}

function buildCopyText(rows: ExportRow[]): string {
  const header = ['Resource', 'Role', 'Team(s)', 'Location', 'Days', 'Run rate cost'].join('\t')
  const lines = rows.map((r) =>
    [
      r.resource_name ?? 'TBC',
      r.role_title ?? '—',
      r.teams.map((t) => `${t.teamName} ${Math.round(t.capacitySplit * 100)}%`).join(', ') || 'No Team',
      capitalise(r.resource_location),
      (r.capacity_days ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 1 }),
      formatMoney(r.base_total_pence ?? 0),
    ].join('\t'),
  )
  return [header, ...lines].join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
