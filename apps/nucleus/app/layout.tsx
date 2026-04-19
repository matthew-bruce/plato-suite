import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nucleus — Plato Suite',
  description: 'Royal Mail Group organisation and resource management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ margin: 0, height: '100%' }}>
        {children}
      </body>
    </html>
  )
}
