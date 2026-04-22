export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'SCOPED'

export function RiskPill({ risk }: { risk: RiskLevel }) {
  const { bg, fg } = riskPillColours(risk)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px var(--rmg-spacing-03)',
        backgroundColor: bg,
        color: fg,
        borderRadius: 'var(--rmg-radius-xl)',
        fontFamily: 'monospace',
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {risk}
    </span>
  )
}

function riskPillColours(risk: RiskLevel): { bg: string; fg: string } {
  switch (risk) {
    case 'HIGH':
      return { bg: 'var(--rmg-color-tint-red)', fg: 'var(--rmg-color-red)' }
    case 'MEDIUM':
      return {
        bg: 'rgba(243, 146, 13, 0.12)',
        fg: 'var(--rmg-color-orange)',
      }
    case 'LOW':
      return {
        bg: 'var(--rmg-color-tint-green)',
        fg: 'var(--rmg-color-green-contrast)',
      }
    case 'SCOPED':
      return { bg: 'rgba(155, 89, 182, 0.10)', fg: '#9B59B6' }
  }
}
