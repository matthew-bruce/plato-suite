import { getPeopleDirectoryData } from '@plato/schema/server'
import { PeopleDirectoryClient } from '@/components/people/PeopleDirectoryClient'
import type { Metadata } from 'next'
import { NAV_LABELS } from '@/app/_components/navLabels'

export const metadata: Metadata = { title: NAV_LABELS.resources }

export const dynamic = 'force-dynamic'

export default async function PeoplePage() {
  const data = await getPeopleDirectoryData()

  return <PeopleDirectoryClient resources={data.resources} />
}
