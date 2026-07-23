import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// The action issues three or four sequential Supabase queries:
//   1. (new mode only) resources INSERT → .select('resource_id').single()
//   2. resource_period_allocations SELECT → .eq().eq().is().order().limit()
//   3. resource_period_allocations INSERT → .select('allocation_id').single()
//   4. (if teamId) resource_team_assignments INSERT
//
// We track which table each `from()` call targets and return independent
// mock chains per call to avoid cross-contamination.

let fromCallIndex = 0

function makeSelectChain(resolveWith: unknown) {
  const single = vi.fn().mockResolvedValue(resolveWith)
  const select = vi.fn().mockReturnValue({ single })
  return { select }
}

function makeInsertChain(selectResolveWith: unknown) {
  const single = vi.fn().mockResolvedValue(selectResolveWith)
  const selectFn = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select: selectFn })
  return { insert }
}

function makeInsertDirect(resolveWith: unknown) {
  const insert = vi.fn().mockResolvedValue(resolveWith)
  return { insert }
}

function makeDisplayOrderChain(resolveWith: unknown) {
  const limit = vi.fn().mockResolvedValue(resolveWith)
  const order = vi.fn().mockReturnValue({ limit })
  const is = vi.fn().mockReturnValue({ order })
  const eq2 = vi.fn().mockReturnValue({ is })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const select = vi.fn().mockReturnValue({ eq: eq1 })
  return { select }
}

// Per-test mock state
let resourcesInsertResult: unknown
let displayOrderResult: unknown
let allocInsertResult: unknown
let teamInsertResult: unknown

const fromMock = vi.fn()

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: () => ({ from: fromMock }),
}))

import { createResourceAndAllocation } from '../schedule-wizard'

beforeEach(() => {
  vi.clearAllMocks()
  fromCallIndex = 0

  // Default results — override per test as needed
  resourcesInsertResult = { data: { resource_id: 'res-new-123' }, error: null }
  displayOrderResult = { data: [{ display_order: 5 }], error: null }
  allocInsertResult = { data: { allocation_id: 'alloc-456' }, error: null }
  teamInsertResult = { error: null }
})

function setupFromMock(mode: 'tbc' | 'existing' | 'new', includeTeam = false) {
  fromMock.mockImplementation((table: string) => {
    fromCallIndex++

    // New mode only: first call is resources INSERT
    if (mode === 'new' && table === 'resources') {
      const { insert } = makeInsertChain(resourcesInsertResult)
      return { insert }
    }

    // Display order query: first (or second if new mode) call to resource_period_allocations
    if (table === 'resource_period_allocations' && isDisplayOrderCall()) {
      return makeDisplayOrderChain(displayOrderResult)
    }

    // Allocation INSERT
    if (table === 'resource_period_allocations') {
      const { insert } = makeInsertChain(allocInsertResult)
      return { insert }
    }

    // Team assignment INSERT
    if (table === 'resource_team_assignments') {
      return makeInsertDirect(teamInsertResult)
    }

    return {}
  })
}

// Track whether this is the display_order SELECT call vs the allocation INSERT call
let rpaCallCount = 0
function isDisplayOrderCall(): boolean {
  rpaCallCount++
  return rpaCallCount === 1
}

function resetRpa() {
  rpaCallCount = 0
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('createResourceAndAllocation — TBC path', () => {
  it('inserts allocation with null resource_id and returns success', async () => {
    resetRpa()
    displayOrderResult = { data: [], error: null }
    allocInsertResult = { data: { allocation_id: 'alloc-tbc-1' }, error: null }
    setupFromMock('tbc')

    const result = await createResourceAndAllocation({
      mode: 'tbc',
      supplierId: 'supplier-1',
      supplierName: 'Capgemini',
      roleTitle: 'TBC Role',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
      periodId: 'period-1',
    })

    expect(result.success).toBe(true)
    expect(result.allocationId).toBe('alloc-tbc-1')
    expect(result.resourceId).toBeNull()
    // MAX(display_order) is null from empty result → defaults to 0, so 0+1=1
    expect(result.displayOrder).toBe(1)
  })

  it('does NOT insert into resources for TBC mode', async () => {
    resetRpa()
    displayOrderResult = { data: [], error: null }
    allocInsertResult = { data: { allocation_id: 'alloc-tbc-2' }, error: null }
    setupFromMock('tbc')

    await createResourceAndAllocation({
      mode: 'tbc',
      supplierId: 'supplier-1',
      supplierName: 'Capgemini',
      roleTitle: 'TBC',
      planviewCode: 'BAU',
      resourceLocation: 'offshore',
      periodId: 'period-1',
    })

    const resourceCalls = (fromMock.mock.calls as string[][]).filter(([t]) => t === 'resources')
    expect(resourceCalls).toHaveLength(0)
  })
})

describe('createResourceAndAllocation — existing resource path', () => {
  it('uses the provided resourceId and returns success', async () => {
    resetRpa()
    displayOrderResult = { data: [{ display_order: 3 }], error: null }
    allocInsertResult = { data: { allocation_id: 'alloc-existing-7' }, error: null }
    setupFromMock('existing')

    const result = await createResourceAndAllocation({
      mode: 'existing',
      resourceId: 'res-existing-99',
      supplierId: 'supplier-2',
      supplierName: 'TCS',
      roleTitle: 'Backend Engineer',
      planviewCode: 'PR',
      resourceLocation: 'offshore',
      periodId: 'period-2',
    })

    expect(result.success).toBe(true)
    expect(result.allocationId).toBe('alloc-existing-7')
    expect(result.resourceId).toBe('res-existing-99')
    expect(result.displayOrder).toBe(4) // MAX=3, 3+1=4
  })

  it('does NOT insert into resources for existing mode', async () => {
    resetRpa()
    displayOrderResult = { data: [{ display_order: 1 }], error: null }
    allocInsertResult = { data: { allocation_id: 'alloc-e' }, error: null }
    setupFromMock('existing')

    await createResourceAndAllocation({
      mode: 'existing',
      resourceId: 'res-abc',
      supplierId: 'supplier-1',
      supplierName: 'CG',
      roleTitle: 'Analyst',
      planviewCode: 'BAU',
      resourceLocation: 'onshore',
      periodId: 'period-1',
    })

    const resourceCalls = (fromMock.mock.calls as string[][]).filter(([t]) => t === 'resources')
    expect(resourceCalls).toHaveLength(0)
  })
})

describe('createResourceAndAllocation — new person path', () => {
  it('inserts a resource then an allocation', async () => {
    resetRpa()
    resourcesInsertResult = { data: { resource_id: 'res-new-42' }, error: null }
    displayOrderResult = { data: [{ display_order: 10 }], error: null }
    allocInsertResult = { data: { allocation_id: 'alloc-new-person-5' }, error: null }
    setupFromMock('new')

    const result = await createResourceAndAllocation({
      mode: 'new',
      resourceName: 'Jane Smith',
      supplierId: 'supplier-3',
      supplierName: 'North Highland',
      roleTitle: 'Delivery Manager',
      planviewCode: 'F_Gov',
      resourceLocation: 'onshore',
      periodId: 'period-3',
    })

    expect(result.success).toBe(true)
    expect(result.allocationId).toBe('alloc-new-person-5')
    expect(result.resourceId).toBe('res-new-42')
    expect(result.displayOrder).toBe(11) // MAX=10, 10+1=11
  })

  it('returns { success: false } if resourceName is missing in new mode', async () => {
    const result = await createResourceAndAllocation({
      mode: 'new',
      resourceName: undefined,
      supplierId: 'supplier-1',
      supplierName: 'Capgemini',
      roleTitle: 'Developer',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
      periodId: 'period-1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('required')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns { success: false } when resource INSERT fails', async () => {
    resetRpa()
    resourcesInsertResult = {
      data: null,
      error: { message: 'unique constraint violation' },
    }
    setupFromMock('new')

    const result = await createResourceAndAllocation({
      mode: 'new',
      resourceName: 'Duplicate Person',
      supplierId: 'supplier-1',
      supplierName: 'Capgemini',
      roleTitle: 'Engineer',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
      periodId: 'period-1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('unique constraint violation')
  })

  // Duplicate-resource regression (2026-07-23): migration 027 adds
  // resources_name_supplier_active_unique — a partial unique index on
  // (lower(resource_name), supplier_id) WHERE deleted_at IS NULL — after 11
  // EPAM resources were found duplicated (an original April row + a June
  // duplicate from a bulk script with no existing-resource check). This
  // asserts the "new person" path surfaces that DB-level rejection cleanly
  // and does NOT report success or an allocationId when the resource insert
  // itself was rejected as a duplicate.
  it('returns { success: false } and does not create an allocation when the resource insert is rejected as a duplicate name+supplier', async () => {
    resetRpa()
    resourcesInsertResult = {
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "resources_name_supplier_active_unique"',
        code: '23505',
      },
    }
    setupFromMock('new')

    const result = await createResourceAndAllocation({
      mode: 'new',
      resourceName: 'Aliaksei Yakimovich',
      supplierId: 'supplier-epam',
      supplierName: 'EPAM',
      roleTitle: 'Engineer',
      planviewCode: 'PR',
      resourceLocation: 'offshore',
      periodId: 'period-1',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('resources_name_supplier_active_unique')
    expect(result.allocationId).toBeUndefined()

    // The allocation INSERT must never be attempted after a rejected resource insert.
    const allocationCalls = (fromMock.mock.calls as string[][]).filter(
      ([t]) => t === 'resource_period_allocations',
    )
    expect(allocationCalls).toHaveLength(0)
  })
})

// ── Silent-failure finding (2026-07-23 CRUD audit) — NOT YET FIXED ──────────
//
// Step 4 of createResourceAndAllocation (schedule-wizard.ts) inserts team
// assignments after the resource + allocation are already committed. Today
// that insert's error is caught, console.error'd, and swallowed BY DESIGN
// ("Non-fatal: log but don't fail the whole operation") — the function still
// returns { success: true }. A caller (AddResourceWizard.tsx) reports full
// success and closes the wizard even when team assignments never saved.
//
// Per WORKING_AGREEMENT.md's diagnose-before-patch rule, this is flagged to
// Matt for sign-off, not fixed here. This test uses `it.fails` — it encodes
// the CORRECT/desired behaviour (a team-assignment failure should be visible
// on the result, not swallowed) and is expected to fail against the current
// code. It documents the gap without breaking the suite; if the source is
// ever fixed to make this pass, `it.fails` itself will start failing as a
// signal to convert it to a normal `it` and remove this comment.
describe('createResourceAndAllocation — team-assignment failure visibility (flagged, not fixed)', () => {
  it.fails(
    'FLAGGED: should not report success when the team-assignment insert fails after resource+allocation creation',
    async () => {
      resetRpa()
      resourcesInsertResult = { data: { resource_id: 'res-new-1' }, error: null }
      displayOrderResult = { data: [], error: null }
      allocInsertResult = { data: { allocation_id: 'alloc-1' }, error: null }
      teamInsertResult = { error: { message: 'permission denied for resource_team_assignments' } }
      setupFromMock('new', true)

      const result = await createResourceAndAllocation({
        mode: 'new',
        resourceName: 'Jane Smith',
        supplierId: 'supplier-1',
        supplierName: 'Capgemini',
        roleTitle: 'Engineer',
        planviewCode: 'PR',
        resourceLocation: 'onshore',
        periodId: 'period-1',
        teamAssignments: [{ teamId: 'team-a', capacitySplit: 100 }],
      })

      // Desired behaviour: the caller must be able to tell the write was
      // incomplete. Currently `result.success` is `true` regardless, so this
      // assertion fails — that failure is expected and intentional.
      expect(result.success).toBe(false)
    },
  )
})

describe('createResourceAndAllocation — display_order', () => {
  it('uses display_order = 1 when there are no existing rows', async () => {
    resetRpa()
    displayOrderResult = { data: [], error: null }
    allocInsertResult = { data: { allocation_id: 'a1' }, error: null }
    setupFromMock('tbc')

    const result = await createResourceAndAllocation({
      mode: 'tbc',
      supplierId: 'sup',
      supplierName: 'Sup',
      roleTitle: 'Role',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
      periodId: 'p',
    })

    expect(result.success).toBe(true)
    expect(result.displayOrder).toBe(1)
  })

  it('uses display_order = MAX + 1 when rows exist', async () => {
    resetRpa()
    displayOrderResult = { data: [{ display_order: 7 }], error: null }
    allocInsertResult = { data: { allocation_id: 'a2' }, error: null }
    setupFromMock('tbc')

    const result = await createResourceAndAllocation({
      mode: 'tbc',
      supplierId: 'sup',
      supplierName: 'Sup',
      roleTitle: 'Role',
      planviewCode: 'PR',
      resourceLocation: 'onshore',
      periodId: 'p',
    })

    expect(result.success).toBe(true)
    expect(result.displayOrder).toBe(8)
  })
})
