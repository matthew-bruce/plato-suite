import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { NucleusAppShell } from './_components/NucleusAppShell'

export const metadata: Metadata = {
  title: 'Nucleus — Plato Suite',
  description: 'Royal Mail Group organisation and resource management',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ margin: 0, height: '100%' }}>
        <NucleusAppShell>{children}</NucleusAppShell>
      </body>
    </html>
  )
}
