// Shared copy for the Domain Readiness chips — used by the chip legend
// popover and as each chip's hover title, so the wording only lives once.

export type ChipKey = 'people' | 'sessions' | 'schedule' | 'kt' | 'demo' | 'docs' | 'signoff'

export const CHIP_LEGEND: Array<{ key: ChipKey; label: string; description: string }> = [
  { key: 'people', label: 'People', description: 'A Capgemini facilitator and a TCS recipient have been identified for the linked session(s).' },
  { key: 'sessions', label: 'Sessions', description: 'The right sessions (a working KT session and a playback session) have been scheduled for this domain.' },
  { key: 'schedule', label: 'Schedule', description: 'Those sessions have a confirmed date.' },
  { key: 'kt', label: 'Outcomes', description: 'The sessions have actually taken place and been scored.' },
  { key: 'demo', label: 'Demo', description: 'The playback session(s) for this domain have been completed.' },
  { key: 'docs', label: 'Docs', description: 'Documentation status, set manually.' },
  { key: 'signoff', label: 'Sign-off', description: 'SME sign-off status, set manually.' },
]

export const CHIP_DESCRIPTIONS: Record<ChipKey, string> = Object.fromEntries(
  CHIP_LEGEND.map((c) => [c.key, c.description]),
) as Record<ChipKey, string>
