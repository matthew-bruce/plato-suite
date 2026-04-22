import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tessera — KT Operating System',
  description: 'Knowledge Transfer Operating System — Plato Suite',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  )
}
