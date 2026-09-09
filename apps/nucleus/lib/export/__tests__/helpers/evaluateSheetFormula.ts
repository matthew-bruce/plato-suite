// A minimal evaluator for the constructs buildPlatformTotalFormula emits, so
// tests can check that a formula string actually reads the cells it should —
// and behaves correctly when the sheet's autofilter hides rows — rather than
// only that it looks right.
//
// Two forms are understood, joined by '+':
//   SUMPRODUCT(SUBTOTAL(109,OFFSET($M$3,ROW($M$3:$M$9)-ROW($M$3),0)),(…)*(…))
//   SUBTOTAL(109,L12:L13)
//
// SUBTOTAL(109) is modelled faithfully in both: a hidden row contributes 0,
// and so does a cell holding text (SUM ignores text), which is what makes the
// idiom safe over a money column carrying em dashes and band-row labels.

export type Grid = Map<string, number | string>

/** Row numbers the sheet's filter has hidden. */
export type HiddenRows = ReadonlySet<number>

interface CellRef {
  column: string
  row: number
}

function parseRef(ref: string): CellRef {
  const clean = ref.replace(/\$/g, '')
  return { column: clean.replace(/\d/g, ''), row: parseInt(clean.replace(/\D/g, ''), 10) }
}

function parseRange(range: string): { column: string; first: number; last: number } {
  const [from, to] = range.split(':')
  const a = parseRef(from)
  const b = parseRef(to)
  return { column: a.column, first: a.row, last: b.row }
}

/** Split on a separator, ignoring separators nested inside parentheses. */
function splitTopLevel(input: string, separator: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const char of input) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === separator && depth === 0) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  out.push(current)
  return out
}

export function evaluateFormula(formula: string, grid: Grid, hidden: HiddenRows = new Set()): number {
  const valueAt = (column: string, row: number): number | string => grid.get(`${column}${row}`) ?? ''

  /** SUBTOTAL(109) over one cell: 0 when hidden, 0 when text, else the value. */
  const visibleNumber = (column: string, row: number): number => {
    if (hidden.has(row)) return 0
    const v = valueAt(column, row)
    return typeof v === 'number' ? v : 0
  }

  const cellsIn = (range: string): (number | string)[] => {
    const { column, first, last } = parseRange(range)
    const out: (number | string)[] = []
    for (let r = first; r <= last; r++) out.push(valueAt(column, r))
    return out
  }

  return splitTopLevel(formula, '+').reduce((total, rawTerm) => {
    const term = rawTerm.trim()

    // SUBTOTAL(109,L12:L13) — a whole block, filter-aware and text-safe.
    const block = term.match(/^SUBTOTAL\(109,(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\)$/)
    if (block) {
      const { column, first, last } = parseRange(block[1])
      let sum = 0
      for (let r = first; r <= last; r++) sum += visibleNumber(column, r)
      return total + sum
    }

    // SUMPRODUCT(SUBTOTAL(109,OFFSET(...)), (crit)*(crit)*(crit))
    const sumproduct = term.match(/^SUMPRODUCT\((.+)\)$/)
    if (sumproduct) {
      const args = splitTopLevel(sumproduct[1], ',')
      const perRow = args[0]
      const criteria = args.slice(1).join(',')

      const offset = perRow.match(
        /^SUBTOTAL\(109,OFFSET\((\$?[A-Z]+\$?\d+),ROW\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\)-ROW\(\$?[A-Z]+\$?\d+\),0\)\)$/,
      )
      if (!offset) throw new Error(`unsupported SUMPRODUCT value term: ${perRow}`)
      const valueCol = parseRef(offset[1]).column
      const { first, last } = parseRange(offset[2])

      // Each criterion is (RANGE<>"literal"); they multiply together.
      const criterionParts = criteria.split('*').map((c) => c.trim())
      const parsed = criterionParts.map((c) => {
        const m = c.match(/^\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)<>"([^"]*)"\)$/)
        if (!m) throw new Error(`unsupported criterion: ${c}`)
        return { range: parseRange(m[1]), wanted: m[2] }
      })

      let sum = 0
      for (let r = first; r <= last; r++) {
        const passes = parsed.every(({ range, wanted }) => String(valueAt(range.column, r) ?? '') !== wanted)
        if (passes) sum += visibleNumber(valueCol, r)
      }
      return total + sum
    }

    // Legacy shapes, still understood so older assertions keep working.
    const plainSum = term.match(/^SUM\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\)$/)
    if (plainSum) {
      return total + cellsIn(plainSum[1]).reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0)
    }

    if (term === '0') return total
    throw new Error(`unsupported term: ${term}`)
  }, 0)
}
