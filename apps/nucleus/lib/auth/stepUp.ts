/**
 * Step-up (re-authentication) verification for sensitive client actions such as
 * turning Privacy Mode off. Pure with respect to the auth provider: the caller
 * injects the sign-in function (@plato/auth's signIn) and the currently
 * signed-in user's email, so this logic is unit-testable without Supabase.
 *
 * We deliberately re-check the CURRENTLY signed-in user's password by calling
 * signIn with their own email — a standard step-up confirmation. It's the same
 * already-authenticated user, so refreshing their session is harmless.
 *
 * The caller must never persist, cache, or log the password beyond this call.
 */

export interface StepUpResult {
  ok: boolean
}

export type SignInFn = (email: string, password: string) => Promise<{ ok: boolean }>

/**
 * Verify the given password for the currently signed-in user.
 *
 * Returns `{ ok: false }` without hitting the provider when we don't have a
 * usable email (no active session) or the password is empty — there's nothing
 * meaningful to check, and short-circuiting avoids a pointless network call.
 * The boolean is intentionally the only signal returned: callers surface a
 * single generic "incorrect password" message and never the provider's reason.
 */
export async function verifyStepUpPassword(
  email: string | null | undefined,
  password: string,
  signInFn: SignInFn,
): Promise<StepUpResult> {
  const trimmedEmail = (email ?? '').trim()
  if (trimmedEmail === '' || password === '') {
    return { ok: false }
  }
  const result = await signInFn(trimmedEmail, password)
  return { ok: result.ok === true }
}
