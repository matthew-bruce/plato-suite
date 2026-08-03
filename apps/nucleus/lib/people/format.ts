// Pure display helpers for the People Directory.

const FUNCTION_LABELS: Record<string, string> = {
  FACTORY: 'Factory',
  SERVICE: 'Service',
  MIGRATION: 'Migration',
  CLOUD_OPS: 'Cloud Ops',
  PROGRAMME: 'Programme',
  COMMERCIAL: 'Commercial',
}

// Filter-pill / subtext order — deliberately not the DB enum's declaration order.
export const FUNCTION_FILTER_ORDER = ['FACTORY', 'SERVICE', 'MIGRATION', 'CLOUD_OPS', 'PROGRAMME', 'COMMERCIAL']

export function humanizeFunction(fn: string | null): string | null {
  if (!fn) return null
  return FUNCTION_LABELS[fn] ?? fn
}

export function sentenceCaseLocation(location: string | null): string | null {
  if (!location) return null
  return location.charAt(0).toUpperCase() + location.slice(1)
}

export function getPersonInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
