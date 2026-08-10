import { describe, it, expect } from 'vitest'
import { filterDirectoryResources, NO_TEAM_SENTINEL, type FilterableResource, type DirectoryFilterCriteria } from '@plato/schema'

const AMOL: FilterableResource = {
  resource_name: 'Amol Tate',
  resource_function: 'FACTORY',
  resource_location: 'onshore',
  resource_job_title: 'QA / Test Lead',
  supplier_abbreviation: 'CG',
  teams: [],
}
const SARAH: FilterableResource = {
  resource_name: 'Sarah Ashton',
  resource_function: 'SERVICE',
  resource_location: 'onshore',
  resource_job_title: 'Delivery Lead',
  supplier_abbreviation: 'RMG',
  teams: ['DST'],
}
const MACIEJ: FilterableResource = {
  resource_name: 'Maciej Cieslak',
  resource_function: 'CLOUD_OPS',
  resource_location: 'nearshore',
  resource_job_title: 'Azure Solution Architect',
  supplier_abbreviation: 'EPAM',
  teams: ['Nebula', 'Pulsar'],
}
const ANUPAMA: FilterableResource = {
  resource_name: 'Anupama Rs',
  resource_function: 'FACTORY',
  resource_location: 'offshore',
  resource_job_title: 'Drupal Engineer',
  supplier_abbreviation: 'CG',
  teams: ['Cygnus'],
}
// Name and role deliberately contain no "Hel" substring — only the team name
// does, so this is the case that proves search matches via team alone.
const DEEPAK: FilterableResource = {
  resource_name: 'Deepak Rao',
  resource_function: 'SERVICE',
  resource_location: 'offshore',
  resource_job_title: 'Backend Engineer',
  supplier_abbreviation: 'HCL',
  teams: ['Helion'],
}

const ALL = [AMOL, SARAH, MACIEJ, ANUPAMA, DEEPAK]

const BASE: DirectoryFilterCriteria = { search: '', functions: [], teams: [], suppliers: [], locations: [] }

function names(list: FilterableResource[]): string[] {
  return list.map((r) => r.resource_name)
}

describe('filterDirectoryResources', () => {
  it('returns everyone under no filters — including a resource with no team', () => {
    expect(names(filterDirectoryResources(ALL, BASE))).toEqual([
      'Amol Tate',
      'Sarah Ashton',
      'Maciej Cieslak',
      'Anupama Rs',
      'Deepak Rao',
    ])
  })

  it('filters by name substring, case-insensitively', () => {
    expect(names(filterDirectoryResources(ALL, { ...BASE, search: 'sarah' }))).toEqual(['Sarah Ashton'])
  })

  it('keeps a no-team resource under a Function-only filter', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, functions: ['FACTORY'] })
    expect(names(result)).toEqual(['Amol Tate', 'Anupama Rs'])
  })

  it('keeps a no-team resource under search with no other filters', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, search: 'amol' })
    expect(names(result)).toEqual(['Amol Tate'])
  })

  it('excludes a no-team resource only once a Team filter is actively applied', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, teams: ['DST'] })
    expect(names(result)).toEqual(['Sarah Ashton'])
  })

  it('ORs multiple Team selections — matches a resource on ANY selected team', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, teams: ['DST', 'Pulsar'] })
    expect(names(result)).toEqual(['Sarah Ashton', 'Maciej Cieslak'])
  })

  it('ANDs Function and Team filters together', () => {
    // Maciej is CLOUD_OPS on Pulsar; Sarah is SERVICE on DST. Asking for
    // SERVICE + Pulsar should match neither.
    const result = filterDirectoryResources(ALL, { ...BASE, functions: ['SERVICE'], teams: ['Pulsar'] })
    expect(names(result)).toEqual([])
  })

  it('matches when Function AND Team are both satisfied by the same resource', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, functions: ['CLOUD_OPS'], teams: ['Nebula'] })
    expect(names(result)).toEqual(['Maciej Cieslak'])
  })

  it('Factory (Function) + Cygnus (Team) active simultaneously narrows to the resource satisfying both', () => {
    // Amol is FACTORY but has no team — excluded once Team is active.
    // Anupama is FACTORY on Cygnus — the only one satisfying both groups.
    const result = filterDirectoryResources(ALL, { ...BASE, functions: ['FACTORY'], teams: ['Cygnus'] })
    expect(names(result)).toEqual(['Anupama Rs'])
  })

  it('search matches on role/job title, not just name', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, search: 'delivery' })
    expect(names(result)).toEqual(['Sarah Ashton'])
  })

  it('search matches on location', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, search: 'nearshore' })
    expect(names(result)).toEqual(['Maciej Cieslak'])
  })

  it('search matches via team name alone, with no name/role hit', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, search: 'Hel' })
    expect(names(result)).toEqual(['Deepak Rao'])
  })

  it('search is case-insensitive when matching a team name', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, search: 'HELION' })
    expect(names(result)).toEqual(['Deepak Rao'])
  })

  it('filters by a single Supplier selection', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, suppliers: ['CG'] })
    expect(names(result)).toEqual(['Amol Tate', 'Anupama Rs'])
  })

  it('ORs multiple Supplier selections', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, suppliers: ['CG', 'HCL'] })
    expect(names(result)).toEqual(['Amol Tate', 'Anupama Rs', 'Deepak Rao'])
  })

  it('ANDs Supplier with Function — CG suppliers who are SERVICE is nobody', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, suppliers: ['CG'], functions: ['SERVICE'] })
    expect(names(result)).toEqual([])
  })

  it('filters by a single Location selection', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, locations: ['onshore'] })
    expect(names(result)).toEqual(['Amol Tate', 'Sarah Ashton'])
  })

  it('ORs multiple Location selections', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, locations: ['onshore', 'nearshore'] })
    expect(names(result)).toEqual(['Amol Tate', 'Sarah Ashton', 'Maciej Cieslak'])
  })

  it('NO_TEAM_SENTINEL selects only resources with zero team assignments', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, teams: [NO_TEAM_SENTINEL] })
    expect(names(result)).toEqual(['Amol Tate'])
  })

  it('NO_TEAM_SENTINEL ORs together with a real team selection', () => {
    const result = filterDirectoryResources(ALL, { ...BASE, teams: ['Cygnus', NO_TEAM_SENTINEL] })
    expect(names(result)).toEqual(['Amol Tate', 'Anupama Rs'])
  })
})
