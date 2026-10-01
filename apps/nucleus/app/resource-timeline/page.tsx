import { getResourceTimelineData } from '@plato/schema/server'
import { ResourceTimelineClient } from '@/components/resource-timeline/ResourceTimelineClient'
import type { Metadata } from 'next'
import { NAV_LABELS } from '@/app/_components/navLabels'

export const metadata: Metadata = { title: NAV_LABELS.resourceTimeline }

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ engine?: string | string[] }>

/**
 * Engine switch for the dual-running phase (ADR-035): the native engagement
 * engine renders by default; ?engine=legacy renders the translator path from
 * the same fetched rows, for side-by-side checks without a redeploy.
 */
export default async function ResourceTimelinePage({ searchParams }: { searchParams: SearchParams }) {
  const { engine } = await searchParams
  const data = await getResourceTimelineData(engine === 'legacy' ? 'legacy' : 'engagements')

  if (!data || data.resources.length === 0) {
    return (
      <div style={{ padding: 40 }}>
        <h1
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h3)',
            color: 'var(--rmg-color-text-heading)',
          }}
        >
          No timeline data available
        </h1>
        <p style={{ color: 'var(--rmg-color-text-light)', marginTop: 8, maxWidth: 560 }}>
          The Resource Timeline reads allocations for Q2 and Q3 FY 26/27. Once those
          periods have allocations against them, supplier coverage will appear here.
        </p>
      </div>
    )
  }

  return <ResourceTimelineClient data={data} />
}
