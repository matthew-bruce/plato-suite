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

// Per-state copy for the chip legend table (one row per chip, one column
// per state) — distinct from CHIP_DESCRIPTIONS above, which is a single
// state-agnostic line used for each chip's hover title.
export const CHIP_STATE_DESCRIPTIONS: Record<ChipKey, { none: string; progress: string; done: string }> = {
  people: {
    none: 'No linked session has yet had both a Capgemini person and a TCS person recorded against it',
    progress: 'Some linked sessions have both a Capgemini and a TCS person recorded, but not all of them yet',
    done: 'Every linked session has at least one Capgemini person and one TCS person recorded',
  },
  sessions: {
    none: 'No KT sessions have been linked to this domain yet',
    progress: 'This domain has either a working session or a playback session linked, but not both yet',
    done: 'This domain has at least one working session and at least one playback session linked',
  },
  schedule: {
    none: "None of this domain's linked sessions have a date set yet",
    progress: 'Some linked sessions have a date set, but not all of them yet',
    done: 'Every linked session has a date set',
  },
  kt: {
    none: "None of this domain's linked sessions have been completed or scored yet",
    progress: 'Some linked sessions have been completed or scored, but not all of them yet',
    done: 'Every linked session has been completed and/or scored',
  },
  demo: {
    none: 'No playback (demo) session has been linked to this domain yet',
    progress: "A playback session is linked, but it hasn't been completed yet",
    done: 'Every playback session linked to this domain has been completed',
  },
  docs: {
    none: 'Set manually',
    progress: 'Set manually',
    done: 'Set manually',
  },
  signoff: {
    none: 'Set manually',
    progress: 'Set manually',
    done: 'Set manually',
  },
}
