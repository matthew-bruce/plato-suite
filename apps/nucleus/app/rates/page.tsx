import { getRatesPageData } from '@plato/schema/server'
import { RatesPageClient } from '@/components/rates/RatesPageClient'
import type { Metadata } from 'next'
import { NAV_LABELS } from '@/app/_components/navLabels'

export const metadata: Metadata = { title: NAV_LABELS.blendedRates }

export const dynamic = 'force-dynamic'

export default async function RatesPage() {
  const data = await getRatesPageData()
  return <RatesPageClient data={data} />
}
