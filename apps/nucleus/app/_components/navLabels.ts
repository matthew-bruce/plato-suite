// Labels for the left-hand nav items that link to a real route. The single
// source for both the nav (NucleusAppShell) and each route's browser tab
// title. Kept in a plain module, not in NucleusAppShell itself: that file is
// 'use client', and a server page or layout importing a value from it would
// receive a client reference rather than the string.
export const NAV_LABELS = {
  dashboard: 'Dashboard',
  resources: 'Resources',
  platformSchedule: 'Platform Schedule',
  resourceTimeline: 'Resource Timeline',
  blendedRates: 'Blended Rates',
  components: 'Components',
} as const
