'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, FormField, Notification } from '@plato/ui/components/rmg'
import { updatePassword, validatePasswordReset } from '@plato/auth'
import { AuthShell } from '../_auth/AuthShell'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const validation = validatePasswordReset({ password, confirmPassword })
    if (!validation.ok) {
      setError(validation.error ?? 'Please check your password.')
      return
    }
    setSubmitting(true)
    // The recovery session was established by the /auth/callback route handler
    // when the emailed link was opened, so updateUser() applies to that user.
    const result = await updatePassword(password)
    setSubmitting(false)
    if (!result.ok) {
      setError('Could not update your password. Your reset link may have expired — request a new one.')
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="Plato Suite">
        <Notification variant="inline" status="success" message="Your password has been updated." />
        <div style={{ marginTop: 16 }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--rmg-color-blue)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Set a new password" subtitle="Plato Suite">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <Notification variant="inline" status="error" message={error} />}
        <FormField
          label="New password"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormField
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" variant="solid" size="large" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  )
}
