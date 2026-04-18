'use server'

import { getSupabaseServerClient } from '@plato/schema'
import { revalidatePath } from 'next/cache'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function createPlatform(formData: FormData) {
  const name = (formData.get('platform_name') as string).trim()
  const code = (formData.get('platform_code') as string).trim().toUpperCase()
  const description = (formData.get('platform_description') as string).trim() || null

  if (!name || !code) return { error: 'Name and code are required.' }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('platforms').insert({
    platform_name: name,
    platform_code: code,
    platform_slug: toSlug(name),
    platform_description: description,
  })

  if (error) return { error: error.message }
  revalidatePath('/platforms')
  return { error: null }
}

export async function updatePlatform(platformId: string, formData: FormData) {
  const name = (formData.get('platform_name') as string).trim()
  const code = (formData.get('platform_code') as string).trim().toUpperCase()
  const description = (formData.get('platform_description') as string).trim() || null

  if (!name || !code) return { error: 'Name and code are required.' }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('platforms')
    .update({
      platform_name: name,
      platform_code: code,
      platform_slug: toSlug(name),
      platform_description: description,
    })
    .eq('platform_id', platformId)
    .is('deleted_at', null)

  if (error) return { error: error.message }
  revalidatePath('/platforms')
  revalidatePath(`/platforms/${toSlug(name)}`)
  return { error: null }
}

export async function deletePlatform(platformId: string) {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('platforms')
    .update({ deleted_at: new Date().toISOString() })
    .eq('platform_id', platformId)
    .is('deleted_at', null)

  if (error) return { error: error.message }
  revalidatePath('/platforms')
  return { error: null }
}
