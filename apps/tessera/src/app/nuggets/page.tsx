import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { NuggetsClient } from '@/components/NuggetsClient'

export const dynamic = 'force-dynamic'

export type Nugget = {
  number: number
  title: string
  content: string
  tags: string[] | null
}

export default async function NuggetsPage() {
  const { data } = await supabase
    .from('tessera_nuggets')
    .select('number, title, content, tags')
    .eq('is_private', true)
    .order('number')

  const nuggets = (data ?? []) as Nugget[]

  return (
    <TesseraShell activeRoute="/nuggets">
      <div
        style={{
          width: '100%',
          padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ marginBottom: 'var(--rmg-spacing-07)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--rmg-spacing-03)',
              marginBottom: 'var(--rmg-spacing-02)',
            }}
          >
            <h1
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: 'var(--rmg-text-h2)',
                lineHeight: 'var(--rmg-leading-h2)',
                color: 'var(--rmg-color-text-heading)',
                margin: 0,
              }}
            >
              Nuggets
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
                backgroundColor: 'var(--rmg-color-text-heading)',
                color: 'var(--rmg-color-surface-white)',
                borderRadius: 'var(--rmg-radius-s)',
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Private
            </span>
          </div>
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-light)',
              margin: 0,
            }}
          >
            Strategic observations and talking points for in-session use. Not
            for distribution.
          </p>
        </div>

        <NuggetsClient nuggets={nuggets} />
      </div>
    </TesseraShell>
  )
}
