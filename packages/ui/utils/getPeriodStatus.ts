export type PeriodStatus = 'active' | 'historic' | 'draft'

export function getPeriodStatus(
  periodStart: Date,
  periodEnd: Date,
  today: Date = new Date(),
): PeriodStatus {
  const start = new Date(periodStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(periodEnd)
  end.setHours(23, 59, 59, 999)
  const now = new Date(today)
  now.setHours(12, 0, 0, 0)
  if (now >= start && now <= end) return 'active'
  if (now > end) return 'historic'
  return 'draft'
}
