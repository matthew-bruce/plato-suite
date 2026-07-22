// The only Supabase env vars auth needs are the public URL + anon key — the
// same ones existing client code already uses. No new env vars are introduced
// by auth. (Nucleus's server-side data layer keeps using SUPABASE_SERVICE_ROLE_KEY
// via @plato/schema; that is unrelated to session handling here.)
export function getPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
  if (!anonKey) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return { url, anonKey }
}
