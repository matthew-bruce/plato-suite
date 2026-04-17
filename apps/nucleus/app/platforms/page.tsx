import { getPlatforms } from '@/lib/supabase/platforms'
import { PlatformsView } from '@/components/platforms/PlatformsView'

export const dynamic = 'force-dynamic'

export default async function PlatformsPage() {
  const platforms = await getPlatforms()
  return <PlatformsView platforms={platforms} />
}
