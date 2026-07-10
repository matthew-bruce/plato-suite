import { getRatesPageData } from '@plato/schema'
import { RatesPageClient } from '@/components/rates/RatesPageClient'

export const dynamic = 'force-dynamic'

export default async function RatesPage() {
  const data = await getRatesPageData()
  return <RatesPageClient data={data} />
}
