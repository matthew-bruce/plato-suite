'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type Chart,
  type TooltipItem,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { RatesPageData, RatePlatform, RateHistoryRow, RatePeriod } from '@plato/schema'
import { Button, FormField, PageToolbarFilterPill } from '@plato/ui/components/rmg'
import { formatMoneyPence } from '@/lib/schedule/format'
import { setBlendedRate, updateCostConfiguration, deleteCostConfiguration } from '@/app/actions/rates'
import {
  computeRateEditImpact,
  type PeriodRateImpact,
  type ConsideredStatus,
} from '@/lib/rates/rateImpact'
import { buildPlatformChartPoints } from '@/lib/rates/chartPoints'
import { computeChartWindow, CHART_RANGE_OPTIONS, type ChartRange } from '@/lib/rates/chartWindow'

// The add path warns only for already-committed periods; drafts update silently.
const ADD_WARN_STATUSES: ConsideredStatus[] = ['active', 'historic']
// Edit/delete warn for every unlocked period whose resolved rate would move.
const EDIT_WARN_STATUSES: ConsideredStatus[] = ['draft', 'active', 'historic']

/** "A" · "A and B" · "A, B and C" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Reassurance message for a change that moves no figures, or null if nothing to say. */
function matchesMessage(unchanged: { period_name: string }[]): string | null {
  if (unchanged.length === 0) return null
  return `Matches what's already applied to ${joinNames(unchanged.map((p) => p.period_name))} — no schedule figures will change.`
}

// Numeric (timestamp) x-axis — no date adapter needed; we format ticks/tooltips
// ourselves through Intl with en-GB so dates always read as UK order.
ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)
// App-wide chart number locale (this is the only chart in the app — pre-flight
// confirmed no other date-aware chart exists).
ChartJS.defaults.locale = 'en-gb'

/* ── Tokens / constants ─────────────────────────────────────────── */

const RED = 'var(--rmg-color-red)'
const GREY1 = 'var(--rmg-color-grey-1)'
const BODY = 'var(--rmg-color-text-body)'
const HEADING = '#2A2A2D'

const LINE_COLOURS = ['#DA202A', '#0892CB', '#62A531', '#F3920D', '#6C4FB6', '#2A2A2D']

function abbr(p: RatePlatform): string {
  return p.platform_abbreviation ?? p.platform_code
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// UK date, e.g. "1 Jul 2026".
const UK_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
function ukDate(ms: number): string {
  return UK_DATE.format(new Date(ms))
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

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(platforms.map((p) => p.platform_id)),
  )
  const allOn = selected.size === platforms.length
  const [focusId, setFocusId] = useState<string>(platforms[0]?.platform_id ?? '')
  // Chart time range — deliberately independent of platform selection, so
  // toggling platforms on/off never resets it.
  const [range, setRange] = useState<ChartRange>('5y')

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

  const selectedPlatforms = platforms.filter((p) => selected.has(p.platform_id))
  const platformsWithData = selectedPlatforms.filter(
    (p) => (historyByPlatform.get(p.platform_id) ?? []).some((r) => r.blended_day_rate_override !== null),
  )
  const emptySelected = selectedPlatforms.filter((p) => !platformsWithData.includes(p))

  // Quarter boundary marks — REAL periods only, never fabricated.
  const quarterMarks = useMemo(
    () =>
      periods
        .map((p) => ({ ms: Date.parse(p.period_start_date), label: p.period_name }))
        .sort((a, b) => a.ms - b.ms),
    [periods],
  )

  // Window driven by the range control (1Y/3Y/5Y/All time) — 1Y/3Y/5Y anchor
  // to today; "All time" starts at the earliest effective_from across
  // whatever platforms are currently visible (selected AND have data), never
  // a hardcoded year.
  const window = useMemo(() => {
    const dates = platformsWithData.flatMap((p) =>
      (historyByPlatform.get(p.platform_id) ?? [])
        .filter((r) => r.blended_day_rate_override !== null)
        .map((r) => r.effective_from),
    )
    return computeChartWindow(dates, range, todayISO())
  }, [platformsWithData, historyByPlatform, range])

  const chartData = useMemo(
    () => ({
      datasets: platformsWithData.map((p) => {
        const colour = colourFor.get(p.platform_id)!
        // Carry-forward: a synthesised entry point at the window's left edge
        // when the platform's rate at that instant resolves from an
        // off-screen earlier row, so the line enters the frame flat.
        const points = buildPlatformChartPoints(historyByPlatform.get(p.platform_id) ?? [], window.min)
        return {
          label: abbr(p),
          data: points,
          borderColor: colour,
          backgroundColor: colour,
          tension: 0, // plain linear interpolation (diagonal) — never stepped
          pointRadius: 4,
          pointHoverRadius: 5,
        }
      }),
    }),
    [platformsWithData, historyByPlatform, colourFor],
  )

  const chartOptions = useMemo(
    () =>
      ({
        responsive: true,
        maintainAspectRatio: false,
        locale: 'en-gb',
        // Show EVERY platform's value at the hovered date, not just the top line.
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
          legend: { position: 'bottom' as const, labels: { font: { family: 'var(--rmg-font-body)' } } },
          tooltip: {
            callbacks: {
              title: (items: TooltipItem<'line'>[]) =>
                items.length ? ukDate(Number(items[0].parsed.x)) : '',
              label: (ctx: TooltipItem<'line'>) =>
                `${ctx.dataset.label}: ${ctx.parsed.y == null ? '—' : `£${ctx.parsed.y.toLocaleString('en-GB', { maximumFractionDigits: 2 })}/day`}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear' as const,
            min: window.min,
            max: window.max,
            // Ticks land on real quarter boundaries within the window.
            afterBuildTicks: (axis: { min: number; max: number; ticks: { value: number }[] }) => {
              const marks = quarterMarks
                .filter((m) => m.ms >= axis.min && m.ms <= axis.max)
                .map((m) => ({ value: m.ms }))
              axis.ticks = marks.length ? marks : [{ value: axis.min }, { value: axis.max }]
            },
            ticks: {
              autoSkip: false,
              maxRotation: 0,
              callback: (v: string | number) => ukDate(Number(v)),
              font: { family: 'var(--rmg-font-body)' },
            },
            grid: { display: false },
          },
          y: {
            // Explicit floor at 0 — auto-scaling made small movements read as
            // a cliff. Max stays auto.
            min: 0,
            ticks: { callback: (v: string | number) => `£${Number(v).toLocaleString('en-GB')}` },
          },
        },
      }),
    [window, quarterMarks],
  )

  // Vertical dashed quarter-boundary lines with labels, drawn from real periods.
  const quarterLinesPlugin = useMemo(
    () => ({
      id: 'quarterLines',
      afterDraw(chart: Chart) {
        const x = chart.scales.x
        if (!x) return
        const { ctx, chartArea } = chart
        for (const mark of quarterMarks) {
          if (mark.ms < x.min || mark.ms > x.max) continue
          const px = x.getPixelForValue(mark.ms)
          ctx.save()
          ctx.beginPath()
          ctx.setLineDash([4, 4])
          ctx.moveTo(px, chartArea.top)
          ctx.lineTo(px, chartArea.bottom)
          ctx.lineWidth = 1
          ctx.strokeStyle = 'rgba(42,42,45,0.28)'
          ctx.stroke()
          ctx.setLineDash([])
          ctx.font = '10px var(--rmg-font-body), sans-serif'
          ctx.fillStyle = 'rgba(42,42,45,0.55)'
          ctx.textBaseline = 'top'
          ctx.fillText(mark.label, px + 4, chartArea.top + 2)
          ctx.restore()
        }
      },
    }),
    [quarterMarks],
  )

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ ...sectionLabel, marginBottom: 0 }}>Rate trend</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {CHART_RANGE_OPTIONS.map((opt) => (
              <PageToolbarFilterPill
                key={opt.value}
                label={opt.label}
                active={range === opt.value}
                colour="--all"
                onClick={() => setRange(opt.value)}
              />
            ))}
          </div>
        </div>
        {platformsWithData.length === 0 ? (
          <p style={{ fontSize: 13, color: GREY1, margin: 0 }}>
            {selectedPlatforms.length === 0
              ? 'Select a platform to see its rate trend.'
              : 'No historic rate data yet for the selected platforms.'}
          </p>
        ) : (
          <div style={{ height: 320 }}>
            <Line data={chartData} options={chartOptions} plugins={[quarterLinesPlugin]} />
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

      {/* History table with row-level edit/delete */}
      <RateHistoryCard
        platforms={platforms}
        history={history}
        periods={periods}
        colourFor={colourFor}
        focusId={focusId}
        onFocus={setFocusId}
        onChanged={() => router.refresh()}
      />

      {/* Set a new rate */}
      <SetRateForm platforms={platforms} periods={periods} history={history} colourFor={colourFor} onSaved={() => router.refresh()} />
    </div>
  )
}

/* ── Rate history (with edit + delete, gated by draft-impact) ────── */

interface EditDraft {
  effectiveFrom: string
  rate: string
  vat: string
  onCosts: string
}

function RateHistoryCard({
  platforms,
  history,
  periods,
  colourFor,
  focusId,
  onFocus,
  onChanged,
}: {
  platforms: RatePlatform[]
  history: RateHistoryRow[]
  periods: RatePeriod[]
  colourFor: Map<string, string>
  focusId: string
  onFocus: (id: string) => void
  onChanged: () => void
}) {
  const focusPlatform = platforms.find((p) => p.platform_id === focusId) ?? null
  const focusHistory = (history.filter((r) => r.platform_id === focusId))
    .slice()
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Pending action awaiting confirm (impact list shown), holds the committer.
  const [pending, setPending] = useState<{ title: string; impacts: PeriodRateImpact[]; run: () => Promise<void> } | null>(null)

  function startEdit(r: RateHistoryRow) {
    setError(null)
    setEditingId(r.cost_configuration_id)
    setDraft({
      effectiveFrom: r.effective_from,
      rate: r.blended_day_rate_override === null ? '' : String(r.blended_day_rate_override / 100),
      vat: String(r.vat_uplift_percent),
      onCosts: String(r.on_costs_uplift_percent),
    })
  }
  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
    setError(null)
  }

  async function saveEdit(r: RateHistoryRow) {
    if (!draft) return
    setError(null); setNotice(null)
    if (!draft.effectiveFrom) { setError('Pick an effective-from date.'); return }
    const ratePence = draft.rate.trim() === '' ? null : Math.round(parseFloat(draft.rate) * 100)
    if (ratePence !== null && (!Number.isFinite(ratePence) || ratePence < 0)) { setError('Enter a valid rate.'); return }

    const impact = computeRateEditImpact(history, periods, {
      kind: 'edit', platformId: r.platform_id, targetRow: r,
      nextEffectiveFrom: draft.effectiveFrom, nextRatePence: ratePence,
    }, { warnStatuses: EDIT_WARN_STATUSES })

    const run = async () => {
      setBusy(true)
      const res = await updateCostConfiguration(r.cost_configuration_id, {
        effectiveFrom: draft.effectiveFrom,
        blendedRatePence: ratePence,
        vatUpliftPercent: parseFloat(draft.vat) || 0,
        onCostsUpliftPercent: parseFloat(draft.onCosts) || 0,
      })
      setBusy(false)
      if (!res.success) { setError(res.error ?? 'Could not save the change.'); return }
      setPending(null)
      cancelEdit()
      setNotice(matchesMessage(impact.unchanged))
      onChanged()
    }

    // Warn only when an unlocked period's resolved rate actually moves; otherwise
    // save immediately (locked periods can never appear here).
    if (impact.warnings.length > 0) {
      setPending({ title: 'Confirm rate edit', impacts: impact.warnings, run })
    } else {
      await run()
    }
  }

  async function deleteRow(r: RateHistoryRow) {
    setError(null); setNotice(null)
    const run = async () => {
      setBusy(true)
      const res = await deleteCostConfiguration(r.cost_configuration_id)
      setBusy(false)
      if (!res.success) { setError(res.error ?? 'Could not delete the row.'); return }
      setPending(null)
      onChanged()
    }
    // Delete always confirms; the impact list (unlocked periods that change) enriches it.
    const impact = computeRateEditImpact(history, periods, {
      kind: 'delete', platformId: r.platform_id, targetRow: r,
    }, { warnStatuses: EDIT_WARN_STATUSES })
    setPending({ title: `Delete the rate effective ${r.effective_from}?`, impacts: impact.warnings, run })
  }

  return (
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
              onClick={() => { cancelEdit(); onFocus(p.platform_id) }}
            />
          ))}
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: RED, margin: '0 0 10px' }}>{error}</p>}
      {notice && <p style={{ fontSize: 12, color: 'var(--rmg-color-green)', margin: '0 0 10px' }}>{notice}</p>}

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
              <th style={{ ...thStyle, textAlign: 'right', width: 84 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {focusHistory.map((r) => {
              const isEditing = editingId === r.cost_configuration_id && draft
              return (
                <tr key={r.cost_configuration_id} style={{ borderTop: '1px solid var(--rmg-color-grey-3)' }}>
                  {isEditing ? (
                    <>
                      <td style={tdStyle}>
                        <input type="date" value={draft!.effectiveFrom} onChange={(e) => setDraft({ ...draft!, effectiveFrom: e.target.value })} style={cellInput} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input inputMode="decimal" value={draft!.rate} onChange={(e) => setDraft({ ...draft!, rate: e.target.value.replace(/[^0-9.]/g, '') })} style={{ ...cellInput, textAlign: 'right' }} placeholder="£/day" />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input inputMode="decimal" value={draft!.vat} onChange={(e) => setDraft({ ...draft!, vat: e.target.value.replace(/[^0-9.]/g, '') })} style={{ ...cellInput, textAlign: 'right', width: 70 }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <input inputMode="decimal" value={draft!.onCosts} onChange={(e) => setDraft({ ...draft!, onCosts: e.target.value.replace(/[^0-9.]/g, '') })} style={{ ...cellInput, textAlign: 'right', width: 70 }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" disabled={busy} onClick={() => saveEdit(r)} title="Save" aria-label="Save" style={iconBtn(RED)}>Save</button>
                        <button type="button" onClick={cancelEdit} title="Cancel" aria-label="Cancel" style={{ ...iconBtn(GREY1), marginLeft: 4 }}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdStyle}>{r.effective_from}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {r.blended_day_rate_override === null ? '—' : `${formatMoneyPence(r.blended_day_rate_override, { decimals: 2 })}/day`}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{r.vat_uplift_percent}%</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{r.on_costs_uplift_percent}%</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => startEdit(r)} title="Edit rate" aria-label="Edit rate" style={iconBtn('#0892CB')}><Pencil size={14} /></button>
                        <button type="button" onClick={() => deleteRow(r)} title="Delete rate" aria-label="Delete rate" style={{ ...iconBtn(RED), marginLeft: 6 }}><Trash2 size={14} /></button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {pending && (
        <ImpactConfirm
          title={pending.title}
          impacts={pending.impacts}
          busy={busy}
          onConfirm={() => void pending.run()}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

/* ── Impact confirm modal ───────────────────────────────────────── */

function ImpactConfirm({
  title,
  impacts,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string
  impacts: PeriodRateImpact[]
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const fmt = (pence: number | null) => (pence === null ? 'no rate' : `${formatMoneyPence(pence, { decimals: 2 })}/day`)
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(42,42,45,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--rmg-color-white)', borderRadius: 12, padding: 22, width: 460, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 8px 40px rgba(0,0,0,0.22)', fontFamily: 'var(--rmg-font-body)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: HEADING }}>{title}</p>
        {impacts.length === 0 ? (
          <p style={{ margin: '0 0 18px', fontSize: 13, color: BODY, lineHeight: 1.5 }}>
            No period’s Applied Blended Rate changes as a result. Locked periods are unaffected.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: BODY }}>
              This changes the Applied Blended Rate for {impacts.length} period{impacts.length !== 1 ? 's' : ''}:
            </p>
            <ul style={{ margin: '0 0 16px', padding: '0 0 0 2px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {impacts.map((i) => (
                <li key={i.period.period_id} style={{ fontSize: 13, color: HEADING, display: 'flex', justifyContent: 'space-between', gap: 12, borderLeft: '3px solid var(--rmg-color-orange)', paddingLeft: 8 }}>
                  <span>{i.period.period_name}</span>
                  <span style={{ color: BODY }}>{fmt(i.fromPence)} → <strong>{fmt(i.toPence)}</strong></span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" size="small" onClick={onCancel}>Cancel</Button>
          <Button variant="solid" size="small" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : 'Confirm'}</Button>
        </div>
      </div>
    </div>
  )
}

/* ── Set-new-rate form ──────────────────────────────────────────── */

function SetRateForm({
  platforms,
  periods,
  history,
  colourFor,
  onSaved,
}: {
  platforms: RatePlatform[]
  periods: RatePeriod[]
  history: RateHistoryRow[]
  colourFor: Map<string, string>
  onSaved: () => void
}) {
  const [platformId, setPlatformId] = useState<string>(platforms[0]?.platform_id ?? '')
  const [effectiveFrom, setEffectiveFrom] = useState<string>('')
  const [rate, setRate] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<{ impacts: PeriodRateImpact[]; run: () => Promise<void> } | null>(null)

  const quickPicks = useMemo(
    () =>
      periods
        .filter((p) => p.period_status === 'draft' && p.period_start_date >= todayISO())
        .map((p) => ({ date: p.period_start_date, label: `${p.period_name}` })),
    [periods],
  )

  async function doSave(reassurance: string | null) {
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
    setPending(null)
    setNotice(reassurance)
    onSaved()
  }

  function handleSaveClick() {
    setError(null); setNotice(null)
    if (!platformId || !effectiveFrom || rate.trim() === '') {
      setError('Pick a platform, an effective-from date and a rate.')
      return
    }
    const pence = Math.round((parseFloat(rate) || 0) * 100)
    // Locked periods can never be touched here; warn only when an unlocked
    // active/historic period's resolved rate would genuinely move.
    const impact = computeRateEditImpact(history, periods, {
      kind: 'add', platformId, nextEffectiveFrom: effectiveFrom, nextRatePence: pence,
    }, { warnStatuses: ADD_WARN_STATUSES })

    if (impact.warnings.length > 0) {
      setPending({ impacts: impact.warnings, run: () => doSave(null) })
      return
    }
    // Zero actual impact → save immediately, naming any matched periods.
    void doSave(matchesMessage(impact.unchanged))
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 0 }}>
      <div style={sectionLabel}>Set a new rate</div>

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
          <FormField size="small" type="date" label="Effective from" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          {quickPicks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {quickPicks.map((q) => (
                <PageToolbarFilterPill key={q.date} label={`${q.label} · ${q.date}`} active={effectiveFrom === q.date} colour="--all" onClick={() => setEffectiveFrom(q.date)} />
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <FormField size="small" type="text" label="New rate (£/day)" placeholder="e.g. 575" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} />
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: RED, margin: '12px 0 0' }}>{error}</p>}
      {notice && <p style={{ fontSize: 12, color: 'var(--rmg-color-green)', margin: '12px 0 0' }}>{notice}</p>}

      <div style={{ marginTop: 16 }}>
        <Button variant="solid" size="small" disabled={saving} onClick={handleSaveClick}>
          {saving ? 'Saving…' : 'Save rate'}
        </Button>
      </div>

      {pending && (
        <ImpactConfirm
          title="Confirm new rate"
          impacts={pending.impacts}
          busy={saving}
          onConfirm={() => void pending.run()}
          onCancel={() => setPending(null)}
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
const cellInput: React.CSSProperties = {
  width: '100%', maxWidth: 150, fontFamily: 'var(--rmg-font-body)', fontSize: 13, padding: '5px 8px',
  border: '1px solid var(--rmg-color-grey-2)', borderRadius: 6, outline: 'none', boxSizing: 'border-box', color: HEADING,
}
function iconBtn(colour: string): React.CSSProperties {
  return {
    background: 'transparent', border: 'none', cursor: 'pointer', color: colour, padding: '2px 4px',
    fontFamily: 'var(--rmg-font-body)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center',
  }
}
