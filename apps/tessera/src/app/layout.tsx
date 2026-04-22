import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tessera — Plato Suite',
  description: 'KT Operating System — Plato Suite',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB" style={{ height: '100%' }}>
      <body style={{ margin: 0, height: '100%' }}>{children}</body>
    </html>
  )
}
