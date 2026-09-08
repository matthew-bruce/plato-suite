import { describe, expect, it } from 'vitest'
import { suggestDiscipline, tokenise } from '../disciplineMatch'
import type { DisciplineOption } from '../disciplineMatch'

// The real discipline list (public.disciplines), so the IDF weighting under
// test is calibrated against the same names it will see in production.
const DISCIPLINES: DisciplineOption[] = [
  'Agile Coaching',
  'AI / ML Engineering',
  'Analysis',
  'Architecture',
  'Backend Engineering',
  'Commercial Management',
  'Cyber Security',
  'Data & Analytics',
  'Data Engineering',
  'Data Science',
  'Delivery Management',
  'Developer Experience',
  'Frontend Engineering',
  'Full Stack Engineering',
  'Governance & Compliance',
  'Mobile Engineering',
  'Platform & DevOps',
  'Product Discovery',
  'Product Management',
  'Product Strategy',
  'Programme & Project Management',
  'Quality Assurance',
  'Scrum Master',
  'Service Management',
  'Site Reliability Engineering',
  'Supplier Management',
  'UX & Design',
].map((name, i) => ({ discipline_id: `d${i}`, discipline_name: name }))

const suggest = (role: string) => suggestDiscipline(role, DISCIPLINES)?.disciplineName ?? null

describe('tokenise', () => {
  it('splits on punctuation and lowercases', () => {
    expect(tokenise('Engineer - Platform / DevOps')).toContain('platform')
  })

  it('emits joined adjacent pairs so "Front End" can match "Frontend"', () => {
    expect(tokenise('Front End Engineer')).toContain('frontend')
  })

  it('expands & into a word so it can be dropped as a stopword', () => {
    const t = tokenise('Data & Analytics')
    expect(t.has('and')).toBe(false)
    expect(t).toContain('data')
  })

  it('stems -ing so Engineering matches Engineer', () => {
    expect(tokenise('Engineering').has([...tokenise('Engineer')][0])).toBe(true)
  })

  it('drops seniority words that carry no discipline signal', () => {
    const t = tokenise('Senior Lead Principal')
    expect(t.size).toBe(0)
  })
})

describe('suggestDiscipline — the cases from the brief', () => {
  it('"Engineer - Platform / DevOps" suggests Platform & DevOps', () => {
    expect(suggest('Engineer - Platform / DevOps')).toBe('Platform & DevOps')
  })

  it('"Front End (React) Engineer" suggests Frontend Engineering', () => {
    expect(suggest('Front End (React) Engineer')).toBe('Frontend Engineering')
  })
})

describe('suggestDiscipline — other realistic role titles', () => {
  it.each([
    ['Backend Engineer', 'Backend Engineering'],
    ['Senior Backend Engineer', 'Backend Engineering'],
    ['Data Engineer', 'Data Engineering'],
    ['Data Scientist', 'Data Science'],
    ['Mobile Engineer (iOS)', 'Mobile Engineering'],
    ['Cyber Security Analyst', 'Cyber Security'],
    ['Solution Architect', 'Architecture'],
    ['Scrum Master', 'Scrum Master'],
    ['Agile Coach', 'Agile Coaching'],
    ['Site Reliability Engineer', 'Site Reliability Engineering'],
    ['Full Stack Developer', 'Full Stack Engineering'],
    ['UX Designer', 'UX & Design'],
    ['Delivery Manager', 'Delivery Management'],
    ['Supplier Manager', 'Supplier Management'],
    ['QA Tester — Quality Assurance', 'Quality Assurance'],
  ])('%s → %s', (role, expected) => {
    expect(suggest(role)).toBe(expected)
  })
})

describe('suggestDiscipline — refuses to guess badly', () => {
  it('returns null for an empty or missing role title', () => {
    expect(suggestDiscipline('', DISCIPLINES)).toBeNull()
    expect(suggestDiscipline(null, DISCIPLINES)).toBeNull()
    expect(suggestDiscipline(undefined, DISCIPLINES)).toBeNull()
  })

  it('returns null when there are no disciplines to match against', () => {
    expect(suggestDiscipline('Backend Engineer', [])).toBeNull()
  })

  it('returns null for a role title of pure seniority noise', () => {
    expect(suggest('Senior Lead')).toBeNull()
  })

  it('returns null for a role title with no relationship to any discipline', () => {
    expect(suggest('Chief Happiness Sandwich')).toBeNull()
  })

  it('does not let a generic word alone carry a suggestion', () => {
    // "Engineer" matches seven "… Engineering" names equally — no basis to pick.
    expect(suggest('Engineer')).toBeNull()
  })

  it('returns null rather than picking arbitrarily between exact ties', () => {
    const tied: DisciplineOption[] = [
      { discipline_id: 'a', discipline_name: 'Widget Engineering' },
      { discipline_id: 'b', discipline_name: 'Widget Engineering' },
    ]
    expect(suggestDiscipline('Widget Engineer', tied)).toBeNull()
  })
})

describe('suggestDiscipline — result shape', () => {
  it('returns the id alongside the name so the caller can pre-select it', () => {
    const m = suggestDiscipline('Engineer - Platform / DevOps', DISCIPLINES)
    expect(m).not.toBeNull()
    expect(m!.disciplineId).toBe(
      DISCIPLINES.find((d) => d.discipline_name === 'Platform & DevOps')!.discipline_id,
    )
    expect(m!.score).toBeGreaterThan(0)
    expect(m!.coverage).toBeGreaterThan(0)
    expect(m!.coverage).toBeLessThanOrEqual(1)
  })

  it('is case and punctuation insensitive', () => {
    expect(suggest('platform/devops engineer')).toBe('Platform & DevOps')
    expect(suggest('PLATFORM DEVOPS')).toBe('Platform & DevOps')
  })
})
