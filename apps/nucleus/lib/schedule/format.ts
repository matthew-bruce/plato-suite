// Pure helpers for the Platform Schedule page.
// Money is stored as integer pence per ADR-029 — never raw pence to the user.

export function formatMoneyPence(pence: number, opts: { decimals?: 0 | 2 } = {}): string {
  const decimals = opts.decimals ?? 0
  const value = pence / 100
  return `£${value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

// Simple business day count between two ISO dates (inclusive).
// Treats Saturdays and Sundays as non-working; no bank holiday logic.
export function workingDaysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + 'T00:00:00Z')
  const end = new Date(endISO + 'T00:00:00Z')
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0
  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) days += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

// VAT total for an allocation. Internal supplier rows do not attract
// irrecoverable VAT — only external suppliers do.
export function computeVatTotalPence(
  basePence: number,
  vatUpliftPercent: number,
  isInternal: boolean,
): number {
  if (isInternal) return basePence
  return Math.round(basePence * (1 + vatUpliftPercent / 100))
}

// Short quarter label e.g. "Q4 FY 25/26" → "Q4 25/26"
export function shortQuarterLabel(periodName: string): string {
  return periodName.replace(/\s*FY\s*/i, ' ').replace(/\s+/g, ' ').trim()
}
