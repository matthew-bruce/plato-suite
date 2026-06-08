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

// UK (England & Wales) bank holidays. Working-day counts exclude these in
// addition to weekends, so e.g. Q1 FY26/27 (Apr–Jun 2026) is 61, not 65.
// Extend this list as new fiscal years are scheduled.
const UK_BANK_HOLIDAYS = new Set<string>([
  // 2025
  '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-05',
  '2025-05-26', '2025-08-25', '2025-12-25', '2025-12-26',
  // 2026
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04',
  '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  // 2027
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03',
  '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
])

// Business day count between two ISO dates (inclusive). Excludes weekends
// and UK bank holidays.
export function workingDaysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + 'T00:00:00Z')
  const end = new Date(endISO + 'T00:00:00Z')
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0
  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getUTCDay()
    const iso = cursor.toISOString().slice(0, 10)
    if (day !== 0 && day !== 6 && !UK_BANK_HOLIDAYS.has(iso)) days += 1
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
