import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { NucleusAppShell } from './_components/NucleusAppShell'
import { PrivacyModeProvider } from '@/context/PrivacyModeContext'

export const metadata: Metadata = {
  title: 'Nucleus — Plato Suite',
  description: 'Royal Mail Group organisation and resource management',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%', scrollbarGutter: 'stable' }}>
      <body style={{ margin: 0, height: '100%' }}>
        <PrivacyModeProvider>
          <NucleusAppShell>{children}</NucleusAppShell>
        </PrivacyModeProvider>
      </body>
    </html>
  )
}
