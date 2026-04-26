export const CHART_START = new Date('2026-04-01')
export const CHART_END   = new Date('2027-03-31')
export const TOTAL_MONTHS = 12

export const MONTH_YEAR_LABELS = [
  'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26',
  'Oct 26', 'Nov 26 ⚑', 'Dec 26', 'Jan 27', 'Feb 27', 'Mar 27',
]

export interface Phase {
  label: string
  months: number
  colour: string
  textColour: string
}

export const PHASES: Phase[] = [
  { label: 'Q1 — CG Prime / TCS Shadow',      months: 3, colour: 'var(--rmg-color-tint-green)', textColour: 'var(--rmg-color-green)' },
  { label: 'Q2 — TCS Prime (Switch)',          months: 3, colour: 'rgba(255,189,128,0.35)',       textColour: '#7a3800' },
  { label: 'Q3 — TCS Prime / CG Hypercare',   months: 3, colour: 'rgba(8,146,203,0.1)',          textColour: 'var(--rmg-color-blue)' },
  { label: 'Q4 — BIG Transition',             months: 3, colour: 'rgba(106,27,154,0.06)',        textColour: '#4a148c' },
]

// Pre-computed sharp-stop gradient for row backgrounds (evaluated at runtime by browser)
export function buildPhaseGradient(): string {
  const stops: string[] = []
  let pos = 0
  for (const phase of PHASES) {
    stops.push(`${phase.colour} ${pos}%`)
    pos += (phase.months / TOTAL_MONTHS) * 100
    stops.push(`${phase.colour} ${pos}%`)
  }
  return `linear-gradient(to right, ${stops.join(', ')})`
}

export function getBarPosition(
  onboardedDate: string | null,
  rolloffDate: string | null,
): { startMonth: number; endMonth: number; isOngoing: boolean } {
  const parseMonth = (dateStr: string): number => {
    const d = new Date(dateStr)
    const diff =
      (d.getFullYear() - CHART_START.getFullYear()) * 12 +
      (d.getMonth() - CHART_START.getMonth())
    return Math.max(0, Math.min(diff, TOTAL_MONTHS))
  }

  const startMonth = onboardedDate ? parseMonth(onboardedDate) : 0
  const isOngoing  = rolloffDate === null
  const endMonth   = rolloffDate ? parseMonth(rolloffDate) + 1 : TOTAL_MONTHS

  return { startMonth, endMonth: Math.min(endMonth, TOTAL_MONTHS), isOngoing }
}
