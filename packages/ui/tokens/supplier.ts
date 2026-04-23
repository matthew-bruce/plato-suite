export interface SupplierColourMap {
  [abbreviation: string]: string
}

/**
 * Fallback colours — match DB values as of April 2026.
 * NEVER use directly in production UI — always prefer DB-loaded values.
 * Always query: SELECT supplier_abbreviation, supplier_colour FROM suppliers ORDER BY sort_order
 */
export const SUPPLIER_COLOUR_FALLBACKS: SupplierColourMap = {
  CG:   '#003C82',
  TCS:  '#9B0A6E',
  RMG:  '#E2001A',
  HT:   '#FF8C00',
  NH:   '#1A2B5B',
  EPAM: '#3D3D3D',
  TAAS: '#7C3AED',
  LT:   '#3ABFB8',
  HCL:  '#1976F2',
}

export function getSupplierColour(
  abbreviation: string,
  loadedMap?: SupplierColourMap
): string {
  if (loadedMap?.[abbreviation]) return loadedMap[abbreviation]
  return SUPPLIER_COLOUR_FALLBACKS[abbreviation] ?? '#8F9495'
}

export function buildSupplierMap(
  rows: { supplier_abbreviation: string; supplier_colour: string }[]
): SupplierColourMap {
  return Object.fromEntries(
    rows.map(r => [r.supplier_abbreviation, r.supplier_colour])
  )
}
