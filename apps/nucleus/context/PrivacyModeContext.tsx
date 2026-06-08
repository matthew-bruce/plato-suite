'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'nucleus-privacy-mode'

interface PrivacyModeContextValue {
  isPrivate: boolean
  togglePrivacy: () => void
}

const PrivacyModeContext = createContext<PrivacyModeContextValue | undefined>(undefined)

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') setIsPrivate(true)
  }, [])

  function togglePrivacy() {
    setIsPrivate((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <PrivacyModeContext.Provider value={{ isPrivate, togglePrivacy }}>
      {children}
    </PrivacyModeContext.Provider>
  )
}

export function usePrivacyMode(): PrivacyModeContextValue {
  const ctx = useContext(PrivacyModeContext)
  if (!ctx) throw new Error('usePrivacyMode must be used within a PrivacyModeProvider')
  return ctx
}
