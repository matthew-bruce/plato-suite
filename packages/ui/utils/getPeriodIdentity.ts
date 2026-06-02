export type PeriodIdentity = {
  quarter: 1 | 2 | 3 | 4
  fiscalYearStart: number
  fiscalYearEnd: number
  fiscalYearLabel: string
}

export function getPeriodIdentity(periodStart: Date): PeriodIdentity {
  const month = periodStart.getUTCMonth() + 1 // 1–12
  const year = periodStart.getUTCFullYear()

  let quarter: 1 | 2 | 3 | 4
  let fyStart: number

  if (month >= 4 && month <= 6) {
    quarter = 1
    fyStart = year
  } else if (month >= 7 && month <= 9) {
    quarter = 2
    fyStart = year
  } else if (month >= 10 && month <= 12) {
    quarter = 3
    fyStart = year
  } else {
    // Jan–Mar: Q4 of the fiscal year that started the previous April
    quarter = 4
    fyStart = year - 1
  }

  const fyEnd = fyStart + 1
  const fiscalYearLabel = `${String(fyStart).slice(2)}/${String(fyEnd).slice(2)}`

  return { quarter, fiscalYearStart: fyStart, fiscalYearEnd: fyEnd, fiscalYearLabel }
}
