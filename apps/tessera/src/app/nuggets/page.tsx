import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { NuggetsClient } from '@/components/NuggetsClient'

export const dynamic = 'force-dynamic'

export type Nugget = {
  id: string
  number: number
  title: string
  content: string
  tags: string[] | null
}

export default async function NuggetsPage() {
  const { data, error } = await supabase
    .from('tessera_nuggets')
    .select('id, number, title, content, tags')
    .order('number')

  if (error) console.error('[NuggetsPage] error:', error)

  const nuggets = (data ?? []) as Nugget[]

  return (
    <TesseraShell activeRoute="/nuggets">
      <div
        style={{
          backgroundColor: 'var(--rmg-color-surface-light)',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            width: '100%',
            padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ marginBottom: 'var(--rmg-spacing-05)' }}>
            <h1
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: '2rem',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                color: 'var(--rmg-color-text-heading)',
                margin: 0,
              }}
            >
              Nuggets
            </h1>
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 14,
                color: 'var(--rmg-color-text-light)',
                margin: 0,
                marginTop: 6,
              }}
            >
              {nuggets.length} knowledge nuggets
            </p>
          </div>

          <NuggetsClient nuggets={nuggets} />
        </div>
      </div>
    </TesseraShell>
  )
}
