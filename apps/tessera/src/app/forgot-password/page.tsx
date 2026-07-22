'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, FormField, Notification } from '@plato/ui/components/rmg'
import { requestPasswordReset, isValidEmail } from '@plato/auth'
import { AuthShell } from '../_auth/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    // Only actually send if the address is well-formed, but show the same
    // confirmation either way so we never reveal whether an account exists.
    if (isValidEmail(email)) {
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
      await requestPasswordReset(email, redirectTo)
    }
    setSubmitting(false)
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Check your inbox" subtitle="Plato Suite">
        <Notification
          variant="inline"
          status="information"
          message="If that email matches an account, we've sent a link to reset your password."
        />
        <div style={{ marginTop: 16 }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--rmg-color-blue)', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset your password" subtitle="Plato Suite">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--rmg-color-text-light, #666)', lineHeight: 1.5 }}>
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
        <FormField
          label="Email"
          type="text"
          name="email"
          value={email}
          placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="solid" size="large" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link
          href="/login"
          style={{ fontSize: 13, color: 'var(--rmg-color-blue)', textDecoration: 'none', alignSelf: 'flex-start' }}
        >
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  )
}
