import { getSupabaseServerClient } from '@plato/schema'

export type PlatformRow = {
  platform_id: string
  platform_name: string
  platform_code: string
  platform_slug: string
  platform_description: string | null
  sort_order: number
}

export async function getPlatforms(): Promise<PlatformRow[]> {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('platforms')
    .select(
      'platform_id, platform_name, platform_code, platform_slug, platform_description, sort_order'
    )
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Failed to fetch platforms: ${error.message}`)
  return (data ?? []) as PlatformRow[]
}
