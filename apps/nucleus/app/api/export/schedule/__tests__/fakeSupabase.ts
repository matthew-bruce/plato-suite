// A stand-in for the Supabase server client, good enough to drive the export
// route end to end.
//
// The route builds each query as a chain — .from().select().eq().is() and so
// on — and then either awaits the chain directly or calls .maybeSingle(). Both
// shapes are supported here by making every builder thenable: the chain
// resolves to { data, error } for whichever table it started from, and every
// intermediate method just returns the builder again.
//
// Filters are deliberately NOT evaluated. The route's own query predicates are
// Supabase's job, not this file's; what these tests exercise is what the route
// does with the rows it gets back. A fake that re-implemented .eq() would be
// asserting its own filter logic.

export interface FakeTables {
  periods?: unknown[]
  resource_period_allocations?: unknown[]
  resource_team_assignments?: unknown[]
}

export interface RecordedQuery {
  table: string
  calls: string[]
}

export function fakeSupabase(tables: FakeTables) {
  const queries: RecordedQuery[] = []

  function builder(table: string) {
    const record: RecordedQuery = { table, calls: [] }
    queries.push(record)
    const rows = (tables as Record<string, unknown[] | undefined>)[table] ?? []
    const result = { data: rows, error: null }

    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () => ({ data: rows[0] ?? null, error: null }),
    }
    for (const method of ['select', 'eq', 'is', 'in', 'order', 'not', 'gte', 'lte', 'neq']) {
      chain[method] = (...args: unknown[]) => {
        record.calls.push(`${method}(${args.map(String).join(',')})`)
        return chain
      }
    }
    return chain
  }

  return {
    client: { from: (table: string) => builder(table) },
    queries,
  }
}
