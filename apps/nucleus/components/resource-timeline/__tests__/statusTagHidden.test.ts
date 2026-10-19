// The per-person status tag ("New TCS hire", "Not moving", "CG → TCS"…) is no
// longer rendered in the name cell — Matt's decision. Category derivation,
// Transition category grouping and the "Transitioning only" filter are kept,
// so this pins both halves: no tag anywhere, same groups as before.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_ORDER,
  type ResourceTimelineData,
  type TimelineResource,
  type TransitionStatus,
} from '@plato/schema'
import { ResourceTimelineClient } from '../ResourceTimelineClient'
import { buildStandaloneHtml } from '@/lib/resource-timeline/exportHtml'
import { buildGroups, filterResources } from '@/lib/resource-timeline/presentation'

/** Every text the tag could show, across all statuses. */
const TAG_TEXTS = ['CG → TCS', 'Signed · tentative', 'New TCS hire', 'Not moving', 'Hypercare only', 'Overlap risk']

const PEOPLE: [string, TransitionStatus, string][] = [
  ['Mover Person', 'mover', 'Transitioned to TCS'],
  ['Signed Person', 'mover_doj_tbc', 'Signed with TCS — start date TBC'],
  ['Joiner Person', 'joiner', 'Established at TCS (no CG history)'],
  ['Leaver Person', 'rolledoff', 'Not moving — attrition'],
  ['Hypercare Person', 'rolledoff_hypercare', 'Rolling off, hypercare only — no TCS move'],
  ['Overlap Person', 'overlap_risk', 'Transitioned to TCS'],
  ['Incumbent Person', 'incumbent', 'Not part of Dudley transition'],
]

function resource(name: string, status: TransitionStatus, categoryLabel: string): TimelineResource {
  return {
    resourceId: name,
    name,
    initials: name.slice(0, 2).toUpperCase(),
    discipline: 'Quality Assurance',
    disciplineSortOrder: 100,
    teams: [{ teamName: 'Orion', capacitySplit: 1 }],
    status,
    category: null,
    categoryLabel,
    segments: [
      {
        supplier: 'CG',
        code: 'REG',
        start: '2026-07-01',
        end: '2026-09-30',
        realStart: false,
        realEnd: true,
        tentative: false,
        flag: null,
        commercialStartMismatch: null,
      },
    ],
    gaps: [],
    joiningDate: null,
    notes: null,
    hiddenFromTimeline: false,
  }
}

const RESOURCES = PEOPLE.map(([name, status, label]) => resource(name, status, label))

const DATA: ResourceTimelineData = {
  windowStart: '2026-07-01',
  windowEnd: '2026-12-31',
  months: ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'],
  resources: RESOURCES,
  suppliers: [
    { abbreviation: 'CG', name: 'Capgemini', colour: '#003C82', sortOrder: 3 },
    { abbreviation: 'TCS', name: 'Tata Consultancy Services', colour: '#9B0A6E', sortOrder: 4 },
  ],
  teams: ['Orion'],
  disciplines: ['Quality Assurance'],
  coarsePeriodName: 'Q2 FY 26/27',
  granularPeriodName: 'Q3 FY 26/27',
  granularWindowStart: '2026-10-01',
  source: 'engagements',
}

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
}

describe('live page: no status tag', () => {
  it('renders every row with no status tag text (server-rendered, Team grouping)', () => {
    const html = renderToStaticMarkup(createElement(ResourceTimelineClient, { data: DATA }))
    for (const [name] of PEOPLE) expect(html).toContain(name)
    for (const text of TAG_TEXTS) expect(html).not.toContain(text)
  })

  it('has no tag rendering or tag style left — the row markup is shared by every grouping mode', () => {
    expect(read('../ResourceTimelineClient.tsx')).not.toMatch(/statusTag|STATUS_LABELS/)
    expect(read('../resourceTimeline.module.css')).not.toMatch(/\.statusTag\b/)
  })
})

describe('standalone export: no status tag', () => {
  it.each(['team', 'discipline', 'category'])('carries no tag markup, style, data or text in %s grouping', (groupBy) => {
    const html = buildStandaloneHtml(DATA, {
      groupBy,
      activeSuppliers: ['CG', 'TCS'],
      activeTeams: ['Orion'],
      transitionOnly: false,
      viewMode: 'full',
      generatedAt: new Date('2026-10-19T09:00:00Z'),
    })
    expect(html).not.toMatch(/status-tag|statusLabels/)
    // Category group headers keep their full labels ("Not moving — attrition"),
    // so check the tag-only texts plus that no bare tag label is embedded.
    for (const text of ['CG → TCS', 'Signed · tentative', 'New TCS hire', 'Hypercare only', 'Overlap risk']) {
      expect(html).not.toContain(text)
    }
    expect(html).not.toContain('"text":"Not moving"')
    // The left row is avatar + name/sub text, nothing after it.
    expect(html).toContain(
      `'<div class="res-text"><div class="res-name">' + esc(r.name) + '</div>' + sub + '</div>' +\n        '</div>';`,
    )
  })
})

describe('Transition category grouping is unchanged', () => {
  it('builds the same groups, in the same order, with the same members', () => {
    const visible = filterResources(RESOURCES, {
      groupBy: 'category',
      activeSuppliers: new Set(['CG']),
      activeTeams: new Set(['Orion']),
      secondaryFilter: '',
      transitionOnly: false,
      viewMode: 'full',
      editMode: false,
    })
    const groups = buildGroups(visible, CATEGORY_ORDER, 'category')
    expect(groups.map((g) => [g.name, g.resources.map((r) => r.name)])).toEqual([
      ['Transitioned to TCS', ['Mover Person', 'Overlap Person']],
      ['Signed with TCS — start date TBC', ['Signed Person']],
      ['Established at TCS (no CG history)', ['Joiner Person']],
      ['Rolling off, hypercare only — no TCS move', ['Hypercare Person']],
      ['Not moving — attrition', ['Leaver Person']],
      ['Not part of Dudley transition', ['Incumbent Person']],
    ])
  })

  it('keeps the "Transitioning only" filter on status', () => {
    const visible = filterResources(RESOURCES, {
      groupBy: 'team',
      activeSuppliers: new Set(['CG']),
      activeTeams: new Set(['Orion']),
      secondaryFilter: '',
      transitionOnly: true,
      viewMode: 'full',
      editMode: false,
    })
    expect(visible.map((r) => r.name)).not.toContain('Incumbent Person')
    expect(visible).toHaveLength(PEOPLE.length - 1)
  })

  it('still injects the category order into the export for its own grouping', () => {
    const html = buildStandaloneHtml(DATA, {
      groupBy: 'category',
      activeSuppliers: ['CG'],
      activeTeams: ['Orion'],
      transitionOnly: false,
      viewMode: 'full',
      generatedAt: new Date('2026-10-19T09:00:00Z'),
    })
    expect(html).toContain(`"categoryOrder":${JSON.stringify(CATEGORY_ORDER)}`)
  })
})
