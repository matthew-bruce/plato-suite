import { TesseraShell } from '@plato/ui/components/tessera'

// Blue badge colours specified in design brief (no --rmg-* token exists)
const BLUE_BADGE_BG = '#E6F1FB'
const BLUE_BADGE_FG = '#185FA5'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  return (
    <TesseraShell activeRoute="/settings">
      <div
        style={{
          maxWidth: 720,
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
        }}
      >
        {/* Page header */}
        <div style={{ marginBottom: 'var(--rmg-spacing-07)' }}>
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h2)',
              lineHeight: 'var(--rmg-leading-h2)',
              fontWeight: 700,
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
            Configuration and preferences for this Tessera deployment
          </p>
        </div>

        {/* Card stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}>
          {/* Card 1 — RAG Scoring */}
          <SettingsCard
            accentColour="var(--rmg-color-orange)"
            title="RAG Score Management"
            body="Update readiness scores across the 6 KT dimensions for each domain. Red, Amber, and Green ratings drive the programme dashboard."
            badgeBg="var(--rmg-color-tint-orange)"
            badgeFg="var(--rmg-color-orange)"
          />

          {/* Card 2 — Session Status */}
          <SettingsCard
            accentColour="var(--rmg-color-blue)"
            title="Session Status Updates"
            body="Mark KT sessions as Completed, Rescheduled, or Cancelled. Record outcomes and link to session outputs."
            badgeBg={BLUE_BADGE_BG}
            badgeFg={BLUE_BADGE_FG}
          />

          {/* Card 3 — Deployment */}
          <SettingsCard
            accentColour="var(--rmg-color-grey-1)"
            title="Deployment Configuration"
            body="Manage programme dates, supplier contacts, and display preferences for this Tessera installation."
            badgeBg="var(--rmg-color-grey-4)"
            badgeFg="var(--rmg-color-grey-1)"
          />
        </div>

        {/* Footer note */}
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-grey-1)',
            marginTop: 'var(--rmg-spacing-06)',
            marginBottom: 0,
          }}
        >
          Settings will be progressively enabled as the programme advances.
          Contact your Tessera administrator to request early access to any
          feature.
        </p>
      </div>
    </TesseraShell>
  )
}

function SettingsCard({
  accentColour,
  title,
  body,
  badgeBg,
  badgeFg,
}: {
  accentColour: string
  title: string
  body: string
  badgeBg: string
  badgeFg: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        border: '0.5px solid var(--rmg-color-grey-2)',
        borderLeft: `4px solid ${accentColour}`,
        borderRadius: 'var(--rmg-radius-m)',
        padding: 'var(--rmg-spacing-06) var(--rmg-spacing-07)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--rmg-spacing-04)',
          marginBottom: 'var(--rmg-spacing-03)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h5)',
            lineHeight: 'var(--rmg-leading-h5)',
            fontWeight: 500,
            color: 'var(--rmg-color-text-heading)',
          }}
        >
          {title}
        </span>
        <span
          style={{
            backgroundColor: badgeBg,
            color: badgeFg,
            borderRadius: 'var(--rmg-radius-xl)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            padding: '2px 10px',
            fontFamily: 'var(--rmg-font-body)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Coming soon
        </span>
      </div>
      <p
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-b3)',
          lineHeight: 'var(--rmg-leading-b3)',
          color: 'var(--rmg-color-text-light)',
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  )
}
