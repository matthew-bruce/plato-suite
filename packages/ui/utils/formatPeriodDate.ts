export function formatPeriodDate(date: Date): string {
  const day = date.getDate()
  const suffix = ['th', 'st', 'nd', 'rd'][
    day % 10 <= 3 && Math.floor(day / 10) !== 1 ? day % 10 : 0
  ]
  const month = date.toLocaleString('en-GB', { month: 'long' })
  const year = date.getFullYear()
  return `${day}${suffix} ${month} ${year}`
}
