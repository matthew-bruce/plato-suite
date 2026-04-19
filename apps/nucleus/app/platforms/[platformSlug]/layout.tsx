import { getPlatforms } from '@/lib/supabase/platforms'
import { NucleusShell } from '@plato/ui/components/nucleus'
import type { PlatformOption } from '@plato/ui/components/nucleus'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ platformSlug: string }>
}) {
  const { platformSlug } = await params
  const platforms = await getPlatforms()

  const platformOptions: PlatformOption[] = platforms.map((p) => ({
    platform_slug: p.platform_slug,
    platform_name: p.platform_name,
    platform_code: p.platform_code,
  }))

  return (
    <NucleusShell platforms={platformOptions} activePlatformSlug={platformSlug}>
      {children}
    </NucleusShell>
  )
}
