import { notFound } from 'next/navigation'
import { getPlatformBySlug } from '@/lib/supabase/platformDetail'
import { PlatformDetailView } from '@/components/platforms/PlatformDetailView'

export const dynamic = 'force-dynamic'

export default async function PlatformDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const platform = await getPlatformBySlug(params.slug)
  if (!platform) notFound()
  return <PlatformDetailView platform={platform} />
}
