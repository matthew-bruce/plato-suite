import { RISK_COLOURS, RISK_TINTS } from '@plato/ui/tokens'

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
  return { bg: RISK_TINTS[risk], fg: RISK_COLOURS[risk] }
}
