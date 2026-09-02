import { getResourceTimelineData } from '@plato/schema/server'
import { ResourceTimelineClient } from '@/components/resource-timeline/ResourceTimelineClient'

export const dynamic = 'force-dynamic'

export default async function ResourceTimelinePage() {
  const data = await getResourceTimelineData()

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
