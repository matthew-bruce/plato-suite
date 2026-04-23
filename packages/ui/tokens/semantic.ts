export const RISK_COLOURS = {
  HIGH:   '#DA202A',  // --rmg-color-red
  MEDIUM: '#F3920D',  // --rmg-color-orange
  LOW:    '#008A00',  // --rmg-color-green-contrast
  SCOPED: '#404044',  // --rmg-color-dark-grey
} as const

export const RISK_TINTS = {
  HIGH:   '#F8E7E7',  // --rmg-color-tint-red
  MEDIUM: '#FFBD80',  // --rmg-color-tint-orange
  LOW:    '#C1E3C1',  // --rmg-color-tint-green
  SCOPED: '#EEEEEE',  // --rmg-color-grey-3
} as const

export const TRACK_COLOURS = {
  A: '#DA202A',  // CG Extraction — = --rmg-color-red
  B: '#0892CB',  // TCS Onboarding — = --rmg-color-blue
} as const

export const STREAM_COLOURS = {
  BUILD:   '#F3920D',  // --rmg-color-orange
  SERVICE: '#F4AEBA',  // --rmg-color-pink
} as const

export const STATUS_COLOURS = {
  SCHEDULED:   '#8F9495',  // --rmg-color-grey-1
  COMPLETED:   '#62A531',  // --rmg-color-green
  CANCELLED:   '#B70D12',  // --rmg-color-warm-red
  IN_PROGRESS: '#0892CB',  // --rmg-color-blue
} as const

export const PHASE_COLOURS = {
  CG_PRIME:      '#003C82',
  TCS_PRIME:     '#9B0A6E',
  TCS_HYPERCARE: '#5B2D9A',
} as const

export type RiskLevel = keyof typeof RISK_COLOURS
export type TrackId   = keyof typeof TRACK_COLOURS
export type StreamId  = keyof typeof STREAM_COLOURS
export type StatusId  = keyof typeof STATUS_COLOURS
export type PhaseId   = keyof typeof PHASE_COLOURS
