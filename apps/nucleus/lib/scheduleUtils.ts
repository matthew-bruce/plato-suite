/**
 * Returns the capacity_split for the filtered team.
 * Returns 1.0 when no filter is active or the resource has no
 * matching assignment (treat as fully attributed to this view).
 */
export function getCapacitySplit(
  teams: Array<{ teamId: string; teamName: string; capacitySplit: number }>,
  activeTeam: string | null,
): number {
  if (!activeTeam || activeTeam === 'all' || activeTeam === 'All') return 1.0
  const match = teams.find(
    (t) => t.teamName === activeTeam || t.teamId === activeTeam,
  )
  return match?.capacitySplit ?? 1.0
}
