// Colour handling for the exported workbook's rich-text runs — a coloured
// square plus a label inside a single cell, used for each supplier's name in
// the Summary tab's Supplier & Location breakdown and each row's label in
// its Planview Code Split.
//
// ExcelJS writes a rich-text run's colour as an 8-digit AARRGGBB hex string.
// The function that builds these runs used to produce that string by
// unconditionally prepending "FF" to whatever colour it was given
// ('FF' + colourHex.replace('#', '')). That's correct for a bare 6-digit RGB
// value ("#0D47A1" → "FF0D47A1"), but the Planview Code Split rows pass their
// colour through twice — once for the square, once for the label text — and
// that colour is itself already an 8-digit ARGB literal (e.g. "FF1B5E20").
// Prepending "FF" a second time produced a 10-character value
// ("FFFF1B5E20"), which is invalid OOXML: Excel silently tolerates it, but
// openpyxl and markitdown both refuse to open the file.
//
// toArgb() normalises either shape into a valid 8-digit ARGB instead of
// blindly prepending, so this can't happen regardless of which form the
// caller's colour arrives in — fixed at the one place a colour becomes an
// ARGB string, not by trimming the result afterwards.

/**
 * Normalise a colour into 8-digit AARRGGBB for ExcelJS. Accepts a bare
 * 6-digit RGB value ("#0D47A1" or "0D47A1") or an already-prefixed 8-digit
 * ARGB value ("FF0D47A1") and returns valid 8-digit ARGB either way. Anything
 * else falls back to a neutral grey rather than emitting invalid XML.
 */
export function toArgb(hex: string, fallback = 'FF888888'): string {
  const clean = hex.replace('#', '').toUpperCase()
  if (/^[0-9A-F]{8}$/.test(clean)) return clean
  if (/^[0-9A-F]{6}$/.test(clean)) return `FF${clean}`
  return fallback
}

/**
 * A supplier's brand colour blended 12% into white — the pale ground a
 * supplier's own colour can sit on and stay readable, used for the Rate
 * Calculator's row tints and for the supplier code chip on the Team and
 * Supplier Schedules.
 *
 * Returns opaque white for anything that is not a bare 6-digit hex, which is
 * the safe direction to fail: an unreadable chip beats invalid XML.
 */
export function supplierTint(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 'FFFFFFFF'
  const blend = (start: number): string => {
    const channel = Math.round(parseInt(clean.slice(start, start + 2), 16) * 0.12 + 255 * 0.88)
    return channel.toString(16).padStart(2, '0').toUpperCase()
  }
  return `FF${blend(0)}${blend(2)}${blend(4)}`
}

export interface RichTextValue {
  richText: { text: string; font: { color: { argb: string }; size: number } }[]
}

/**
 * A coloured square + label in one cell. Both colour inputs go through
 * toArgb(), so neither can produce a malformed value regardless of whether
 * the caller's colour is a bare "#RRGGBB" or an already-prefixed 8-digit
 * ARGB literal.
 */
export function squareRich(
  colourHex: string,
  text: string,
  textArgb: string,
  size = 11,
): RichTextValue {
  return {
    richText: [
      { text: '■ ', font: { color: { argb: toArgb(colourHex) }, size } },
      { text, font: { color: { argb: toArgb(textArgb) }, size } },
    ],
  }
}
