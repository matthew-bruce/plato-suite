// Client-safe barrel. The server-only data-fetch functions (which pull in the
// cookie-aware SSR client → next/headers) live at @plato/schema/server so this
// index can be imported from client components without dragging next/headers
// into the client bundle. Type-only re-exports below are erased at emit, so
// they stay here for ergonomics.

export { getSupabaseServerClient } from './server'
export { getSupabaseBrowserClient } from './client'

export type {
  PlanviewCode,
  PeriodStatus,
  ResourceLocation,
  Period,
  CostConfiguration,
  TeamAssignment,
  ScheduleAllocation,
  SchedulePageData,
  PlatformCostItem,
} from './types/schedule'

export { computeUnallocatedPct, selectDefaultPeriod } from './utils/schedule'
export type { DefaultPeriodCandidate } from './utils/schedule'

export type { AppliedConfigPeriod } from './queries/costConfig'
export { pickEffectiveCostConfig, pickAppliedCostConfig } from './utils/costConfig'
export type { EffectiveDatedRow } from './utils/costConfig'

export type {
  RatesPageData,
  RatePlatform,
  RateHistoryRow,
  RatePeriod,
} from './queries/rates'

export type { PeriodSummary, AttentionItem, HomepageData } from './types/homepage'

export type {
  ResourceFunction,
  DirectoryResource,
  PeopleDirectoryData,
  AllocationHistoryRow,
  CommercialAllocation,
  CommercialSnapshot,
} from './types/people'

export {
  resolveResourceTeams,
  filterDirectoryResources,
  sortAllocationHistory,
  checkIsSuperuser,
} from './utils/people'
export type {
  TeamAssignmentRow,
  DirectoryFilterCriteria,
  FilterableResource,
  SortableHistoryRow,
  SuperuserRpcClient,
} from './utils/people'
