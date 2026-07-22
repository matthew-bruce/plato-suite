// Pure validation logic — no vendor SDK, no framework. Unit-tested.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

export const MIN_PASSWORD_LENGTH = 8

export interface PasswordResetInput {
  password: string
  confirmPassword: string
}

/**
 * Client-side validation for the reset-password form. The server (Supabase)
 * is the real authority — this is purely for immediate UX feedback so we
 * don't round-trip an obviously-invalid pair.
 */
export function validatePasswordReset(input: PasswordResetInput): { ok: boolean; error?: string } {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' }
  }
  return { ok: true }
}
