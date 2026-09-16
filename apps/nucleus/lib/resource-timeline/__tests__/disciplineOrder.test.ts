// Skillset grouping order on the Resource Timeline.
//
// The timeline grouped Skillsets alphabetically, ignoring disciplines.sort_order
// — a deliberate taxonomy sequence gapped by 10s (engineering, then
// architecture and security, then QA, product, delivery, commercial, data).
// The query never selected the column, so there was nothing to order by even
// if the sort had wanted it: the same defect as display_order going unread by
// the schedule exports, in a different file.
//
// Imported by resolved path rather than the '@plato/schema' specifier, which
// vi cannot resolve for a workspace-symlinked package.
import { describe, it, expect } from 'vitest'
import { orderDisciplines } from '../../../../../packages/schema/src/queries/resourceTimeline'

/** A resource carrying only the two fields the ordering reads. */
function res(discipline: string | null, disciplineSortOrder: number | null) {
  return { discipline, disciplineSortOrder }
}

/* The real taxonomy, deliberately shuffled on the way in. Its sort_order and
   its alphabetical order disagree on every adjacent pair, so an alphabetical
   implementation cannot pass by coincidence. */
const REAL = [
  res('Quality Assurance', 100),
  res('Backend Engineering', 10),
  res('AI / ML Engineering', 270),
  res('Architecture', 80),
  res('Frontend Engineering', 20),
  res('Agile Coaching', 260),
]

describe('orderDisciplines', () => {
  it('orders by sort_order, not by name', () => {
    expect(orderDisciplines(REAL)).toEqual([
      'Backend Engineering',
      'Frontend Engineering',
      'Architecture',
      'Quality Assurance',
      'Agile Coaching',
      'AI / ML Engineering',
    ])
  })

  it('is not the alphabetical order, nor the order it was given', () => {
    // Guards the guard: if the fixture agreed with either, the test above
    // would pass without the sort doing anything.
    const result = orderDisciplines(REAL)
    expect(result).not.toEqual([...result].sort())
    expect(result).not.toEqual(REAL.map((r) => r.discipline))
  })

  it('puts "Unassigned discipline" last, not under U', () => {
    const withGap = [...REAL, res(null, null)]
    const result = orderDisciplines(withGap)
    expect(result[result.length - 1]).toBe('Unassigned discipline')
  })

  it('sorts a discipline with no sort_order after every ordered one', () => {
    const result = orderDisciplines([res('Backend Engineering', 10), res('Brand New Thing', null)])
    expect(result).toEqual(['Backend Engineering', 'Brand New Thing'])
  })

  it('falls back to name between two sharing a sort_order', () => {
    const result = orderDisciplines([res('Zeta', 10), res('Alpha', 10)])
    expect(result).toEqual(['Alpha', 'Zeta'])
  })

  it('lists each discipline once however many people hold it', () => {
    const result = orderDisciplines([
      res('Backend Engineering', 10),
      res('Backend Engineering', 10),
      res('Frontend Engineering', 20),
    ])
    expect(result).toEqual(['Backend Engineering', 'Frontend Engineering'])
  })

  it('returns nothing for no resources', () => {
    expect(orderDisciplines([])).toEqual([])
  })
})
