import { getSchedulePageData } from '@plato/schema/server'
import { SchedulePageClient } from '@/components/schedule/SchedulePageClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ period?: string }>

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { period } = await searchParams
  const data = await getSchedulePageData(period)

  if (!data) {
    return (
      <div style={{ padding: 40 }}>
        <h1
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h3)',
            color: 'var(--rmg-color-text-heading)',
          }}
        >
          No periods configured
        </h1>
        <p style={{ color: 'var(--rmg-color-text-light)', marginTop: 8 }}>
          Once a period exists in the database the Platform Schedule will appear here.
        </p>
      </div>
    )
  }

  return <SchedulePageClient data={data} />
}
