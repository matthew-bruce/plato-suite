import { describe, it, expect } from 'vitest'
import { filterDirectoryResources, type FilterableResource } from '@plato/schema'

const AMOL: FilterableResource = { resource_name: 'Amol Tate', resource_function: 'FACTORY', teams: [] }
const SARAH: FilterableResource = { resource_name: 'Sarah Ashton', resource_function: 'SERVICE', teams: ['DST'] }
const MACIEJ: FilterableResource = {
  resource_name: 'Maciej Cieslak',
  resource_function: 'CLOUD_OPS',
  teams: ['Nebula', 'Pulsar'],
}

const ALL = [AMOL, SARAH, MACIEJ]

function names(list: FilterableResource[]): string[] {
  return list.map((r) => r.resource_name)
}

describe('filterDirectoryResources', () => {
  it('returns everyone under no filters — including a resource with no team', () => {
    expect(names(filterDirectoryResources(ALL, { search: '', functions: [], teams: [] }))).toEqual([
      'Amol Tate',
      'Sarah Ashton',
      'Maciej Cieslak',
    ])
  })

  it('filters by name substring, case-insensitively', () => {
    expect(names(filterDirectoryResources(ALL, { search: 'sarah', functions: [], teams: [] }))).toEqual([
      'Sarah Ashton',
    ])
  })

  it('keeps a no-team resource under a Function-only filter', () => {
    const result = filterDirectoryResources(ALL, { search: '', functions: ['FACTORY'], teams: [] })
    expect(names(result)).toEqual(['Amol Tate'])
  })

  it('keeps a no-team resource under search with no other filters', () => {
    const result = filterDirectoryResources(ALL, { search: 'amol', functions: [], teams: [] })
    expect(names(result)).toEqual(['Amol Tate'])
  })

  it('excludes a no-team resource only once a Team filter is actively applied', () => {
    const result = filterDirectoryResources(ALL, { search: '', functions: [], teams: ['DST'] })
    expect(names(result)).toEqual(['Sarah Ashton'])
  })

  it('ORs multiple Team selections — matches a resource on ANY selected team', () => {
    const result = filterDirectoryResources(ALL, { search: '', functions: [], teams: ['DST', 'Pulsar'] })
    expect(names(result)).toEqual(['Sarah Ashton', 'Maciej Cieslak'])
  })

  it('ANDs Function and Team filters together', () => {
    // Maciej is CLOUD_OPS on Pulsar; Sarah is SERVICE on DST. Asking for
    // SERVICE + Pulsar should match neither.
    const result = filterDirectoryResources(ALL, { search: '', functions: ['SERVICE'], teams: ['Pulsar'] })
    expect(names(result)).toEqual([])
  })

  it('matches when Function AND Team are both satisfied by the same resource', () => {
    const result = filterDirectoryResources(ALL, { search: '', functions: ['CLOUD_OPS'], teams: ['Nebula'] })
    expect(names(result)).toEqual(['Maciej Cieslak'])
  })
})
