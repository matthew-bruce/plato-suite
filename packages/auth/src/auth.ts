import type { User } from '@supabase/supabase-js'
import { getBrowserAuthClient } from './browser'

export interface AuthResult {
  ok: boolean
  /** Raw provider error, for logging only — never surface verbatim to users
   *  on the login form (it can distinguish existing vs non-existent accounts). */
  error?: string
}

/**
 * Generic, provider-agnostic auth surface. Application code depends only on
 * these names — never on supabase.auth.* — so a future swap to OIDC (ADR-004)
 * is a change inside @plato/auth, not across both apps (ADR-003).
 */

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getBrowserAuthClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  const supabase = getBrowserAuthClient()
  await supabase.auth.signOut()
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getBrowserAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Trigger a password-reset email. Returns void and never throws for an
 * unknown address, so callers cannot use it to probe which emails have
 * accounts — the UI must show the same confirmation regardless.
 * `redirectTo` should point at the app's /auth/callback route handler.
 */
export async function requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const supabase = getBrowserAuthClient()
  try {
    await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)
  } catch {
    // Swallow — do not leak whether the address exists or that a send failed.
  }
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const supabase = getBrowserAuthClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Subscribe to session changes. Returns an unsubscribe function. The callback
 * receives the current user (or null when signed out).
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const supabase = getBrowserAuthClient()
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => subscription.unsubscribe()
}
