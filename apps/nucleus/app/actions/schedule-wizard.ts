'use server'

import { getSupabaseServerComponentClient } from '@plato/schema/server'
import type { ResourceLocation, PlanviewCode } from '@plato/schema'
import { deriveIsChargeable } from '../../lib/schedule/ui'

export interface ResourceSearchResult {
  resource_id: string
  resource_name: string
  resource_job_title: string | null
  resource_location: ResourceLocation | null
  supplier_id: string | null
  supplier_name: string | null
  supplier_colour: string | null
}

export interface SupplierOption {
  supplier_id: string
  supplier_name: string
  supplier_colour: string | null
  sort_order: number | null
}

export interface TeamOption {
  team_id: string
  team_name: string
}

export interface WizardData {
  suppliers: SupplierOption[]
  teams: TeamOption[]
}

type RawResourceRow = {
  resource_id: string
  resource_name: string
  resource_job_title: string | null
  resource_location: string | null
  supplier_id: string | null
  suppliers:
    | { supplier_name: string; supplier_colour: string | null }
    | { supplier_name: string; supplier_colour: string | null }[]
    | null
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export async function searchResources(
  query: string,
): Promise<ResourceSearchResult[]> {
  if (query.length < 2) return []

  const supabase = await getSupabaseServerComponentClient()

  const { data, error } = await supabase
    .from('resources')
    .select(
      `resource_id, resource_name, resource_job_title, resource_location, supplier_id,
       suppliers:supplier_id ( supplier_name, supplier_colour )`,
    )
    .ilike('resource_name', `%${query}%`)
    .is('deleted_at', null)
    .limit(30)

  if (error) throw new Error(`searchResources: ${error.message}`)

  const rows = (data ?? []) as unknown as RawResourceRow[]

  return rows.map((r) => {
    const s = pickOne(r.suppliers)
    return {
      resource_id: r.resource_id,
      resource_name: r.resource_name,
      resource_job_title: r.resource_job_title,
      resource_location: (r.resource_location as ResourceLocation | null) ?? null,
      supplier_id: r.supplier_id,
      supplier_name: s?.supplier_name ?? null,
      supplier_colour: s?.supplier_colour ?? null,
    }
  })
}

export async function fetchWizardData(): Promise<WizardData> {
  const supabase = await getSupabaseServerComponentClient()

  const [suppliersResult, teamsResult] = await Promise.all([
    supabase
      .from('suppliers')
      .select('supplier_id, supplier_name, supplier_colour, sort_order')
      .order('sort_order', { ascending: true }),
    supabase.from('teams').select('team_id, team_name').order('team_name'),
  ])

  type RawSupplier = {
    supplier_id: string
    supplier_name: string
    supplier_colour: string | null
    sort_order: number | null
  }
  type RawTeam = { team_id: string; team_name: string }

  const suppliers: SupplierOption[] = ((suppliersResult.data ?? []) as unknown as RawSupplier[]).map(
    (s) => ({
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      supplier_colour: s.supplier_colour,
      sort_order: s.sort_order,
    }),
  )

  const teams: TeamOption[] = ((teamsResult.data ?? []) as unknown as RawTeam[]).map((t) => ({
    team_id: t.team_id,
    team_name: t.team_name,
  }))

  return { suppliers, teams }
}

/**
 * One active allocation a resource already holds in a period, with the detail
 * the conflict dialog needs to compare it against the row being connected now.
 */
export interface ConflictAllocation {
  allocation_id: string
  role_title: string | null
  planview_code: string | null
  capacity_days: number | null
  day_rate: number
  team_names: string[]
}

/**
 * Shared same-period conflict check used by both wizard entry points (creating
 * a new role for an existing resource, and filling a vacant seat with one).
 *
 * Returns every OTHER active (deleted_at IS NULL) allocation the resource
 * already holds in the period, excluding `excludeAllocationId` (the row being
 * created/filled now). An empty array means no conflict — proceed as normal.
 */
export async function findResourcePeriodConflicts(
  resourceId: string,
  periodId: string,
  excludeAllocationId?: string | null,
): Promise<ConflictAllocation[]> {
  const supabase = await getSupabaseServerComponentClient()

  type RawAllocRow = {
    allocation_id: string
    role_title: string | null
    planview_code: string | null
    capacity_days: number | string | null
    day_rate: number
  }
  type RawTeamRow = {
    team_id: string
    teams: { team_name: string } | { team_name: string }[] | null
  }

  let query = supabase
    .from('resource_period_allocations')
    .select('allocation_id, role_title, planview_code, capacity_days, day_rate')
    .eq('resource_id', resourceId)
    .eq('period_id', periodId)
    .is('deleted_at', null)

  if (excludeAllocationId) {
    query = query.neq('allocation_id', excludeAllocationId)
  }

  const { data: allocData, error: allocErr } = await query
  if (allocErr) throw new Error(`findResourcePeriodConflicts: ${allocErr.message}`)

  const allocRows = (allocData ?? []) as unknown as RawAllocRow[]
  if (allocRows.length === 0) return []

  // The resource's team assignments are keyed on resource_id (+period); they
  // describe the resource, not a single allocation, so they apply to every row
  // returned above. One lookup, shared across rows.
  const { data: teamData } = await supabase
    .from('resource_team_assignments')
    .select('team_id, teams:team_id ( team_name )')
    .eq('resource_id', resourceId)
    .eq('period_id', periodId)
    .is('deleted_at', null)

  const team_names = ((teamData ?? []) as unknown as RawTeamRow[])
    .map((t) => pickOne(t.teams)?.team_name ?? '')
    .filter(Boolean)

  return allocRows.map((a) => ({
    allocation_id: a.allocation_id,
    role_title: a.role_title,
    planview_code: a.planview_code,
    capacity_days: a.capacity_days === null ? null : Number(a.capacity_days),
    day_rate: a.day_rate,
    team_names,
  }))
}

/**
 * "Connect and keep existing details" — atomic. Keeps the resource's existing
 * standalone allocation untouched, re-keys the vacant seat's team assignment(s)
 * onto the resource, and soft-deletes the vacant seat's row. Single Postgres
 * RPC (migration 019) so all writes commit or roll back together.
 */
export async function connectKeepExisting(
  resourceId: string,
  periodId: string,
  vacantAllocationId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerComponentClient()
  const { error } = await supabase.rpc('connect_resource_keep_existing', {
    p_resource_id: resourceId,
    p_period_id: periodId,
    p_vacant_allocation_id: vacantAllocationId,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * "Connect and use vacant seat details" — atomic. Fills the vacant seat with
 * the resource (its role/capacity/rate stand) and soft-deletes the resource's
 * previous standalone row plus the team assignments tied to it. Single Postgres
 * RPC (migration 019).
 */
export async function connectUseVacant(
  resourceId: string,
  periodId: string,
  vacantAllocationId: string,
  supersededAllocationId: string,
  resourceLocation: ResourceLocation | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabaseServerComponentClient()
  const { error } = await supabase.rpc('connect_resource_use_vacant', {
    p_resource_id: resourceId,
    p_period_id: periodId,
    p_vacant_allocation_id: vacantAllocationId,
    p_superseded_allocation_id: supersededAllocationId,
    p_resource_location: resourceLocation,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateTeamAssignments(
  resourceId: string | null,
  periodId: string,
  assignments: Array<{ teamId: string; capacitySplit: number }>,
  allocationId?: string,
): Promise<{ success: boolean; error?: string }> {
  const realAssignments = assignments.filter((a) => a.teamId !== '')
  const total = realAssignments.reduce((s, a) => s + a.capacitySplit, 0)

  if (realAssignments.length > 0 && total !== 100) {
    return { success: false, error: `Capacity splits must sum to 100 (got ${total})` }
  }

  const supabase = await getSupabaseServerComponentClient()

  // Soft-delete + insert run inside a single Postgres function (RPC) so both
  // commit or roll back together — see migration 017. Two separate client
  // calls here would let a failed insert leave a committed delete behind.
  const { error } = await supabase.rpc('update_team_assignments', {
    p_resource_id: resourceId,
    p_period_id: periodId,
    p_allocation_id: allocationId ?? null,
    p_assignments: realAssignments.map((a) => ({
      team_id: a.teamId,
      capacity_split: a.capacitySplit,
    })),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export interface CreateAllocationParams {
  mode: 'existing' | 'new' | 'tbc'
  resourceId?: string | null
  resourceName?: string | null
  supplierId: string
  supplierName: string
  teamAssignments?: Array<{ teamId: string; capacitySplit: number }>
  roleTitle: string
  planviewCode: PlanviewCode
  resourceLocation: ResourceLocation
  periodId: string
  /** Optional starting capacity in days. Omitted/undefined → 0 (edit inline). */
  capacityDays?: number
  /** Optional starting day rate in integer pence. Omitted/undefined → 0. */
  dayRate?: number
}

export interface CreateAllocationResult {
  success: boolean
  allocationId?: string
  resourceId?: string | null
  displayOrder?: number | null
  error?: string
}

export async function createResourceAndAllocation(
  params: CreateAllocationParams,
): Promise<CreateAllocationResult> {
  const supabase = await getSupabaseServerComponentClient()

  try {
    let effectiveResourceId: string | null = null

    // Step 1: create a new resource record if required
    if (params.mode === 'new') {
      if (!params.resourceName) {
        return { success: false, error: 'Resource name is required for new-person mode' }
      }

      const { data: newResource, error: resourceErr } = await supabase
        .from('resources')
        .insert({
          resource_name: params.resourceName,
          supplier_id: params.supplierId,
          resource_location: params.resourceLocation,
        })
        .select('resource_id')
        .single()

      if (resourceErr || !newResource?.resource_id) {
        return { success: false, error: resourceErr?.message ?? 'Failed to create resource' }
      }

      effectiveResourceId = newResource.resource_id as string
    } else if (params.mode === 'existing') {
      effectiveResourceId = params.resourceId ?? null
    }
    // tbc mode: effectiveResourceId stays null

    // Step 2: compute display_order = MAX(display_order) + 1 within period + supplier group
    const { data: orderData } = await supabase
      .from('resource_period_allocations')
      .select('display_order')
      .eq('period_id', params.periodId)
      .eq('supplier_id', params.supplierId)
      .is('deleted_at', null)
      .order('display_order', { ascending: false })
      .limit(1)

    type OrderRow = { display_order: number | null }
    const maxOrder = ((orderData ?? []) as unknown as OrderRow[])[0]?.display_order ?? 0
    const newDisplayOrder = maxOrder + 1

    // Step 3: insert the allocation row
    const insertPayload: Record<string, unknown> = {
      period_id: params.periodId,
      supplier_id: params.supplierId,
      role_title: params.roleTitle,
      planview_code: params.planviewCode,
      resource_location: params.resourceLocation,
      day_rate: params.dayRate ?? 0,
      utilisation_percent: 100,
      capacity_days: params.capacityDays ?? 0,
      is_chargeable: deriveIsChargeable(params.planviewCode),
      vat_applies: true,
      display_order: newDisplayOrder,
    }

    if (effectiveResourceId !== null) {
      insertPayload['resource_id'] = effectiveResourceId
    }

    const { data: inserted, error: allocErr } = await supabase
      .from('resource_period_allocations')
      .insert(insertPayload)
      .select('allocation_id')
      .single()

    if (allocErr || !inserted?.allocation_id) {
      return { success: false, error: allocErr?.message ?? 'Failed to create allocation' }
    }

    const allocationId = inserted.allocation_id as string

    // Step 4: insert team assignments
    const realTeamAssignments = (params.teamAssignments ?? []).filter((a) => a.teamId !== '')
    if (realTeamAssignments.length > 0) {
      const teamRows = realTeamAssignments.map((a) => {
        const row: Record<string, unknown> = {
          team_id: a.teamId,
          period_id: params.periodId,
          capacity_split: a.capacitySplit / 100,
        }
        if (effectiveResourceId !== null) {
          row['resource_id'] = effectiveResourceId
        } else {
          row['allocation_id'] = allocationId
        }
        return row
      })

      const { error: teamErr } = await supabase.from('resource_team_assignments').insert(teamRows)

      if (teamErr) {
        // Non-fatal: log but don't fail the whole operation
        console.error('Team assignment insert failed:', teamErr.message)
      }
    }

    return {
      success: true,
      allocationId,
      resourceId: effectiveResourceId,
      displayOrder: newDisplayOrder,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { success: false, error: message }
  }
}

export async function getTeamAssignments(
  resourceId: string | null,
  periodId: string,
  allocationId?: string,
): Promise<Array<{ teamId: string; teamName: string; split: number }>> {
  const supabase = await getSupabaseServerComponentClient()

  type RawRow = {
    team_id: string
    capacity_split: number
    teams: { team_name: string } | { team_name: string }[] | null
  }

  const query = allocationId
    ? supabase
        .from('resource_team_assignments')
        .select('team_id, capacity_split, teams:team_id ( team_name )')
        .eq('allocation_id', allocationId)
        .is('resource_id', null)
        .is('deleted_at', null)
    : supabase
        .from('resource_team_assignments')
        .select('team_id, capacity_split, teams:team_id ( team_name )')
        .eq('resource_id', resourceId)
        .eq('period_id', periodId)
        .is('deleted_at', null)

  const { data, error } = await query

  if (error) throw new Error(`getTeamAssignments: ${error.message}`)

  return ((data ?? []) as unknown as RawRow[]).map((r) => {
    const team = pickOne(r.teams)
    return {
      teamId: r.team_id,
      teamName: team?.team_name ?? '',
      split: Math.round((r.capacity_split ?? 1) * 100),
    }
  })
}

/**
 * Create a bare resource record. Used by assign-mode wizard when the user
 * types a name that has no existing match and chooses "Add as new person".
 */
export async function insertResource(
  resourceName: string,
  supplierId: string | null,
  resourceLocation: ResourceLocation,
): Promise<{ success: boolean; resourceId?: string; error?: string }> {
  const supabase = await getSupabaseServerComponentClient()

  const payload: Record<string, unknown> = {
    resource_name: resourceName,
    resource_location: resourceLocation,
  }
  if (supplierId) payload['supplier_id'] = supplierId

  const { data, error } = await supabase
    .from('resources')
    .insert(payload)
    .select('resource_id')
    .single()

  if (error) return { success: false, error: error.message }
  type IdRow = { resource_id: string }
  return { success: true, resourceId: (data as unknown as IdRow).resource_id }
}
