'use server'

import { getSupabaseServerClient } from '@plato/schema'
import { revalidatePath } from 'next/cache'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function createTeam(
  platformId: string,
  platformSlug: string,
  formData: FormData
) {
  const name = (formData.get('team_name') as string).trim()
  const description = (formData.get('team_description') as string).trim() || null
  const workstreamId = (formData.get('workstream_id') as string) || null

  if (!name) return { error: 'Name is required.' }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('teams').insert({
    platform_id: platformId,
    team_name: name,
    team_slug: toSlug(name),
    team_description: description,
    workstream_id: workstreamId || null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/platforms/${platformSlug}`)
  return { error: null }
}

export async function updateTeam(
  teamId: string,
  platformSlug: string,
  formData: FormData
) {
  const name = (formData.get('team_name') as string).trim()
  const description = (formData.get('team_description') as string).trim() || null
  const workstreamId = (formData.get('workstream_id') as string) || null

  if (!name) return { error: 'Name is required.' }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('teams')
    .update({
      team_name: name,
      team_slug: toSlug(name),
      team_description: description,
      workstream_id: workstreamId || null,
    })
    .eq('team_id', teamId)
    .is('deleted_at', null)

  if (error) return { error: error.message }
  revalidatePath(`/platforms/${platformSlug}`)
  return { error: null }
}

export async function deleteTeam(
  teamId: string,
  platformSlug: string
) {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('teams')
    .update({ deleted_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .is('deleted_at', null)

  if (error) return { error: error.message }
  revalidatePath(`/platforms/${platformSlug}`)
  return { error: null }
}
