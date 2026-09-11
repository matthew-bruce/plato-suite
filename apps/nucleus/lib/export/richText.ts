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

import { contrastRatio } from '../schedule/ui'

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

/* ── Brand colour on a filled band ────────────────────────────────── */

export const WHITE_ARGB = 'FFFFFFFF'
/** The dark ink used where white text would not survive on a brand colour. */
export const DARK_INK_ARGB = 'FF2A2A2D'

/**
 * WCAG AA for body text. The masthead is a solid brand-coloured band with the
 * supplier's name on it, and that name has to be readable, so it is held to
 * the normal-text threshold rather than the large-text 3:1.
 */
export const BAND_TEXT_MIN_CONTRAST = 4.5

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace('#', '')
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.length === 8
        ? clean.slice(2)
        : clean
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const ch = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  return `#${ch(r)}${ch(g)}${ch(b)}`
}

/** sRGB → HSL, all components 0..1 except hue in 0..360. */
export function rgbToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const { r, g, b } = rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return { h, s, l }
}

/** HSL → hex, the inverse of rgbToHsl. */
export function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) return rgbToHex(l, l, l)
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number): number => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const hk = h / 360
  return rgbToHex(channel(hk + 1 / 3), channel(hk), channel(hk - 1 / 3))
}

/**
 * A supplier's brand colour, darkened only as far as it must be for white
 * text to sit on it legibly — the masthead fill.
 *
 * Hue and saturation are preserved exactly; only lightness comes down, in
 * small steps, until white clears BAND_TEXT_MIN_CONTRAST. A brand colour that
 * already passes is returned untouched, so most suppliers get their true
 * colour and only the pale ones are adjusted.
 *
 * This is a computed rule rather than a per-supplier lookup on purpose: a
 * supplier added later with a pale brand colour is handled automatically, and
 * a supplier who changes theirs needs no code change. There is no list of
 * "the ones that need darkening" anywhere, because such a list is exactly the
 * thing that goes stale.
 *
 * The true, undarkened colour is still used elsewhere on the sheet (the
 * divider band and the Excel tab colour), so the authentic brand colour always
 * appears somewhere even when the masthead had to be adjusted.
 */
export function darkenForWhiteText(
  brandHex: string,
  minContrast = BAND_TEXT_MIN_CONTRAST,
): string {
  const hsl = rgbToHsl(brandHex)
  if (!hsl) return '#2A2A2D'
  // Already legible: hand back the brand colour exactly as supplied.
  if (contrastRatio(WHITE_ARGB, brandHex) >= minContrast) {
    return `#${toArgb(brandHex).slice(2)}`
  }
  const { h, s } = hsl
  // 1% steps: fine enough that the result is never darker than it needs to be,
  // coarse enough to terminate quickly. Walks all the way to black if a hue
  // somehow never passes, which cannot happen — white on black is 21:1.
  for (let l = hsl.l; l >= 0; l -= 0.01) {
    const candidate = hslToHex(h, s, Math.max(0, l))
    if (contrastRatio(WHITE_ARGB, candidate) >= minContrast) return candidate
  }
  return '#000000'
}

/**
 * White or dark ink, whichever is more readable on the given fill — used for
 * the divider band, which always carries the TRUE brand colour and so may be
 * pale enough that white text would disappear.
 */
export function textOnBand(fillHex: string): string {
  return contrastRatio(WHITE_ARGB, fillHex) >= contrastRatio(DARK_INK_ARGB, fillHex)
    ? WHITE_ARGB
    : DARK_INK_ARGB
}

/**
 * The secondary voice on a band: the ink colour blended toward the fill as far
 * as it can go while still clearing `minContrast`, so it reads as quieter than
 * the primary text without becoming unreadable.
 *
 * This exists because a fixed muted grey does not survive a change of ground.
 * The masthead's eyebrow, date range and exported-at line were previously a
 * literal #8F9495, chosen against the near-black default band, where it sits at
 * about 4.4:1. Against a saturated brand fill the same grey collapses — 1.6:1
 * on Royal Mail red, 1.5:1 on Hexaware amber — and the lines read as washed
 * out. Property-level assertions never caught it because every one of those
 * cells had exactly the colour it was told to have; only looking at the
 * rendered sheet showed the problem.
 *
 * Deriving it from the fill fixes that for every band at once, including bands
 * that do not exist yet. On a band with headroom the result is a genuinely
 * muted tone; on a band where the primary ink only just clears the threshold
 * itself there is nothing to spend, and this degrades to the full ink colour —
 * no contrast, no muting, which is the right way round to fail.
 *
 * On the default dark band it lands within a shade of the old literal grey, so
 * the files that were already correct look unchanged.
 */
export function mutedOnBand(
  fillHex: string,
  inkArgb: string,
  minContrast = BAND_TEXT_MIN_CONTRAST,
): string {
  const fill = hexToRgb(fillHex)
  const ink = hexToRgb(inkArgb)
  if (!fill || !ink) return toArgb(inkArgb)
  let best = toArgb(inkArgb)
  // Walk from the ink toward the fill in 5% steps, keeping the last candidate
  // that still clears the threshold. Stops at 0.8 rather than 1.0: past that
  // the text is nearly the ground colour, which no contrast rule would permit
  // anyway.
  for (let t = 0.05; t <= 0.8; t += 0.05) {
    const candidate = rgbToHex(
      ink.r + (fill.r - ink.r) * t,
      ink.g + (fill.g - ink.g) * t,
      ink.b + (fill.b - ink.b) * t,
    )
    if (contrastRatio(candidate, fillHex) < minContrast) break
    best = toArgb(candidate)
  }
  return best
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
