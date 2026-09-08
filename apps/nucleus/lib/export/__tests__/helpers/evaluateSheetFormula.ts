// A minimal evaluator for the two constructs buildPlatformTotalFormula emits
// (SUMIFS with "<>" criteria, and SUM), joined by '+'. Tests use it to check
// that a formula string actually reads the cells it should, rather than only
// that it looks right.

export type Grid = Map<string, number | string>

/** Evaluate a built formula over a sheet grid. */
export function evaluateFormula(formula: string, grid: Grid): number {
  const cells = (range: string): (number | string)[] => {
    const [from, to] = range.split(':')
    const col = from.replace(/\d/g, '')
    const first = parseInt(from.replace(/\D/g, ''), 10)
    const last = parseInt(to.replace(/\D/g, ''), 10)
    const out: (number | string)[] = []
    for (let r = first; r <= last; r++) out.push(grid.get(`${col}${r}`) ?? '')
    return out
  }
  const numeric = (v: number | string) => (typeof v === 'number' ? v : 0)

  return formula.split('+').reduce((total, term) => {
    const sum = term.match(/^SUM\(([A-Z]+\d+:[A-Z]+\d+)\)$/)
    if (sum) return total + cells(sum[1]).reduce<number>((s, v) => s + numeric(v), 0)

    const sumifs = term.match(/^SUMIFS\((.+)\)$/)
    if (sumifs) {
      const args = sumifs[1].split(',')
      const values = cells(args[0])
      // Remaining args are (criteriaRange, criterion) pairs.
      const pairs: { range: (number | string)[]; criterion: string }[] = []
      for (let i = 1; i < args.length; i += 2) {
        pairs.push({ range: cells(args[i]), criterion: args[i + 1].replace(/"/g, '') })
      }
      return (
        total +
        values.reduce<number>((s, v, idx) => {
          const passes = pairs.every(({ range, criterion }) => {
            const cell = String(range[idx] ?? '')
            const wanted = criterion.slice(2) // strip "<>"
            return wanted === '' ? cell !== '' : cell !== wanted
          })
          return passes ? s + numeric(v) : s
        }, 0)
      )
    }
    if (term === '0') return total
    throw new Error(`unsupported term: ${term}`)
  }, 0)
}
