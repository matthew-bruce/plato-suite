'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  CATEGORY_ORDER,
  type ResourceTimelineData,
  type TimelineResource,
  type TimelineSegment,
} from '@plato/schema'
import {
  CG_TCS_FOCUS,
  type GroupMode,
  STATUS_LABELS,
  buildGroups,
  disciplineOf,
  filterResources,
  formatLongDate,
  formatMonthLabel,
  percentOf,
  segmentGeometry,
  segmentLabel,
  supplierStripe,
  supplierTint,
} from '@/lib/resource-timeline/presentation'
import { buildStandaloneHtml } from '@/lib/resource-timeline/exportHtml'
import styles from './resourceTimeline.module.css'

const GROUP_MODES: { value: GroupMode; label: string }[] = [
  { value: 'team', label: 'Team' },
  { value: 'discipline', label: 'Skillset' },
  { value: 'category', label: 'Transition category' },
]

const SPACER_LABELS: Record<GroupMode, string> = {
  team: 'Team / Resource',
  discipline: 'Skillset / Resource',
  category: 'Category / Resource',
}

interface TooltipState {
  x: number
  y: number
  name: string
  sub: string
  rows: { label: string; value: string }[]
  flag: string | null
}

export function ResourceTimelineClient({ data }: { data: ResourceTimelineData }) {
  const [groupBy, setGroupBy] = useState<GroupMode>('team')
  const [activeSuppliers, setActiveSuppliers] = useState<ReadonlySet<string>>(
    () => new Set(CG_TCS_FOCUS),
  )
  const [secondaryFilter, setSecondaryFilter] = useState('')
  const [transitionOnly, setTransitionOnly] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [exporting, setExporting] = useState(false)

  const supplierColours = useMemo(
    () => new Map(data.suppliers.map((s) => [s.abbreviation, s.colour])),
    [data.suppliers],
  )

  const groupNames = useMemo(() => {
    if (groupBy === 'team') return data.teams
    if (groupBy === 'discipline') return data.disciplines
    return CATEGORY_ORDER
  }, [groupBy, data.teams, data.disciplines])

  // Every grouping mode starts fully collapsed — 108 rows expanded is not a
  // useful first view. Re-collapsing on a mode change keeps that promise.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set(groupNames))
  useEffect(() => {
    setCollapsed(new Set(groupNames))
  }, [groupNames])

  const visible = useMemo(
    () => filterResources(data.resources, { groupBy, activeSuppliers, secondaryFilter, transitionOnly }),
    [data.resources, groupBy, activeSuppliers, secondaryFilter, transitionOnly],
  )

  const groups = useMemo(
    () => buildGroups(visible, groupNames, groupBy),
    [visible, groupNames, groupBy],
  )

  const changeGroupBy = useCallback((mode: GroupMode) => {
    setGroupBy(mode)
    setSecondaryFilter('')
    // The category view is already organised by transition state, so the
    // "transitioning only" toggle would just remove the other categories.
    if (mode === 'category') setTransitionOnly(false)
  }, [])

  const toggleSupplier = useCallback((abbreviation: string) => {
    setActiveSuppliers((current) => {
      const next = new Set(current)
      if (next.has(abbreviation)) next.delete(abbreviation)
      else next.add(abbreviation)
      return next
    })
  }, [])

  const toggleGroup = useCallback((name: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const handleExport = useCallback(() => {
    setExporting(true)
    try {
      const html = buildStandaloneHtml(data, {
        groupBy,
        activeSuppliers: [...activeSuppliers],
        transitionOnly,
        generatedAt: new Date(),
      })
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `resource-timeline-${new Date().toISOString().slice(0, 10)}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [data, groupBy, activeSuppliers, transitionOnly])

  /* ── Today marker ─────────────────────────────────────────────── */
  // Live date, not the mockup's frozen one. Null when today falls outside the
  // window, so the line is simply absent rather than pinned to an edge and
  // implying "today" is 1 July.
  const [todayPct, setTodayPct] = useState<number | null>(null)
  const [todayLabel, setTodayLabel] = useState('')

  useEffect(() => {
    const now = new Date()
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`

    if (iso < data.windowStart || iso > data.windowEnd) {
      setTodayPct(null)
      return
    }
    setTodayPct(percentOf(iso, data.windowStart, data.windowEnd))
    setTodayLabel(
      `Today · ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    )
  }, [data.windowStart, data.windowEnd])

  /* ── Label fitting ────────────────────────────────────────────── */
  // Bars narrow as the window is resized. Rather than guess at text width,
  // measure: try supplier + dates, fall back to supplier alone, then to
  // nothing. A clipped half-word reads as a rendering bug.
  const rightColRef = useRef<HTMLDivElement>(null)

  const fitLabels = useCallback(() => {
    const host = rightColRef.current
    if (!host) return

    for (const bar of host.querySelectorAll<HTMLElement>(`.${styles.seg}`)) {
      const label = bar.querySelector<HTMLElement>(`.${styles.segLabel}`)
      if (!label) continue
      const dates = label.querySelector<HTMLElement>(`.${styles.segDates}`)

      label.style.display = ''
      if (dates) dates.style.display = ''

      const width = bar.clientWidth
      if (width < 34) {
        label.style.display = 'none'
        continue
      }
      if (dates && label.scrollWidth > width - 10) dates.style.display = 'none'
      if (label.scrollWidth > width - 10) label.style.display = 'none'
    }
  }, [])

  useLayoutEffect(() => {
    fitLabels()
  })

  useEffect(() => {
    window.addEventListener('resize', fitLabels)
    return () => window.removeEventListener('resize', fitLabels)
  }, [fitLabels])

  /* ── Tooltip ──────────────────────────────────────────────────── */

  const showSegmentTooltip = useCallback(
    (event: React.MouseEvent, resource: TimelineResource, segment: TimelineSegment) => {
      const rows: { label: string; value: string }[] = []
      if (segment.realStart) rows.push({ label: 'From', value: formatLongDate(segment.start) })
      if (segment.realEnd) rows.push({ label: 'To', value: formatLongDate(segment.end) })
      if (rows.length === 0) {
        rows.push({ label: 'Spanning', value: 'Ongoing (no known boundary in view)' })
      }
      if (segment.commercialStartMismatch) {
        rows.push({
          label: 'Recorded start',
          value: formatLongDate(segment.commercialStartMismatch),
        })
      }

      const flag =
        segment.flag ??
        (segment.commercialStartMismatch
          ? 'Recorded commercial start differs from booked days'
          : segment.tentative
            ? 'Tentative — subject to confirmation'
            : null)

      setTooltip({
        x: event.clientX,
        y: event.clientY,
        name: resource.name,
        sub: `${supplierNameOf(data, segment.supplier)}${segment.code === 'NPC' ? ' · Hypercare' : ''}`,
        rows,
        flag,
      })
    },
    [data],
  )

  const moveTooltip = useCallback((event: React.MouseEvent) => {
    setTooltip((current) =>
      current ? { ...current, x: event.clientX, y: event.clientY } : current,
    )
  }, [])

  const hideTooltip = useCallback(() => setTooltip(null), [])

  const monthCount = data.months.length
  const cssVars = {
    '--left-col': '300px',
    '--row-h': '42px',
  } as CSSProperties

  const secondaryOptions = groupBy === 'team' ? data.disciplines : data.teams

  return (
    <div className={styles.page} style={cssVars}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Resource Timeline</h1>
        <p className={styles.subtitle}>
          {visible.length} of {data.resources.length} resources · {data.coarsePeriodName} –{' '}
          {data.granularPeriodName} · supplier coverage derived from booked days
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlsInner}>
          <div className={styles.controlsRow}>
            <span className={styles.ctlLabel}>Group by</span>
            <div className={styles.pillToggle}>
              {GROUP_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={groupBy === mode.value ? styles.active : undefined}
                  aria-pressed={groupBy === mode.value}
                  onClick={() => changeGroupBy(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Cross-filter: skillsets in Team view, teams in Skillset view.
                Category view is already a transition-state cut, so it has no
                meaningful secondary axis. */}
            {groupBy !== 'category' && (
              <>
                <span className={styles.ctlLabel}>
                  Filter by {groupBy === 'team' ? 'skillset' : 'team'}
                </span>
                <select
                  className={styles.select}
                  value={secondaryFilter}
                  aria-label={`Filter by ${groupBy === 'team' ? 'skillset' : 'team'}`}
                  onChange={(e) => setSecondaryFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {secondaryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </>
            )}

            {groupBy !== 'category' && (
              <>
                <span className={styles.ctlLabel}>Show</span>
                <div className={styles.pillToggle}>
                  <button
                    type="button"
                    className={!transitionOnly ? styles.active : undefined}
                    aria-pressed={!transitionOnly}
                    onClick={() => setTransitionOnly(false)}
                  >
                    Everyone
                  </button>
                  <button
                    type="button"
                    className={transitionOnly ? styles.active : undefined}
                    aria-pressed={transitionOnly}
                    onClick={() => setTransitionOnly(true)}
                  >
                    Transitioning only
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              className={styles.exportButton}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Preparing…' : 'Export standalone HTML'}
            </button>
          </div>

          <div className={styles.controlsRow}>
            <span className={styles.ctlLabel}>Supplier</span>
            <div className={styles.chipRow}>
              {data.suppliers.map((supplier) => {
                const isActive = activeSuppliers.has(supplier.abbreviation)
                return (
                  <button
                    key={supplier.abbreviation}
                    type="button"
                    aria-pressed={isActive}
                    className={`${styles.chip} ${styles.supChip} ${isActive ? styles.active : ''}`}
                    style={
                      {
                        '--sc': supplier.colour,
                        '--sct': supplierTint(supplier.colour),
                      } as CSSProperties
                    }
                    onClick={() => toggleSupplier(supplier.abbreviation)}
                  >
                    {supplier.name}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className={`${styles.chip} ${styles.preset}`}
              onClick={() => setActiveSuppliers(new Set(CG_TCS_FOCUS))}
            >
              Focus: CG + TCS
            </button>
            <button
              type="button"
              className={styles.chip}
              onClick={() => setActiveSuppliers(new Set(data.suppliers.map((s) => s.abbreviation)))}
            >
              All suppliers
            </button>
          </div>
        </div>
      </div>

      <div className={styles.legend}>
        {data.suppliers.map((supplier) => (
          <span
            key={supplier.abbreviation}
            className={styles.legPill}
            style={
              {
                '--sc': supplier.colour,
                '--sct': supplierTint(supplier.colour),
              } as CSSProperties
            }
          >
            {supplier.abbreviation}
          </span>
        ))}
        <span className={styles.legDivider} />
        <span
          className={`${styles.legPill} ${styles.hyper}`}
          style={
            {
              '--sc': supplierColours.get('CG') ?? '#003C82',
              '--sct': supplierTint(supplierColours.get('CG') ?? '#003C82'),
              '--sc2': supplierStripe(supplierColours.get('CG') ?? '#003C82'),
            } as CSSProperties
          }
        >
          Hypercare
        </span>
        <span
          className={`${styles.legPill} ${styles.tentative}`}
          style={
            {
              '--sc': supplierColours.get('TCS') ?? '#9B0A6E',
              '--sct': supplierTint(supplierColours.get('TCS') ?? '#9B0A6E'),
            } as CSSProperties
          }
        >
          Tentative
        </span>
        <span>┄┄ Coverage gap</span>
        <span>● Flagged</span>
      </div>

      <div className={styles.narrowNotice}>
        This view is designed for a wide screen. Scroll sideways to see the full
        Q2–Q3 window.
      </div>

      <div className={styles.scrollHost}>
        <div className={styles.scrollInner}>
          <div className={styles.headerWrap}>
            <div className={styles.headerSpacer}>
              <span>{SPACER_LABELS[groupBy]}</span>
            </div>
            <div className={styles.headerTimeline}>
              <div className={styles.todayTagRow}>
                {todayPct !== null && (
                  <div className={styles.todayTag} style={{ left: `${todayPct}%` }}>
                    {todayLabel}
                  </div>
                )}
              </div>
              <div className={styles.monthRow}>
                {data.months.map((month) => (
                  <div key={month} className={styles.monthCell}>
                    {formatMonthLabel(month)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className={styles.empty}>
              No resources match these filters. Try re-enabling a supplier, or switch
              to “All suppliers”.
            </div>
          ) : (
            <div className={styles.ganttWrap}>
              <div className={styles.leftCol}>
                {groups.map((group) => {
                  const isCollapsed = collapsed.has(group.name)
                  return (
                    <div
                      key={group.name}
                      className={`${styles.groupBlock} ${isCollapsed ? styles.collapsed : ''}`}
                    >
                      <button
                        type="button"
                        className={styles.groupLeftHeader}
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleGroup(group.name)}
                      >
                        <span className={styles.chevron}>
                          <Chevron />
                        </span>
                        <span className={styles.groupNamePill} title={group.displayName}>
                          {group.displayName}
                        </span>
                        <span className={styles.groupCount}>
                          {group.resources.length} resource
                          {group.resources.length === 1 ? '' : 's'}
                        </span>
                      </button>

                      {group.resources.map((resource) => {
                        const status = STATUS_LABELS[resource.status]
                        return (
                          <div key={resource.resourceId} className={styles.resLeftRow}>
                            <div className={styles.avatar}>{resource.initials}</div>
                            <div className={styles.resText}>
                              <div className={styles.resName}>{resource.name}</div>
                              {groupBy === 'team' ? (
                                <div className={styles.resSub}>{disciplineOf(resource)}</div>
                              ) : (
                                <div className={styles.resPills}>
                                  {resource.teams.map((team) => (
                                    <span key={team.teamName} className={styles.teamPill}>
                                      {team.teamName}
                                      {resource.teams.length > 1
                                        ? ` · ${Math.round(team.capacitySplit * 100)}%`
                                        : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {status.text && (
                              <span className={styles.statusTag} style={{ color: status.colour }}>
                                {status.text}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              <div className={styles.rightCol} ref={rightColRef}>
                {groups.map((group) => {
                  const isCollapsed = collapsed.has(group.name)
                  return (
                    <div
                      key={group.name}
                      className={`${styles.groupBlock} ${isCollapsed ? styles.collapsed : ''}`}
                    >
                      <div
                        className={styles.groupRightHeader}
                        onClick={() => toggleGroup(group.name)}
                        aria-hidden="true"
                      >
                        <ColumnLines count={monthCount} />
                      </div>

                      {group.resources.map((resource) => {
                        const segments = resource.segments.filter((s) =>
                          activeSuppliers.has(s.supplier),
                        )
                        return (
                          <div key={resource.resourceId} className={styles.resRightRow}>
                            <ColumnLines count={monthCount} />
                            <div className={styles.track} />

                            {resource.gaps.map((gap) => {
                              const left = percentOf(gap.start, data.windowStart, data.windowEnd)
                              const right = percentOf(gap.end, data.windowStart, data.windowEnd)
                              return (
                                <div
                                  key={`${gap.start}-${gap.end}`}
                                  className={styles.gapMarker}
                                  style={{ left: `${left}%`, width: `${right - left}%` }}
                                  onMouseEnter={(e) =>
                                    setTooltip({
                                      x: e.clientX,
                                      y: e.clientY,
                                      name: resource.name,
                                      sub: '',
                                      rows: [
                                        {
                                          label: 'Coverage gap',
                                          value: `${formatLongDate(gap.start)} → ${formatLongDate(gap.end)}`,
                                        },
                                      ],
                                      flag: 'Last working day to commercial start',
                                    })
                                  }
                                  onMouseMove={moveTooltip}
                                  onMouseLeave={hideTooltip}
                                />
                              )
                            })}

                            {segments.map((segment) => {
                              const { left, width } = segmentGeometry(
                                segment,
                                data.windowStart,
                                data.windowEnd,
                              )
                              const colour = supplierColours.get(segment.supplier) ?? '#8F9495'
                              const { text, dates } = segmentLabel(segment)

                              return (
                                <div
                                  key={`${segment.supplier}-${segment.code}-${segment.start}`}
                                  className={`${styles.seg} ${segment.code === 'NPC' ? styles.hyper : ''} ${
                                    segment.tentative ? styles.tentative : ''
                                  }`}
                                  style={
                                    {
                                      left: `${left}%`,
                                      width: `${width}%`,
                                      '--sc': colour,
                                      '--sct': supplierTint(colour),
                                      '--sc2': supplierStripe(colour),
                                    } as CSSProperties
                                  }
                                  onMouseEnter={(e) => showSegmentTooltip(e, resource, segment)}
                                  onMouseMove={moveTooltip}
                                  onMouseLeave={hideTooltip}
                                >
                                  <span className={styles.segLabel}>
                                    {text}
                                    {dates && <span className={styles.segDates}>{dates}</span>}
                                  </span>
                                </div>
                              )
                            })}

                            {segments
                              .filter((s) => s.flag || s.commercialStartMismatch)
                              .map((segment) => {
                                const { left } = segmentGeometry(
                                  segment,
                                  data.windowStart,
                                  data.windowEnd,
                                )
                                return (
                                  <div
                                    key={`flag-${segment.supplier}-${segment.start}`}
                                    className={styles.flagDot}
                                    style={{ left: `calc(${left}% + 4px)` }}
                                  />
                                )
                              })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {todayPct !== null && (
                  <div className={styles.todayLine} style={{ left: `${todayPct}%` }} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {tooltip && <Tooltip state={tooltip} />}
    </div>
  )
}

/* ── Small presentational pieces ──────────────────────────────────── */

function Chevron() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M2 3.5L5 6.5L8 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ColumnLines({ count }: { count: number }) {
  return (
    <div className={styles.colLines}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.colLine} />
      ))}
    </div>
  )
}

function Tooltip({ state }: { state: TooltipState }) {
  // Flip before the viewport edge rather than after, so the tooltip never
  // forces the page to scroll to show itself.
  const left = state.x + 280 > window.innerWidth ? state.x - 280 : state.x + 14
  const top = state.y + 150 > window.innerHeight ? state.y - 150 : state.y + 14

  return (
    <div className={styles.tooltip} style={{ left, top }} role="tooltip">
      <div className={styles.ttName}>{state.name}</div>
      {state.sub && <div className={styles.ttSub}>{state.sub}</div>}
      {state.rows.map((row) => (
        <div key={row.label} className={styles.ttRow}>
          <span>{row.label}</span>
          <b>{row.value}</b>
        </div>
      ))}
      {state.flag && <div className={styles.ttFlag}>{state.flag}</div>}
    </div>
  )
}

function supplierNameOf(data: ResourceTimelineData, abbreviation: string): string {
  return data.suppliers.find((s) => s.abbreviation === abbreviation)?.name ?? abbreviation
}
