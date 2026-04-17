import { getSupabaseServerClient } from '@plato/schema'

export type WorkstreamRow = {
  workstream_id: string
  workstream_name: string
  workstream_slug: string
  workstream_description: string | null
  funding_source: 'T4B' | 'T4T' | 'external'
  sort_order: number
}

export type TeamRow = {
  team_id: string
  team_name: string
  team_slug: string
  team_description: string | null
  workstream_id: string | null
  sort_order: number
}

export type PlatformDetailData = {
  platform_id: string
  platform_name: string
  platform_code: string
  platform_slug: string
  platform_description: string | null
  workstreams: WorkstreamRow[]
  teams: TeamRow[]
}

export async function getPlatformBySlug(
  slug: string
): Promise<PlatformDetailData | null> {
  const supabase = getSupabaseServerClient()

  const { data: platform, error } = await supabase
    .from('platforms')
    .select('platform_id, platform_name, platform_code, platform_slug, platform_description')
    .eq('platform_slug', slug)
    .is('deleted_at', null)
    .single()

  if (error || !platform) return null

  const { data: workstreams } = await supabase
    .from('workstreams')
    .select('workstream_id, workstream_name, workstream_slug, workstream_description, funding_source, sort_order')
    .eq('platform_id', platform.platform_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  const { data: teams } = await supabase
    .from('teams')
    .select('team_id, team_name, team_slug, team_description, workstream_id, sort_order')
    .eq('platform_id', platform.platform_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  return {
    ...platform,
    workstreams: (workstreams ?? []) as WorkstreamRow[],
    teams: (teams ?? []) as TeamRow[],
  }
}
