import { notFound } from 'next/navigation'
import { getPlatformBySlug } from '@/lib/supabase/platformDetail'
import { TeamsView } from '@/components/platforms/TeamsView'

export const dynamic = 'force-dynamic'

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ platformSlug: string }>
}) {
  const { platformSlug } = await params
  const platform = await getPlatformBySlug(platformSlug)
  if (!platform) notFound()

  return (
    <TeamsView
      platformId={platform.platform_id}
      platformSlug={platform.platform_slug}
      workstreams={platform.workstreams}
      teams={platform.teams}
    />
  )
}
