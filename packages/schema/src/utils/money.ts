// The one money rule for the suite (see docs/decisions/036-money-rounding.md):
// per-row integer pence, half-up, VAT via an integer rate in thousandths of a
// percent; round only at display.
//
// Everything below is integer (BigInt) arithmetic. No float multiplier ever
// touches a money figure: `1 + 7.082 / 100` is 1.0708199999999999 in IEEE
// double, which silently rounded every row sitting exactly on a half-penny of
// VAT down instead of up.

/** A VAT rate as an integer in thousandths of a percent: 7.082% → 7082. */
export type VatRateMilliPct = number

// BigInt() rather than `100n` literals: the Next.js app compiles this package
// at an ES2017 target, which has no BigInt literal syntax.
const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
/** 100 (percent) × 1,000 (thousandths): the VAT rate's denominator. */
const VAT_DENOMINATOR = BigInt(100_000)
/** capacity_days and utilisation_percent each held at 2 dp, and utilisation is a percent. */
const BASE_DENOMINATOR = BigInt(1_000_000)

interface ParsedDecimal {
  negative: boolean
  intPart: string
  fracPart: string
}

function parseDecimal(value: number | string, label: string): ParsedDecimal {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${label}: ${value} is not a finite number`)
  }
  // String(number) is the shortest round-trip form (64.5 → "64.5"), so a
  // value that came from a decimal column comes back as that decimal.
  const text = typeof value === 'number' ? String(value) : value.trim()
  const match = /^([+-])?(\d+)(?:\.(\d*))?$/.exec(text)
  if (!match) throw new Error(`${label}: "${text}" is not a plain decimal number`)
  return { negative: match[1] === '-', intPart: match[2]!, fracPart: match[3] ?? '' }
}

/** The value × 10^scale, exactly — throws rather than drop a significant digit. */
function toScaledExact(value: number | string, scale: number, label: string): bigint {
  const { negative, intPart, fracPart } = parseDecimal(value, label)
  const significant = fracPart.replace(/0+$/, '')
  if (significant.length > scale) {
    throw new Error(`${label}: ${value} cannot be represented exactly to ${scale} decimal places`)
  }
  const scaled = BigInt(intPart + significant.padEnd(scale, '0'))
  return negative ? -scaled : scaled
}

/**
 * The value × 10^scale, rounded half away from zero at `scale` places — the
 * precision its column stores (numeric(·,2) for days and utilisation), so an
 * in-flight value like a float-summed 64.30000000000001 is costed exactly as
 * the 64.30 the database will hold.
 */
function toScaledRounded(value: number | string, scale: number, label: string): bigint {
  const { negative, intPart, fracPart } = parseDecimal(value, label)
  let scaled = BigInt(intPart + fracPart.slice(0, scale).padEnd(scale, '0'))
  if (fracPart.charAt(scale) >= '5') scaled += ONE
  return negative ? -scaled : scaled
}

/** numerator ÷ denominator, rounded half away from zero (half-up for ≥ 0). */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  const absRemainder = remainder < ZERO ? -remainder : remainder
  if (TWO * absRemainder < denominator) return quotient
  return numerator < ZERO ? quotient - ONE : quotient + ONE
}

/**
 * The stored VAT uplift (e.g. 7.082, or the numeric string "7.08200") as an
 * integer in thousandths of a percent, parsed from its decimal digits — never
 * via float multiplication. Throws if the rate has a significant fourth
 * decimal place, which this unit cannot hold exactly.
 */
export function vatRateMilliPct(vatUpliftPercent: number | string): VatRateMilliPct {
  return Number(toScaledExact(vatUpliftPercent, 3, 'VAT rate'))
}

/**
 * VAT on an integer-pence base: round_half_up(base × rate / 100,000).
 * 0 when VAT does not apply.
 */
export function computeVatPence(
  basePence: number,
  vatApplies: boolean,
  rateMilliPct: VatRateMilliPct,
): number {
  if (!vatApplies) return 0
  return Number(divRoundHalfUp(BigInt(basePence) * BigInt(rateMilliPct), VAT_DENOMINATOR))
}

export interface RowMoneyInput {
  capacityDays: number | string | null
  /** Integer pence per day. */
  dayRatePence: number
  /** 100 = full time. Scales the cost, never the rate. */
  utilisationPercent: number | string
  vatApplies: boolean
  vatRateMilliPct: VatRateMilliPct
}

export interface RowMoneyPence {
  basePence: number
  vatPence: number
  incVatPence: number
}

/**
 * One allocation row's money, in whole pence:
 *   base = round_half_up(day rate × days × utilisation / 100)
 *   VAT  = round_half_up(base × rate / 100,000), or 0 when VAT doesn't apply
 * Totals are sums of these; nothing is rounded again except for display.
 */
export function computeRowMoneyPence(input: RowMoneyInput): RowMoneyPence {
  const days = toScaledRounded(input.capacityDays ?? 0, 2, 'capacity_days') // × 100
  const utilisation = toScaledRounded(input.utilisationPercent, 2, 'utilisation_percent') // × 100
  // day rate × (days×100) × (util%×100) / (100 days-scale × 100 util-scale × 100 for %)
  const basePence = Number(
    divRoundHalfUp(BigInt(input.dayRatePence) * days * utilisation, BASE_DENOMINATOR),
  )
  const vatPence = computeVatPence(basePence, input.vatApplies, input.vatRateMilliPct)
  return { basePence, vatPence, incVatPence: basePence + vatPence }
}
