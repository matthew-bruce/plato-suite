import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { TesseraAppShell } from '@/components/TesseraAppShell'

export const metadata: Metadata = {
  title: 'Tessera — Plato Suite',
  description: 'KT Operating System — Plato Suite',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en-GB" style={{ height: '100%' }}>
      <body style={{ margin: 0, height: '100%' }}>
        <TesseraAppShell>{children}</TesseraAppShell>
      </body>
    </html>
  )
}
