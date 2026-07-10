'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Button, PageToolbarFilterPill } from '@plato/ui/components/rmg'
import { formatMoneyPence } from '@/lib/schedule/format'
import { setBlendedRate, updateCostConfiguration, deleteCostConfiguration } from '@/app/actions/rates'
import {
  computeRateEditImpact,
  type PeriodRateImpact,
  type ConsideredStatus,
} from '@/lib/rates/rateImpact'
import { buildPlatformChartPoints } from '@/lib/rates/chartPoints'
import { computeChartWindow, CHART_RANGE_OPTIONS, type ChartRange } from '@/lib/rates/chartWindow'
import { generateQuarterMarks } from '@/lib/rates/quarterMarks'

// The add path warns only for already-committed periods; drafts update silently.
const ADD_WARN_STATUSES: ConsideredStatus[] = ['active', 'historic']
// Edit/delete warn for every unlocked period whose resolved rate would move.
const EDIT_WARN_STATUSES: ConsideredStatus[] = ['draft', 'active', 'historic']

// Sentinel for the global selector's "All platforms" option.
const ALL = 'all'

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

// Fallback palette for any platform without an explicit brand colour below,
// cycled by array position. Hex literals mirror packages/config/tokens/rmg.css
// rather than var() refs because faded-state rendering below appends a hex
// alpha suffix (`${colour}40`), which only works on a literal hex string.
const LINE_COLOURS = ['#DA202A', '#0892CB', '#62A531', '#F3920D', '#6C4FB6', '#2A2A2D']

// Fixed brand colours for platforms with an established visual identity,
// keyed on the stable platform_code (not array position).
const PLATFORM_COLOURS: Record<string, string> = {
  WEB: '#0892CB', // --rmg-color-blue
  PDA: '#DA202A', // --rmg-color-red
  APP: '#2A2A2D', // --rmg-color-black
}

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

  // ONE global selector drives every section below: chart, history, add-rate.
  // `focus` is either the ALL sentinel or a specific platform_id.
  const [focus, setFocus] = useState<string>(ALL)
  // Chart time range — independent of platform selection, so switching the
  // global selector never resets it.
  const [range, setRange] = useState<ChartRange>('5y')

  const colourFor = useMemo(() => {
    const map = new Map<string, string>()
    platforms.forEach((p, i) =>
      map.set(p.platform_id, PLATFORM_COLOURS[p.platform_code] ?? LINE_COLOURS[i % LINE_COLOURS.length]),
    )
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

  // The chart always shows every platform that has data (selection only
  // changes emphasis, per the layout spec); empties get the message below.
  const platformsWithData = platforms.filter(
    (p) => (historyByPlatform.get(p.platform_id) ?? []).some((r) => r.blended_day_rate_override !== null),
  )
  const emptyPlatforms = platforms.filter((p) => !platformsWithData.includes(p))

  // Window driven by the range control (1Y/3Y/5Y/All time) — 1Y/3Y/5Y anchor
  // to today; "All time" starts at the earliest effective_from across every
  // platform with data, never a hardcoded year.
  const window = useMemo(() => {
    const dates = platformsWithData.flatMap((p) =>
      (historyByPlatform.get(p.platform_id) ?? [])
        .filter((r) => r.blended_day_rate_override !== null)
        .map((r) => r.effective_from),
    )
    return computeChartWindow(dates, range, todayISO())
  }, [platformsWithData, historyByPlatform, range])

  // Quarter boundary marks — generated mathematically from the RMG financial
  // quarter rule (1 Jan/Apr/Jul/Oct) for whatever window is visible, not read
  // from the periods table.
  const quarterMarks = useMemo(() => generateQuarterMarks(window.min, window.max), [window])

  const chartData = useMemo(
    () => ({
      datasets: platformsWithData.map((p) => {
        const colour = colourFor.get(p.platform_id)!
        // Carry-forward at both edges: a synthesised entry point at the
        // window's left edge (so the line enters the frame flat at the
        // then-active rate) and a synthesised exit point at the right edge
        // (so an active platform's line always reaches the right boundary).
        const points = buildPlatformChartPoints(historyByPlatform.get(p.platform_id) ?? [], window.min, window.max)
        // When a specific platform is selected, emphasise it and fade the
        // rest — reusing the assigned line colours (alpha only), no new colours.
        const isFocused = focus !== ALL && p.platform_id === focus
        const isFaded = focus !== ALL && p.platform_id !== focus
        return {
          label: abbr(p),
          data: points,
          borderColor: isFaded ? `${colour}40` : colour,
          backgroundColor: isFaded ? `${colour}40` : colour,
          borderWidth: isFocused ? 3 : isFaded ? 1.5 : 2,
          tension: 0, // plain linear interpolation (diagonal) — never stepped
          pointRadius: isFaded ? 2 : 4,
          pointHoverRadius: 5,
        }
      }),
    }),
    [platformsWithData, historyByPlatform, colourFor, window, focus],
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
            // Ticks land on the same mathematically-generated quarter
            // boundaries as the reference lines — quarterly granularity.
            afterBuildTicks: (axis: { min: number; max: number; ticks: { value: number }[] }) => {
              const marks = quarterMarks
                .filter((m) => m.ms >= axis.min && m.ms <= axis.max)
                .map((m) => ({ value: m.ms }))
              axis.ticks = marks.length ? marks : [{ value: axis.min }, { value: axis.max }]
            },
            ticks: {
              // Every quarter still gets a tick (afterBuildTicks above), but
              // on narrow viewports there isn't room for all of their labels.
              // autoSkip lets Chart.js drop labels based on measured width
              // vs. available space (quarterly -> every other -> yearly as
              // it narrows); minRotation/maxRotation let it angle the
              // remaining labels only as much as needed to fit, rather than
              // forcing full vertical text at every width. The dashed
              // gridlines (quarterLinesPlugin below) read quarterMarksRef
              // directly, not this tick array, so every quarter's line still
              // renders regardless of how many labels are shown.
              autoSkip: true,
              minRotation: 0,
              maxRotation: 90,
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

  // Vertical dashed quarter-boundary lines with labels, generated mathematically.
  // react-chartjs-2's <Line> only consumes the `plugins` prop once, at
  // initial mount (its reactive update effect re-runs on options/data
  // changes but never re-registers plugins) — so a plugin object rebuilt on
  // every render via useMemo([quarterMarks]) gets silently frozen at
  // whichever quarterMarks existed on first mount and never sees later
  // range changes, even though data/ticks (driven by the options/data
  // props, which ARE part of that reactive effect) update correctly. Keep
  // the plugin object itself stable for the chart's lifetime and have it
  // read the current marks through a ref that's always kept in sync.
  const quarterMarksRef = useRef(quarterMarks)
  useEffect(() => {
    quarterMarksRef.current = quarterMarks
  }, [quarterMarks])

  const quarterLinesPlugin = useMemo(
    () => ({
      id: 'quarterLines',
      afterDraw(chart: Chart) {
        const x = chart.scales.x
        if (!x) return
        const { ctx, chartArea } = chart
        // Dashed vertical line only — every quarter in the visible window
        // gets one, regardless of range. No floating text label: the x-axis
        // tick labels already date the boundaries, and a label per dashed
        // line crowded badly on long windows (e.g. "All time"). No gating,
        // no thinning — the label is simply never drawn.
        //
        // save()/restore() wrap the ENTIRE loop (not per-line): this isolates
        // the whole block from whatever canvas state Chart.js's own dataset
        // rendering (bezier curves, dataset stroke colour/width, tension) left
        // active before afterDraw ran, so it can never bleed into these lines.
        ctx.save()
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        for (const mark of quarterMarksRef.current) {
          if (mark.ms < x.min || mark.ms > x.max) continue
          const px = x.getPixelForValue(mark.ms)
          ctx.beginPath()
          ctx.moveTo(px, chartArea.top)
          ctx.lineTo(px, chartArea.bottom)
          ctx.stroke()
        }
        ctx.setLineDash([])
        ctx.restore()
      },
    }),
    [],
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

      {/* ONE global platform selector — drives chart, history and add-rate. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <PageToolbarFilterPill label="All platforms" active={focus === ALL} colour="--all" onClick={() => setFocus(ALL)} />
        {platforms.map((p) => (
          <PageToolbarFilterPill
            key={p.platform_id}
            label={abbr(p)}
            active={focus === p.platform_id}
            colour={colourFor.get(p.platform_id) ?? '#8F9495'}
            onClick={() => setFocus(p.platform_id)}
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
          <p style={{ fontSize: 13, color: GREY1, margin: 0 }}>No historic rate data yet.</p>
        ) : (
          <div style={{ height: 320 }}>
            <Line data={chartData} options={chartOptions} plugins={[quarterLinesPlugin]} />
          </div>
        )}
        {emptyPlatforms.length > 0 && platformsWithData.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {emptyPlatforms.map((p) => (
              <p key={p.platform_id} style={{ fontSize: 12, color: GREY1, margin: 0 }}>
                No historic data yet for {abbr(p)}.
              </p>
            ))}
          </div>
        )}
      </div>

      {/* History (with inline add-rate) — driven by the same global selector */}
      <RateHistoryCard
        platforms={platforms}
        history={history}
        periods={periods}
        colourFor={colourFor}
        focus={focus}
        onChanged={() => router.refresh()}
      />
    </div>
  )
}

/* ── Rate history (with inline add + row edit/delete) ────────────── */

interface EditDraft {
  effectiveFrom: string
  rate: string
  vat: string
  onCosts: string
}

function PlatformBadge({ label, colour }: { label: string; colour: string }) {
  return (
    <span
      style={{
        display: 'inline-block', borderRadius: 100, padding: '2px 8px', marginRight: 8,
        fontSize: 10, fontWeight: 600, color: '#fff', background: colour, verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  )
}

function RateHistoryCard({
  platforms,
  history,
  periods,
  colourFor,
  focus,
  onChanged,
}: {
  platforms: RatePlatform[]
  history: RateHistoryRow[]
  periods: RatePeriod[]
  colourFor: Map<string, string>
  focus: string
  onChanged: () => void
}) {
  const isAll = focus === ALL
  const platformById = useMemo(() => new Map(platforms.map((p) => [p.platform_id, p])), [platforms])
  const focusPlatform = platformById.get(focus) ?? null

  // All-platforms view: every row, newest first, badged. Single platform:
  // just that platform's rows, newest first.
  const rows = useMemo(() => {
    const list = isAll ? history : history.filter((r) => r.platform_id === focus)
    return list.slice().sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))
  }, [history, focus, isAll])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [adding, setAdding] = useState(false)
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
    <div style={{ ...cardStyle, marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...sectionLabel, marginBottom: 0 }}>Rate history</div>
        {/* Add rate — only when a specific platform is selected (can't add
            without a platform). Hidden while the inline form is open. */}
        {!isAll && !adding && (
          <Button variant="outline" size="small" onClick={() => { setError(null); setNotice(null); setAdding(true) }}>
            Add rate
          </Button>
        )}
      </div>

      {error && <p style={{ fontSize: 12, color: RED, margin: '0 0 10px' }}>{error}</p>}
      {notice && <p style={{ fontSize: 12, color: 'var(--rmg-color-green)', margin: '0 0 10px' }}>{notice}</p>}

      {rows.length === 0 && !(adding && focusPlatform) ? (
        <p style={{ fontSize: 13, color: GREY1, margin: 0 }}>
          No historic data yet{focusPlatform ? ` for ${abbr(focusPlatform)}` : ''}.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: GREY1, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isAll && <th style={thStyle}>Platform</th>}
              <th style={thStyle}>Effective from</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Blended rate</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>VAT uplift</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>On-costs uplift</th>
              <th style={{ ...thStyle, textAlign: 'right', width: 84 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isEditing = editingId === r.cost_configuration_id && draft
              const rowPlatform = platformById.get(r.platform_id)
              return (
                <tr key={r.cost_configuration_id} style={{ borderTop: '1px solid var(--rmg-color-grey-3)' }}>
                  {isEditing ? (
                    <>
                      {isAll && (
                        <td style={tdStyle}>
                          {rowPlatform && <PlatformBadge label={abbr(rowPlatform)} colour={colourFor.get(r.platform_id) ?? '#8F9495'} />}
                        </td>
                      )}
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
                      {isAll && (
                        <td style={tdStyle}>
                          {rowPlatform && <PlatformBadge label={abbr(rowPlatform)} colour={colourFor.get(r.platform_id) ?? '#8F9495'} />}
                        </td>
                      )}
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
            {!isAll && adding && focusPlatform && (
              <AddRateRow
                platform={focusPlatform}
                history={history}
                periods={periods}
                onCancel={() => setAdding(false)}
                onSaved={(reassurance) => { setAdding(false); setNotice(reassurance); onChanged() }}
              />
            )}
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

/* ── Inline add-rate row (platform fixed to the global selection) ──
   Compact table row appended to Rate History, aligned to its existing
   columns, instead of an expanded standalone section. ── */

function AddRateRow({
  platform,
  history,
  periods,
  onCancel,
  onSaved,
}: {
  platform: RatePlatform
  history: RateHistoryRow[]
  periods: RatePeriod[]
  onCancel: () => void
  onSaved: (reassurance: string | null) => void
}) {
  const [effectiveFrom, setEffectiveFrom] = useState<string>('')
  const [rate, setRate] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ impacts: PeriodRateImpact[]; run: () => Promise<void> } | null>(null)

  // VAT / on-costs are read-only here — the RPC carries them forward from the
  // platform's most recent live row automatically. Mirror that for display,
  // falling back to the platform-wide defaults for a brand-new platform.
  const latestForPlatform = history
    .filter((r) => r.platform_id === platform.platform_id)
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0]
  const defaultVat = latestForPlatform?.vat_uplift_percent ?? 7.082
  const defaultOnCosts = latestForPlatform?.on_costs_uplift_percent ?? 0

  // Quick-pick chips for upcoming draft periods, same as the old standalone form.
  const quickPicks = periods
    .filter((p) => p.period_status === 'draft' && p.period_start_date >= todayISO())
    .map((p) => ({ date: p.period_start_date, label: p.period_name }))

  async function doSave(reassurance: string | null) {
    setSaving(true)
    setError(null)
    const pence = Math.round((parseFloat(rate) || 0) * 100)
    const result = await setBlendedRate(platform.platform_id, effectiveFrom, pence)
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.')
      return
    }
    setPending(null)
    onSaved(reassurance)
  }

  function handleSaveClick() {
    setError(null)
    if (!effectiveFrom || rate.trim() === '') {
      setError('Pick a date and a rate.')
      return
    }
    const pence = Math.round((parseFloat(rate) || 0) * 100)
    // Locked periods can never be touched here; warn only when an unlocked
    // active/historic period's resolved rate would genuinely move.
    const impact = computeRateEditImpact(history, periods, {
      kind: 'add', platformId: platform.platform_id, nextEffectiveFrom: effectiveFrom, nextRatePence: pence,
    }, { warnStatuses: ADD_WARN_STATUSES })

    if (impact.warnings.length > 0) {
      setPending({ impacts: impact.warnings, run: () => doSave(null) })
      return
    }
    void doSave(matchesMessage(impact.unchanged))
  }

  return (
    <tr style={{ borderTop: '1px solid var(--rmg-color-grey-3)' }}>
      <td style={tdStyle}>
        <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} style={cellInput} />
        {quickPicks.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {quickPicks.map((q) => (
              <PageToolbarFilterPill
                key={q.date}
                label={`${q.label} · ${ukDate(Date.parse(q.date))}`}
                active={effectiveFrom === q.date}
                colour="--all"
                onClick={() => setEffectiveFrom(q.date)}
              />
            ))}
          </div>
        )}
      </td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} style={{ ...cellInput, textAlign: 'right' }} placeholder="£/day" />
      </td>
      <td style={{ ...tdStyle, textAlign: 'right', color: GREY1 }}>{defaultVat}%</td>
      <td style={{ ...tdStyle, textAlign: 'right', color: GREY1 }}>{defaultOnCosts}%</td>
      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {error && <div style={{ fontSize: 11, color: RED, marginBottom: 4 }}>{error}</div>}
        <button type="button" disabled={saving} onClick={handleSaveClick} title="Save" aria-label="Save" style={iconBtn(RED)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} title="Cancel" aria-label="Cancel" style={{ ...iconBtn(GREY1), marginLeft: 4 }}>Cancel</button>
        {pending && (
          <ImpactConfirm
            title="Confirm new rate"
            impacts={pending.impacts}
            busy={saving}
            onConfirm={() => void pending.run()}
            onCancel={() => setPending(null)}
          />
        )}
      </td>
    </tr>
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

/* ── Shared bits ────────────────────────────────────────────────── */

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
