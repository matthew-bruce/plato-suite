import { notFound } from 'next/navigation'
import { getPlatformBySlug } from '@/lib/supabase/platformDetail'
import { PlatformDetailView } from '@/components/platforms/PlatformDetailView'

export const dynamic = 'force-dynamic'

export default async function PlatformDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const platform = await getPlatformBySlug(slug)
  if (!platform) notFound()
  return <PlatformDetailView platform={platform} />
}
