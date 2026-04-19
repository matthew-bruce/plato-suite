import { notFound } from 'next/navigation'
import { getPlatformBySlug } from '@/lib/supabase/platformDetail'

export const dynamic = 'force-dynamic'

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ platformSlug: string }>
}) {
  const { platformSlug } = await params
  const platform = await getPlatformBySlug(platformSlug)
  if (!platform) notFound()

  return (
    <div
      style={{
        maxWidth: '800px',
        padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-04)',
          flexWrap: 'wrap',
          marginBottom: 'var(--rmg-spacing-03)',
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
          {platform.platform_name}
        </h1>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-text-light)',
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-xs)',
            padding: '2px var(--rmg-spacing-03)',
            whiteSpace: 'nowrap',
          }}
        >
          {platform.platform_code}
        </span>
      </div>
      {platform.platform_description && (
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b2)',
            lineHeight: 'var(--rmg-leading-b2)',
            color: 'var(--rmg-color-text-light)',
            margin: 0,
            marginTop: 'var(--rmg-spacing-04)',
          }}
        >
          {platform.platform_description}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 'var(--rmg-spacing-05)',
          marginTop: 'var(--rmg-spacing-09)',
        }}
      >
        <StatCard label="Workstreams" value={platform.workstreams.length} />
        <StatCard label="Teams" value={platform.teams.length} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-06)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h2)',
          lineHeight: 'var(--rmg-leading-h2)',
          color: 'var(--rmg-color-text-heading)',
          fontWeight: 700,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-b3)',
          lineHeight: 'var(--rmg-leading-b3)',
          color: 'var(--rmg-color-text-light)',
          marginTop: 'var(--rmg-spacing-02)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
