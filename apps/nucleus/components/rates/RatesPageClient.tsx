'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { RatesPageData, RatePlatform, RateHistoryRow, RatePeriod } from '@plato/schema'
import { formatMoneyPence } from '@/lib/schedule/format'
import { getRateEditability } from '@/lib/rates/editability'
import { setBlendedRate } from '@/app/actions/rates'
import { ConfirmDialog } from './ConfirmDialog'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

/* ── Tokens / constants ─────────────────────────────────────────── */

const RED = 'var(--rmg-color-red)'
const GREY1 = 'var(--rmg-color-grey-1)'
const HEADING = 'var(--rmg-color-text-heading)'
const BODY = 'var(--rmg-color-text-body)'

// Distinct line colours, assigned by platform sort order. Solid hex (chart.js
// can't read CSS custom properties from a canvas context).
const LINE_COLOURS = ['#DA202A', '#0892CB', '#62A531', '#F3920D', '#6C4FB6', '#2A2A2D']

function abbr(p: RatePlatform): string {
  return p.platform_abbreviation ?? p.platform_code
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** The period whose [start, end] range contains the given date, if any. */
function periodForDate(periods: RatePeriod[], dateISO: string): RatePeriod | null {
  return (
    periods.find((p) => p.period_start_date <= dateISO && dateISO <= p.period_end_date) ?? null
  )
}

/* ── Main ───────────────────────────────────────────────────────── */

export function RatesPageClient({ data }: { data: RatesPageData }) {
  const { platforms, history, periods } = data
  const router = useRouter()

  // Filter: every platform selected by default ("All platforms").
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(platforms.map((p) => p.platform_id)),
  )
  const allOn = selected.size === platforms.length
  // History table focus — defaults to the first platform.
  const [focusId, setFocusId] = useState<string>(platforms[0]?.platform_id ?? '')

  function togglePlatform(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === platforms.length ? new Set() : new Set(platforms.map((p) => p.platform_id)),
    )
  }

  const colourFor = useMemo(() => {
    const map = new Map<string, string>()
    platforms.forEach((p, i) => map.set(p.platform_id, LINE_COLOURS[i % LINE_COLOURS.length]))
    return map
  }, [platforms])

  const historyByPlatform = useMemo(() => {
    const map = new Map<string, RateHistoryRow[]>()
    for (const row of history) {
      const list = map.get(row.platform_id) ?? []
      list.push(row)
      map.set(row.platform_id, list)
    }
    return map
  }, [history])

  // Chart datasets — one line per selected platform that has at least one rate.
  const selectedPlatforms = platforms.filter((p) => selected.has(p.platform_id))
  const platformsWithData = selectedPlatforms.filter(
    (p) => (historyByPlatform.get(p.platform_id) ?? []).some((r) => r.blended_day_rate_override !== null),
  )
  const emptySelected = selectedPlatforms.filter((p) => !platformsWithData.includes(p))

  const labels = useMemo(() => {
    const dates = new Set<string>()
    for (const p of platformsWithData) {
      for (const r of historyByPlatform.get(p.platform_id) ?? []) {
        if (r.blended_day_rate_override !== null) dates.add(r.effective_from)
      }
    }
    return Array.from(dates).sort()
  }, [platformsWithData, historyByPlatform])

  const chartData = {
    labels,
    datasets: platformsWithData.map((p) => {
      const rows = (historyByPlatform.get(p.platform_id) ?? []).filter(
        (r) => r.blended_day_rate_override !== null,
      )
      const byDate = new Map(rows.map((r) => [r.effective_from, r.blended_day_rate_override! / 100]))
      const colour = colourFor.get(p.platform_id)!
      return {
        label: abbr(p),
        data: labels.map((d) => byDate.get(d) ?? null),
        borderColor: colour,
        backgroundColor: colour,
        spanGaps: true,
        tension: 0,
        pointRadius: 4,
      }
    }),
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: false },
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { family: 'var(--rmg-font-body)' } } },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${ctx.parsed.y == null ? '—' : `£${ctx.parsed.y.toLocaleString('en-GB', { maximumFractionDigits: 2 })}/day`}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (v: string | number) => `£${Number(v).toLocaleString('en-GB')}`,
        },
      },
    },
  }

  const focusPlatform = platforms.find((p) => p.platform_id === focusId) ?? null
  const focusHistory = (historyByPlatform.get(focusId) ?? [])
    .slice()
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))

  /* ── Styles ── */
  const page: React.CSSProperties = { padding: '28px 32px', fontFamily: 'var(--rmg-font-body)', maxWidth: 1100 }
  const cardStyle: React.CSSProperties = {
    background: 'var(--rmg-color-white)',
    border: '1px solid var(--rmg-color-grey-3)',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: GREY1, marginBottom: 12,
  }

  return (
    <div style={page}>
      <h1 style={{ fontFamily: 'var(--rmg-font-display)', fontSize: 26, color: HEADING, margin: '0 0 4px' }}>
        Blended Rates
      </h1>
      <p style={{ fontSize: 13, color: GREY1, margin: '0 0 24px' }}>
        Set and review effective-dated blended day rates per platform. Cost-impact analysis lives on the Platform Schedule.
      </p>

      {/* Filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <FilterPill label="All platforms" active={allOn} onClick={toggleAll} />
        {platforms.map((p) => (
          <FilterPill
            key={p.platform_id}
            label={abbr(p)}
            active={selected.has(p.platform_id)}
            colour={colourFor.get(p.platform_id)}
            onClick={() => togglePlatform(p.platform_id)}
          />
        ))}
      </div>

      {/* Trend chart */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Rate trend</div>
        {platformsWithData.length === 0 ? (
          <p style={{ fontSize: 13, color: GREY1, margin: 0 }}>
            {selectedPlatforms.length === 0
              ? 'Select a platform to see its rate trend.'
              : 'No historic rate data yet for the selected platforms.'}
          </p>
        ) : (
          <div style={{ height: 320 }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
        {emptySelected.length > 0 && platformsWithData.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {emptySelected.map((p) => (
              <p key={p.platform_id} style={{ fontSize: 12, color: GREY1, margin: 0 }}>
                No historic data yet for {abbr(p)}.
              </p>
            ))}
          </div>
        )}
      </div>

      {/* History table */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ ...sectionLabel, marginBottom: 0 }}>Rate history</div>
          <label style={{ fontSize: 12, color: BODY, display: 'flex', alignItems: 'center', gap: 6 }}>
            History for:
            <select
              value={focusId}
              onChange={(e) => setFocusId(e.target.value)}
              style={selectStyle}
            >
              {platforms.map((p) => (
                <option key={p.platform_id} value={p.platform_id}>
                  {abbr(p)} — {p.platform_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {focusHistory.length === 0 ? (
          <p style={{ fontSize: 13, color: GREY1, margin: 0 }}>
            No historic data yet for {focusPlatform ? abbr(focusPlatform) : 'this platform'}.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: GREY1, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={thStyle}>Effective from</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Blended rate</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>VAT uplift</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>On-costs uplift</th>
              </tr>
            </thead>
            <tbody>
              {focusHistory.map((r) => (
                <tr key={r.cost_configuration_id} style={{ borderTop: '1px solid var(--rmg-color-grey-3)' }}>
                  <td style={tdStyle}>{r.effective_from}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {r.blended_day_rate_override === null ? '—' : `${formatMoneyPence(r.blended_day_rate_override, { decimals: 2 })}/day`}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.vat_uplift_percent}%</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.on_costs_uplift_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Set a new rate */}
      <SetRateForm platforms={platforms} periods={periods} onSaved={() => router.refresh()} />
    </div>
  )
}

/* ── Set-new-rate form ──────────────────────────────────────────── */

function SetRateForm({
  platforms,
  periods,
  onSaved,
}: {
  platforms: RatePlatform[]
  periods: RatePeriod[]
  onSaved: () => void
}) {
  const [platformId, setPlatformId] = useState<string>(platforms[0]?.platform_id ?? '')
  const [effectiveFrom, setEffectiveFrom] = useState<string>('')
  const [rate, setRate] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingWarn, setPendingWarn] = useState<string | null>(null)

  // Quick-pick: upcoming draft periods' start dates.
  const quickPicks = useMemo(
    () =>
      periods
        .filter((p) => p.period_status === 'draft' && p.period_start_date >= todayISO())
        .map((p) => ({ date: p.period_start_date, label: `${p.period_name} (${p.period_start_date})` })),
    [periods],
  )

  const targetPeriod = effectiveFrom ? periodForDate(periods, effectiveFrom) : null
  const editState = getRateEditability(targetPeriod)
  const blocked = editState.kind === 'locked'

  async function doSave() {
    setSaving(true)
    setError(null)
    const pence = Math.round((parseFloat(rate) || 0) * 100)
    const result = await setBlendedRate(platformId, effectiveFrom, pence)
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.')
      return
    }
    setRate('')
    setEffectiveFrom('')
    onSaved()
  }

  function handleSaveClick() {
    setError(null)
    if (!platformId || !effectiveFrom || rate.trim() === '') {
      setError('Pick a platform, an effective-from date and a rate.')
      return
    }
    if (editState.kind === 'warn') {
      setPendingWarn(editState.message)
      return
    }
    void doSave()
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--rmg-color-white)',
    border: '1px solid var(--rmg-color-grey-3)',
    borderRadius: 10,
    padding: 20,
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: BODY, marginBottom: 4, display: 'block' }
  const fieldWrap: React.CSSProperties = { marginBottom: 14, flex: 1, minWidth: 150 }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: GREY1, marginBottom: 14 }}>
        Set a new rate
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={fieldWrap}>
          <label style={labelStyle}>Platform</label>
          <select value={platformId} onChange={(e) => setPlatformId(e.target.value)} style={selectStyle}>
            {platforms.map((p) => (
              <option key={p.platform_id} value={p.platform_id}>
                {abbr(p)} — {p.platform_name}
              </option>
            ))}
          </select>
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Effective from</label>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            style={inputStyle}
          />
          {quickPicks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {quickPicks.map((q) => (
                <button
                  key={q.date}
                  type="button"
                  onClick={() => setEffectiveFrom(q.date)}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 12,
                    border: `1px solid var(--rmg-color-grey-2)`,
                    background: effectiveFrom === q.date ? 'var(--rmg-color-tint-red)' : 'transparent',
                    color: BODY,
                    cursor: 'pointer',
                    fontFamily: 'var(--rmg-font-body)',
                  }}
                  title={q.label}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>New rate (£/day)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. 575"
            style={inputStyle}
          />
        </div>
      </div>

      {blocked && (
        <p style={{ fontSize: 12, color: RED, margin: '4px 0 12px' }}>
          🔒 The period covering this date is locked — rate changes are blocked.
        </p>
      )}
      {editState.kind === 'warn' && !blocked && (
        <p style={{ fontSize: 12, color: 'var(--rmg-color-orange)', margin: '4px 0 12px' }}>
          This date falls in a period that is no longer in draft — you’ll be asked to confirm.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: RED, margin: '4px 0 12px' }}>{error}</p>}

      <button
        type="button"
        onClick={handleSaveClick}
        disabled={saving || blocked}
        style={{
          background: saving || blocked ? 'var(--rmg-color-grey-2)' : RED,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 18px',
          fontSize: 13,
          fontWeight: 600,
          cursor: saving || blocked ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--rmg-font-body)',
        }}
      >
        {saving ? 'Saving…' : 'Save rate'}
      </button>

      {pendingWarn && (
        <ConfirmDialog
          message={pendingWarn}
          onConfirm={() => {
            setPendingWarn(null)
            void doSave()
          }}
          onCancel={() => setPendingWarn(null)}
        />
      )}
    </div>
  )
}

/* ── Shared bits ────────────────────────────────────────────────── */

function FilterPill({
  label,
  active,
  colour,
  onClick,
}: {
  label: string
  active: boolean
  colour?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 16,
        border: active ? '1px solid var(--rmg-color-red)' : '1px solid var(--rmg-color-grey-2)',
        background: active ? 'var(--rmg-color-tint-red)' : 'transparent',
        color: active ? 'var(--rmg-color-red)' : GREY1,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--rmg-font-body)',
      }}
    >
      {colour && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: colour, opacity: active ? 1 : 0.4 }} />
      )}
      {label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--rmg-font-body)', fontSize: 13, padding: '8px 12px',
  border: '1px solid var(--rmg-color-grey-2)', borderRadius: 6, outline: 'none', boxSizing: 'border-box',
  color: HEADING, background: '#fff',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', width: 'auto' }
const thStyle: React.CSSProperties = { padding: '6px 8px', fontWeight: 700 }
const tdStyle: React.CSSProperties = { padding: '8px', color: BODY }
