import { getTimelineResources } from '@/lib/timeline'
import { DOMAIN_CONFIG } from '@/lib/timeline-domains'
import { ResourceGantt } from '@/components/timeline/ResourceGantt'

export const dynamic = 'force-dynamic'

export default async function TimelinePage() {
  const resources = await getTimelineResources()
  return (
      <ResourceGantt resources={resources} domainConfig={DOMAIN_CONFIG} />
  )
}
