'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { PrivacyReauthModal } from '@/components/privacy/PrivacyReauthModal'

const STORAGE_KEY = 'nucleus-privacy-mode'

interface PrivacyModeContextValue {
  isPrivate: boolean
  togglePrivacy: () => void
}

const PrivacyModeContext = createContext<PrivacyModeContextValue | undefined>(undefined)

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false)
  // Open only while a step-up re-auth is in flight for turning Privacy Mode
  // OFF. Revealing figures is the sensitive direction and is gated on it.
  const [reauthOpen, setReauthOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') setIsPrivate(true)
  }, [])

  function persist(next: boolean) {
    setIsPrivate(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  function togglePrivacy() {
    // Turning ON (hiding figures) is instant — no friction, no prompt.
    // Turning OFF (revealing figures) must NOT flip here: it only becomes
    // possible after a successful password re-check in the modal. Until then
    // isPrivate stays true and the figures stay hidden.
    if (isPrivate) {
      setReauthOpen(true)
    } else {
      persist(true)
    }
  }

  function handleVerified() {
    // Reached only via the modal's successful signIn verification. This is the
    // single path that can clear Privacy Mode; once cleared it stays revealed
    // (persisted) until the user manually turns it back on — no timeout, no
    // re-lock on refresh or navigation.
    persist(false)
    setReauthOpen(false)
  }

  return (
    <PrivacyModeContext.Provider value={{ isPrivate, togglePrivacy }}>
      {children}
      <PrivacyReauthModal
        open={reauthOpen}
        onClose={() => setReauthOpen(false)}
        onVerified={handleVerified}
      />
    </PrivacyModeContext.Provider>
  )
}

export function usePrivacyMode(): PrivacyModeContextValue {
  const ctx = useContext(PrivacyModeContext)
  if (!ctx) throw new Error('usePrivacyMode must be used within a PrivacyModeProvider')
  return ctx
}
