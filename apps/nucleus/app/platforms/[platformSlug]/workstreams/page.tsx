import { notFound } from 'next/navigation'
import { getPlatformBySlug } from '@/lib/supabase/platformDetail'
import { WorkstreamsView } from '@/components/platforms/WorkstreamsView'

export const dynamic = 'force-dynamic'

export default async function WorkstreamsPage({
  params,
}: {
  params: Promise<{ platformSlug: string }>
}) {
  const { platformSlug } = await params
  const platform = await getPlatformBySlug(platformSlug)
  if (!platform) notFound()

  return (
    <WorkstreamsView
      platformId={platform.platform_id}
      platformSlug={platform.platform_slug}
      workstreams={platform.workstreams}
    />
  )
}
