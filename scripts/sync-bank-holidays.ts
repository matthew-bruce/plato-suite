/**
 * Sync England-and-Wales bank holidays from gov.uk into uk_bank_holidays.
 *
 * Standalone maintenance script — NOT called by the app at runtime. The
 * Schedule page's "Populate working days" button reads uk_bank_holidays
 * directly and disables itself for any year with no rows, so this is run by
 * hand whenever gov.uk publishes further years (they typically publish
 * roughly two years ahead).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/sync-bank-holidays.ts
 *   ...add --dry-run to print what would change without writing.
 *
 * A service-role key is required: uk_bank_holidays is readable by any active
 * user but writable only by a superuser, and this runs outside a user session.
 */

import { createClient } from '@supabase/supabase-js'

const SOURCE_URL = 'https://www.gov.uk/bank-holidays.json'
const DIVISION = 'england-and-wales'

interface GovUkEvent {
  title: string
  date: string
  notes: string
  bunting: boolean
}

interface GovUkResponse {
  [division: string]: { division: string; events: GovUkEvent[] } | undefined
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. ' +
        'uk_bank_holidays is superuser-write, so an anon key will silently write nothing.',
    )
  }

  console.log(`Fetching ${SOURCE_URL} ...`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    throw new Error(`gov.uk returned ${res.status} ${res.statusText}`)
  }

  const payload = (await res.json()) as GovUkResponse
  const division = payload[DIVISION]
  if (!division || !Array.isArray(division.events)) {
    throw new Error(`No "${DIVISION}" division in the gov.uk payload`)
  }

  // Normalise to the table's shape. gov.uk already returns date-only strings.
  const incoming = division.events.map((e) => ({
    holiday_date: e.date.slice(0, 10),
    title: e.title,
    division: DIVISION,
  }))

  if (incoming.length === 0) {
    console.log('gov.uk returned no events — nothing to do.')
    return
  }

  const years = [...new Set(incoming.map((h) => h.holiday_date.slice(0, 4)))].sort()
  console.log(`Found ${incoming.length} holidays covering ${years.join(', ')}.`)

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existingRows, error: readErr } = await supabase
    .from('uk_bank_holidays')
    .select('holiday_date')

  if (readErr) throw new Error(`Failed to read existing holidays: ${readErr.message}`)

  const existing = new Set((existingRows ?? []).map((r) => String(r.holiday_date).slice(0, 10)))
  const added = incoming.filter((h) => !existing.has(h.holiday_date))

  if (added.length === 0) {
    console.log('Already up to date — no new dates to insert.')
    return
  }

  console.log(`${added.length} new date(s):`)
  for (const h of added) console.log(`  ${h.holiday_date}  ${h.title}`)

  if (dryRun) {
    console.log('\n--dry-run set; nothing written.')
    return
  }

  // Upsert rather than insert so a re-run after gov.uk corrects a title (they
  // do occasionally revise substitute-day names) updates in place instead of
  // failing on the holiday_date primary key.
  const { error: writeErr } = await supabase
    .from('uk_bank_holidays')
    .upsert(incoming, { onConflict: 'holiday_date' })

  if (writeErr) throw new Error(`Failed to upsert holidays: ${writeErr.message}`)

  console.log(`\nDone — ${added.length} new date(s) inserted, ${incoming.length} row(s) upserted.`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
