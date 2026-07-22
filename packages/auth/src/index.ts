// Client-safe entry point. Server-only helpers live at @plato/auth/server
// (next/headers) and @plato/auth/middleware (next/server) so importing the
// generic auth functions from a client component never drags server-only
// modules into the client bundle.

export {
  signIn,
  signOut,
  getCurrentUser,
  requestPasswordReset,
  updatePassword,
  onAuthStateChange,
} from './auth'
export type { AuthResult } from './auth'

export { getBrowserAuthClient } from './browser'

export { isPublicPath, PUBLIC_PATHS } from './routes'

export { isValidEmail, validatePasswordReset, MIN_PASSWORD_LENGTH } from './validation'
export type { PasswordResetInput } from './validation'
