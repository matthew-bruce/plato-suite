'use server'

import { getSupabaseServerClient } from '@plato/schema'
import type { ResourceLocation, PlanviewCode } from '@plato/schema'

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

export interface CheckPeriodRow {
  role_title: string | null
  planview_code: string | null
  team_names: string[]
}

export interface CheckPeriodResult {
  exists: boolean
  rows: CheckPeriodRow[]
  existingTeamAssignments: Array<{ teamId: string; teamName: string; capacitySplit: number }>
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
  supplierNameFilter?: string | null,
): Promise<ResourceSearchResult[]> {
  if (query.length < 2) return []

  const supabase = getSupabaseServerClient()

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

  const results: ResourceSearchResult[] = rows.map((r) => {
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

  if (supplierNameFilter) {
    return results.filter((r) => r.supplier_name === supplierNameFilter)
  }

  return results
}

export async function fetchWizardData(): Promise<WizardData> {
  const supabase = getSupabaseServerClient()

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

export async function checkResourceInPeriod(
  resourceId: string,
  periodId: string,
): Promise<CheckPeriodResult> {
  const supabase = getSupabaseServerClient()

  type RawAllocRow = { allocation_id: string; role_title: string | null; planview_code: string | null }
  type RawTeamRow = {
    team_id: string
    capacity_split: number | null
    teams: { team_name: string } | { team_name: string }[] | null
  }

  const [allocResult, teamResult] = await Promise.all([
    supabase
      .from('resource_period_allocations')
      .select('allocation_id, role_title, planview_code')
      .eq('resource_id', resourceId)
      .eq('period_id', periodId)
      .is('deleted_at', null),
    supabase
      .from('resource_team_assignments')
      .select('team_id, capacity_split, teams:team_id(team_name)')
      .eq('resource_id', resourceId)
      .eq('period_id', periodId)
      .is('deleted_at', null),
  ])

  const allocRows = (allocResult.data ?? []) as unknown as RawAllocRow[]
  if (allocRows.length === 0) {
    return { exists: false, rows: [], existingTeamAssignments: [] }
  }

  const rawTeams = (teamResult.data ?? []) as unknown as RawTeamRow[]
  const team_names = rawTeams
    .map((t) => pickOne(t.teams)?.team_name ?? '')
    .filter(Boolean)

  const existingTeamAssignments = rawTeams.map((t) => ({
    teamId: t.team_id,
    teamName: pickOne(t.teams)?.team_name ?? '',
    capacitySplit: Math.round((t.capacity_split ?? 1) * 100),
  }))

  const rows: CheckPeriodRow[] = allocRows.map((a) => ({
    role_title: a.role_title,
    planview_code: a.planview_code,
    team_names,
  }))

  return { exists: true, rows, existingTeamAssignments }
}

export async function updateTeamAssignments(
  resourceId: string,
  periodId: string,
  assignments: Array<{ teamId: string; capacitySplit: number }>,
): Promise<{ success: boolean; error?: string }> {
  const realAssignments = assignments.filter((a) => a.teamId !== '')
  const total = realAssignments.reduce((s, a) => s + a.capacitySplit, 0)

  if (realAssignments.length > 0 && total !== 100) {
    return { success: false, error: `Capacity splits must sum to 100 (got ${total})` }
  }

  const supabase = getSupabaseServerClient()

  const { error: deleteErr } = await supabase
    .from('resource_team_assignments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('resource_id', resourceId)
    .eq('period_id', periodId)
    .is('deleted_at', null)

  if (deleteErr) {
    return { success: false, error: deleteErr.message }
  }

  if (realAssignments.length > 0) {
    const toInsert = realAssignments.map((a) => ({
      resource_id: resourceId,
      team_id: a.teamId,
      period_id: periodId,
      capacity_split: a.capacitySplit / 100,
    }))

    const { error: insertErr } = await supabase
      .from('resource_team_assignments')
      .insert(toInsert)

    if (insertErr) {
      return { success: false, error: insertErr.message }
    }
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
  const supabase = getSupabaseServerClient()

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
      day_rate: 0,
      utilisation_percent: 100,
      capacity_days: 0,
      is_chargeable: false,
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
