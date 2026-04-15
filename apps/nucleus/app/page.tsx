import Link from 'next/link'

export default function Home() {
  return (
    <div
      style={{
        padding: 'var(--rmg-spacing-10) var(--rmg-spacing-08)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h1)',
          lineHeight: 'var(--rmg-leading-h1)',
          color: 'var(--rmg-color-text-heading)',
          marginBottom: 'var(--rmg-spacing-06)',
        }}
      >
        Nucleus
      </h1>
      <p
        style={{
          fontSize: 'var(--rmg-text-b2)',
          lineHeight: 'var(--rmg-leading-b2)',
          color: 'var(--rmg-color-text-body)',
          marginBottom: 'var(--rmg-spacing-07)',
        }}
      >
        The Royal Mail Group component library and design system.
      </p>
      <Link
        href="/design-system"
        style={{
          display: 'inline-block',
          backgroundColor: 'var(--rmg-color-red)',
          color: 'var(--rmg-color-white)',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-b3)',
          lineHeight: 'var(--rmg-leading-b3)',
          padding: 'var(--rmg-spacing-03) var(--rmg-spacing-06)',
          borderRadius: 'var(--rmg-radius-s)',
          textDecoration: 'none',
        }}
      >
        View Design System
      </Link>
    </div>
  )
}
