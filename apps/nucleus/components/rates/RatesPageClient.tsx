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
import { Button, FormField, PageToolbarFilterPill } from '@plato/ui/components/rmg'
import { formatMoneyPence } from '@/lib/schedule/format'
import { getRateEditability } from '@/lib/rates/editability'
import { setBlendedRate } from '@/app/actions/rates'
import { ConfirmDialog } from './ConfirmDialog'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

/* ── Tokens / constants ─────────────────────────────────────────── */

const RED = 'var(--rmg-color-red)'
const GREY1 = 'var(--rmg-color-grey-1)'
const BODY = 'var(--rmg-color-text-body)'
const HEADING = '#2A2A2D'

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

/* ── Shared card / page styling (matches Platform Schedule) ──────── */

const cardStyle: React.CSSProperties = {
  background: 'var(--rmg-color-white)',
  borderRadius: 10,
  padding: 20,
  marginBottom: 20,
  boxShadow: 'var(--rmg-shadow-header)',
}
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: GREY1, marginBottom: 12,
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

  const page: React.CSSProperties = {
    background: '#ffffff',
    minHeight: 'calc(100vh - 40px)',
    padding: '24px 28px',
    fontFamily: 'var(--rmg-font-body)',
    color: HEADING,
    boxSizing: 'border-box',
  }

  return (
    <div style={page}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: HEADING, letterSpacing: '-0.03em', margin: 0 }}>
        Blended Rates
      </h1>
      <p style={{ fontSize: 13, color: GREY1, margin: '6px 0 22px' }}>
        Set and review effective-dated blended day rates per platform. Cost-impact analysis lives on the Platform Schedule.
      </p>

      {/* Platform filter pills — multi-select, "All platforms" uses the same
          solid-dark select-all treatment as "All suppliers" on the Schedule. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <PageToolbarFilterPill label="All platforms" active={allOn} colour="--all" onClick={toggleAll} />
        {platforms.map((p) => (
          <PageToolbarFilterPill
            key={p.platform_id}
            label={abbr(p)}
            active={selected.has(p.platform_id)}
            colour={colourFor.get(p.platform_id) ?? '#8F9495'}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ ...sectionLabel, marginBottom: 0 }}>Rate history</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: GREY1, marginRight: 2 }}>Showing</span>
            {platforms.map((p) => (
              <PageToolbarFilterPill
                key={p.platform_id}
                label={abbr(p)}
                active={focusId === p.platform_id}
                colour={colourFor.get(p.platform_id) ?? '#8F9495'}
                onClick={() => setFocusId(p.platform_id)}
              />
            ))}
          </div>
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
      <SetRateForm
        platforms={platforms}
        periods={periods}
        colourFor={colourFor}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}

/* ── Set-new-rate form ──────────────────────────────────────────── */

function SetRateForm({
  platforms,
  periods,
  colourFor,
  onSaved,
}: {
  platforms: RatePlatform[]
  periods: RatePeriod[]
  colourFor: Map<string, string>
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
        .map((p) => ({ date: p.period_start_date, label: `${p.period_name}` })),
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

  return (
    <div style={{ ...cardStyle, marginBottom: 0 }}>
      <div style={sectionLabel}>Set a new rate</div>

      {/* Platform — single-select pill row (FormField has no option list). */}
      <div style={{ marginBottom: 14 }}>
        <label style={fieldLabel}>Platform</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {platforms.map((p) => (
            <PageToolbarFilterPill
              key={p.platform_id}
              label={p.platform_abbreviation ?? p.platform_code}
              active={platformId === p.platform_id}
              colour={colourFor.get(p.platform_id) ?? '#8F9495'}
              onClick={() => setPlatformId(p.platform_id)}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <FormField
            size="small"
            type="date"
            label="Effective from"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
          {quickPicks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {quickPicks.map((q) => (
                <PageToolbarFilterPill
                  key={q.date}
                  label={`${q.label} · ${q.date}`}
                  active={effectiveFrom === q.date}
                  colour="--all"
                  onClick={() => setEffectiveFrom(q.date)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <FormField
            size="small"
            type="text"
            label="New rate (£/day)"
            placeholder="e.g. 575"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </div>
      </div>

      {blocked && (
        <p style={{ fontSize: 12, color: RED, margin: '12px 0 0' }}>
          🔒 The period covering this date is locked — rate changes are blocked.
        </p>
      )}
      {editState.kind === 'warn' && !blocked && (
        <p style={{ fontSize: 12, color: 'var(--rmg-color-orange)', margin: '12px 0 0' }}>
          This date falls in a period that is no longer in draft — you’ll be asked to confirm.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: RED, margin: '12px 0 0' }}>{error}</p>}

      <div style={{ marginTop: 16 }}>
        <Button
          variant="solid"
          size="small"
          disabled={saving || blocked}
          onClick={handleSaveClick}
        >
          {saving ? 'Saving…' : 'Save rate'}
        </Button>
      </div>

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

const fieldLabel: React.CSSProperties = {
  fontFamily: 'var(--rmg-font-body)',
  fontSize: 'var(--rmg-text-c1)',
  color: 'var(--rmg-color-text-body)',
  display: 'block',
  marginBottom: 6,
}
const thStyle: React.CSSProperties = { padding: '6px 8px', fontWeight: 700 }
const tdStyle: React.CSSProperties = { padding: '8px', color: BODY }
