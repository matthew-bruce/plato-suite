import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nucleus — Plato Suite',
  description: 'Royal Mail Group design system application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            backgroundColor: 'var(--rmg-color-red)',
            boxShadow: 'var(--rmg-shadow-header)',
          }}
        >
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--rmg-spacing-07)',
              padding: 'var(--rmg-spacing-04) var(--rmg-spacing-08)',
            }}
          >
            <Link
              href="/"
              style={{
                color: 'var(--rmg-color-white)',
                fontFamily: 'var(--rmg-font-display)',
                fontSize: 'var(--rmg-text-h5)',
                lineHeight: 'var(--rmg-leading-h5)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Nucleus
            </Link>

            <Link
              href="/design-system"
              style={{
                color: 'var(--rmg-color-white)',
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-b3)',
                lineHeight: 'var(--rmg-leading-b3)',
                textDecoration: 'none',
                opacity: 0.9,
              }}
            >
              Design System
            </Link>
          </nav>
        </header>

        <main>{children}</main>
      </body>
    </html>
  )
}
