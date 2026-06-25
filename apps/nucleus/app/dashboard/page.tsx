import { getHomepageData } from '@plato/schema'
import { HomepageClient } from '../_components/HomepageClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ period?: string }>

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { period } = await searchParams
  const data = await getHomepageData(period)
  return <HomepageClient data={data} />
}
