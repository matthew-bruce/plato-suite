import { TesseraShell } from '@plato/ui/components/tessera'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  return (
    <TesseraShell activeRoute="/settings">
      <div
        style={{
          maxWidth: 960,
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
        }}
      >
        <div style={{ marginBottom: 'var(--rmg-spacing-07)' }}>
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h2)',
              lineHeight: 'var(--rmg-leading-h2)',
              color: 'var(--rmg-color-text-heading)',
              margin: 0,
            }}
          >
            Settings
          </h1>
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-light)',
              margin: 0,
              marginTop: 'var(--rmg-spacing-02)',
            }}
          >
            Tessera application configuration
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: 'var(--rmg-shadow-card)',
            padding: 'var(--rmg-spacing-07)',
            borderLeft: '4px solid var(--rmg-color-grey-3)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-light)',
              margin: 0,
            }}
          >
            Settings are not yet configured for this application.
          </p>
        </div>
      </div>
    </TesseraShell>
  )
}
