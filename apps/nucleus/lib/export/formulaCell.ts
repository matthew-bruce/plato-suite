// The one place an Excel formula string becomes an ExcelJS cell value.
//
// ExcelJS's `{ formula: string }` shape expects the formula WITHOUT its own
// leading "=" — ExcelJS adds that itself when it serialises the cell's <f>
// element. Every formula in this export was instead written directly as
// `{ formula: `=${expr}` }`, at every one of the ~28 call sites across
// route.ts and rawDataTotalsTable.ts, so every <f> element in the generated
// file held the literal text "=<formula>" — a doubled, invalid leading "="
// — and carried no cached <v> value alongside it, since ExcelJS never
// evaluates what it writes.
//
// This predates the Platform Schedule export entirely: it is the same
// formula-writing code, used identically by both variants, and both were
// affected equally. It went uncaught because nothing had inspected a
// formula cell's raw XML content before — the export's other openpyxl
// round-trip (richText.test.ts) only checked that the file loads and that
// one rich-text cell's VALUE was non-null, not any formula's stored text.
//
// formulaCell() is the fix and the guard against it recurring: it accepts an
// expression with or without its own leading "=" (stripping one if present)
// and returns the correctly-shaped ExcelJS value, so passing an
// already-prefixed string can never again produce a doubled "==". Every
// formula-writing call site in the export goes through this one function —
// there is no second, parallel way to write a formula cell.

export interface FormulaCellValue {
  formula: string
}

export function formulaCell(expression: string): FormulaCellValue {
  return { formula: expression.startsWith('=') ? expression.slice(1) : expression }
}
