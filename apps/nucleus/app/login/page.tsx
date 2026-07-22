'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, FormField, Notification } from '@plato/ui/components/rmg'
import { signIn } from '@plato/auth'
import { AuthShell } from '../_auth/AuthShell'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await signIn(email, password)
    if (!result.ok) {
      setSubmitting(false)
      // Deliberately generic — never reveal whether the email exists.
      setError('Incorrect email or password.')
      return
    }
    // Only ever redirect to an internal path (guard against open redirect).
    const nextParam = new URLSearchParams(window.location.search).get('next')
    const dest = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'
    router.replace(dest)
    router.refresh()
  }

  return (
    <AuthShell title="Sign in" subtitle="Plato Suite">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <Notification variant="inline" status="error" message={error} />}
        <FormField
          label="Email"
          type="text"
          name="email"
          value={email}
          placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Password"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="solid" size="large" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <Link
          href="/forgot-password"
          style={{ fontSize: 13, color: 'var(--rmg-color-blue)', textDecoration: 'none', alignSelf: 'flex-start' }}
        >
          Forgotten password?
        </Link>
      </form>
    </AuthShell>
  )
}
