'use server'

import { getSupabaseServerClient } from '@plato/schema'
import { revalidatePath } from 'next/cache'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function createWorkstream(
  platformId: string,
  platformSlug: string,
  formData: FormData
) {
  const name = (formData.get('workstream_name') as string).trim()
  const description = (formData.get('workstream_description') as string).trim() || null
  const fundingSource = formData.get('funding_source') as 'T4B' | 'T4T' | 'external'

  if (!name || !fundingSource) return { error: 'Name and funding source are required.' }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('workstreams').insert({
    platform_id: platformId,
    workstream_name: name,
    workstream_slug: toSlug(name),
    workstream_description: description,
    funding_source: fundingSource,
  })

  if (error) return { error: error.message }
  revalidatePath(`/platforms/${platformSlug}`)
  return { error: null }
}

export async function updateWorkstream(
  workstreamId: string,
  platformSlug: string,
  formData: FormData
) {
  const name = (formData.get('workstream_name') as string).trim()
  const description = (formData.get('workstream_description') as string).trim() || null
  const fundingSource = formData.get('funding_source') as 'T4B' | 'T4T' | 'external'

  if (!name || !fundingSource) return { error: 'Name and funding source are required.' }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('workstreams')
    .update({
      workstream_name: name,
      workstream_slug: toSlug(name),
      workstream_description: description,
      funding_source: fundingSource,
    })
    .eq('workstream_id', workstreamId)
    .is('deleted_at', null)

  if (error) return { error: error.message }
  revalidatePath(`/platforms/${platformSlug}`)
  return { error: null }
}

export async function deleteWorkstream(
  workstreamId: string,
  platformSlug: string
) {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('workstreams')
    .update({ deleted_at: new Date().toISOString() })
    .eq('workstream_id', workstreamId)
    .is('deleted_at', null)

  if (error) return { error: error.message }
  revalidatePath(`/platforms/${platformSlug}`)
  return { error: null }
}
