import { db } from '../client'

export type Discipline = {
  discipline_id: string
  discipline_name: string
  discipline_slug: string
  discipline_category: string
  sort_order: number
}

export async function getDisciplines(): Promise<Discipline[]> {
  const { data, error } = await db
    .from('disciplines')
    .select('discipline_id, discipline_name, discipline_slug, discipline_category, sort_order')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}
