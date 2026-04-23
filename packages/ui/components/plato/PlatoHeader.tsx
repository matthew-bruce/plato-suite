'use client'

interface PlatoHeaderProps {
  activatedApp: 'nucleus' | 'tessera' | 'dispatch' | 'chronicle' | 'roadmap'
  apps: {
    id: string
    label: string
    url: string
    enabled: boolean
  }[]
}

export function PlatoHeader({ activatedApp, apps }: PlatoHeaderProps) {
  const enabledApps = apps.filter((a) => a.enabled)

  return (
    <div
      style={{
        height: 48,
        flexShrink: 0,
        backgroundColor: 'var(--rmg-color-red)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 'var(--rmg-spacing-05)',
        paddingRight: 'var(--rmg-spacing-05)',
      }}
    >
      {/* Wordmark */}
      <span
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '0.5px',
          color: '#ffffff',
          userSelect: 'none',
        }}
      >
        Plato
      </span>

      {/* App pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rmg-spacing-02)' }}>
        {enabledApps.map((app) => {
          const isActive = app.id === activatedApp
          return isActive ? (
            <span
              key={app.id}
              style={{
                backgroundColor: '#ffffff',
                color: 'var(--rmg-color-red)',
                borderRadius: 'var(--rmg-radius-xl)',
                padding: '4px 14px',
                fontSize: 'var(--rmg-text-c1)',
                lineHeight: 'var(--rmg-leading-c1)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {app.label}
            </span>
          ) : (
            <button
              key={app.id}
              type="button"
              onClick={() => { window.location.href = app.url }}
              style={{
                backgroundColor: 'transparent',
                color: 'rgba(255, 255, 255, 0.80)',
                borderRadius: 'var(--rmg-radius-xl)',
                padding: '4px 14px',
                fontSize: 'var(--rmg-text-c1)',
                lineHeight: 'var(--rmg-leading-c1)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {app.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
