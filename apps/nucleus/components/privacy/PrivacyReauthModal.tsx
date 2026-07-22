'use client'

import { useEffect, useRef, useState } from 'react'
import { FormField } from '@plato/ui/components/rmg'
import { getCurrentUser, signIn } from '@plato/auth'
import { verifyStepUpPassword } from '@/lib/auth/stepUp'

/* ── Chrome constants (match CreatePeriodWizard) ── */
const ACTIVE_RED = '#DA202A'
const INACTIVE_GREY = '#8F9495'
const HEADER_BG = '#2A2A2D'

export interface PrivacyReauthModalProps {
  open: boolean
  /** Cancel/dismiss — Privacy Mode stays ON, nothing revealed. */
  onClose: () => void
  /** Password confirmed for the signed-in user — reveal the figures. */
  onVerified: () => void
}

/**
 * Step-up re-authentication before turning Privacy Mode OFF (revealing
 * financial figures). Verifies the CURRENTLY signed-in user's password via
 * @plato/auth. The entered password is held only in local state for the single
 * verification call and cleared immediately on submit — never persisted,
 * cached, or logged. The browser/password-manager autofill path (via
 * autocomplete="current-password") is the only intended way credentials are
 * remembered.
 */
export function PrivacyReauthModal({ open, onClose, onVerified }: PrivacyReauthModalProps) {
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const emailReady = useRef(false)

  // Resolve the signed-in user's email when the modal opens, and reset all
  // transient state so a previous attempt never bleeds into the next open.
  useEffect(() => {
    if (!open) return
    setPassword('')
    setError(null)
    setSubmitting(false)
    emailReady.current = false
    let active = true
    getCurrentUser().then((u) => {
      if (!active) return
      setEmail(u?.email ?? null)
      emailReady.current = true
    })
    return () => {
      active = false
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    // Snapshot the value and clear it from state up front, so it never lingers
    // in React state beyond this single verification call regardless of outcome.
    const attempt = password
    setPassword('')
    setError(null)
    setSubmitting(true)

    const res = await verifyStepUpPassword(email, attempt, signIn)

    setSubmitting(false)
    if (res.ok) {
      onVerified()
      return
    }
    // Generic message only — never reveal why (wrong password vs. no account).
    setError('Incorrect password.')
  }

  if (!open) return null

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(241, 242, 245, 0.88)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  }
  const card: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: 12,
    width: 420,
    maxWidth: 'calc(100vw - 32px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    fontFamily: 'var(--rmg-font-body)',
  }
  const headerStyle: React.CSSProperties = {
    background: HEADER_BG,
    color: '#fff',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  }
  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    padding: '7px 16px',
    border: 'none',
  }
  const btnPrimary: React.CSSProperties = { ...btnBase, background: ACTIVE_RED, color: '#fff' }
  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: 'transparent',
    color: '#404044',
    border: '1px solid #C0C0C0',
  }
  const btnDisabled: React.CSSProperties = { ...btnPrimary, background: '#C0C0C0', cursor: 'not-allowed' }

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal aria-label="Confirm your password">
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Confirm your password</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 6px',
              fontFamily: 'var(--rmg-font-body)',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: INACTIVE_GREY, lineHeight: 1.5 }}>
            Turning off Privacy Mode reveals financial figures. Enter your password to confirm it's you.
          </p>

          <FormField
            label="Password"
            type="password"
            name="privacy-reauth-password"
            value={password}
            autoComplete="current-password"
            variant={error ? 'error' : 'default'}
            errorMessage={error ?? undefined}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(null)
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || password.length === 0}
              style={submitting || password.length === 0 ? btnDisabled : btnPrimary}
            >
              {submitting ? 'Verifying…' : 'Reveal figures'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PrivacyReauthModal
