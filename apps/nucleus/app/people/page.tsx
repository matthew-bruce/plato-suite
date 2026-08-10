import { getPeopleDirectoryData } from '@plato/schema/server'
import { PeopleDirectoryClient } from '@/components/people/PeopleDirectoryClient'

export const dynamic = 'force-dynamic'

export default async function PeoplePage() {
  const data = await getPeopleDirectoryData()

  return <PeopleDirectoryClient resources={data.resources} />
}
