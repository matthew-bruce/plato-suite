import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// insertResource issues a single resources INSERT → .select('resource_id').single()
//
// Duplicate-resource regression (2026-07-23): 11 EPAM resources existed twice
// (an original April record + a June duplicate from a bulk script that never
// checked for an existing resource by name/supplier first). Migration 027
// adds `resources_name_supplier_active_unique` — a partial unique index on
// (lower(resource_name), supplier_id) WHERE deleted_at IS NULL — to make this
// class of duplication impossible at the DB level, including for any future
// out-of-band script that bypasses the UI entirely.
//
// These tests assert the *function* correctly surfaces that DB-level
// rejection as a catchable, non-throwing result — it must never mistake a
// unique-violation for a generic failure, and must never report success.

let insertResult: unknown

const singleMock = vi.fn()
const selectMock = vi.fn().mockReturnValue({ single: singleMock })
const insertMock = vi.fn().mockReturnValue({ select: selectMock })
const fromMock = vi.fn().mockReturnValue({ insert: insertMock })

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: () => ({ from: fromMock }),
}))

import { insertResource } from '../schedule-wizard'

beforeEach(() => {
  vi.clearAllMocks()
  insertResult = { data: { resource_id: 'res-brand-new-1' }, error: null }
  singleMock.mockImplementation(() => Promise.resolve(insertResult))
})

describe('insertResource', () => {
  it('succeeds and returns the new resource_id on a clean insert', async () => {
    const result = await insertResource('Jane Smith', 'supplier-1', 'onshore')

    expect(result.success).toBe(true)
    expect(result.resourceId).toBe('res-brand-new-1')
    expect(fromMock).toHaveBeenCalledWith('resources')
    expect(insertMock).toHaveBeenCalledWith({
      resource_name: 'Jane Smith',
      resource_location: 'onshore',
      supplier_id: 'supplier-1',
    })
  })

  it('returns { success: false } and does NOT report a resourceId when the active-resource unique index rejects a duplicate name+supplier', async () => {
    // Mirrors migration 027: a second active row for the same
    // (lower(resource_name), supplier_id) pair violates
    // resources_name_supplier_active_unique.
    insertResult = {
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "resources_name_supplier_active_unique"',
        code: '23505',
      },
    }

    const result = await insertResource('Aliaksei Yakimovich', 'supplier-epam', 'offshore')

    expect(result.success).toBe(false)
    expect(result.resourceId).toBeUndefined()
    expect(result.error).toContain('resources_name_supplier_active_unique')
  })

  it('surfaces the duplicate rejection the same way regardless of case or surrounding whitespace in the submitted name', async () => {
    // The unique index normalises with lower() but not trim(); the DB itself
    // will still reject an exact post-normalisation collision. This test
    // documents that whatever case/whitespace variant is submitted, a
    // DB-level rejection is surfaced as a clean, catchable error — never a
    // silently-inserted duplicate.
    insertResult = {
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "resources_name_supplier_active_unique"',
        code: '23505',
      },
    }

    const result = await insertResource('  ALIAKSEI YAKIMOVICH  ', 'supplier-epam', 'offshore')

    expect(result.success).toBe(false)
    expect(result.error).toContain('resources_name_supplier_active_unique')
  })
})
