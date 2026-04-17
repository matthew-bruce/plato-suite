'use client'

import Link from 'next/link'
import type {
  PlatformDetailData,
  WorkstreamRow,
  TeamRow,
} from '@/lib/supabase/platformDetail'

type Props = {
  platform: PlatformDetailData
}

export function PlatformDetailView({ platform }: Props) {
  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
      }}
    >
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-03)',
          marginBottom: 'var(--rmg-spacing-06)',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-b3)',
          lineHeight: 'var(--rmg-leading-b3)',
        }}
      >
        <Link
          href="/platforms"
          style={{ color: 'var(--rmg-color-text-accent)', textDecoration: 'none' }}
        >
          Platforms
        </Link>
        <span style={{ color: 'var(--rmg-color-text-light)' }} aria-hidden>›</span>
        <span style={{ color: 'var(--rmg-color-text-body)' }}>
          {platform.platform_name}
        </span>
      </nav>

      {/* Platform header */}
      <div style={{ marginBottom: 'var(--rmg-spacing-10)' }}>
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
              backgroundColor: 'var(--rmg-color-surface-light)',
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
            }}
          >
            {platform.platform_description}
          </p>
        )}
      </div>

      {/* Workstreams section */}
      <section style={{ marginBottom: 'var(--rmg-spacing-11)' }}>
        <h2
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h3)',
            lineHeight: 'var(--rmg-leading-h3)',
            color: 'var(--rmg-color-text-heading)',
            marginBottom: 'var(--rmg-spacing-07)',
            paddingBottom: 'var(--rmg-spacing-04)',
            borderBottom: '2px solid var(--rmg-color-red)',
          }}
        >
          Workstreams
        </h2>
        {platform.workstreams.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b2)',
              lineHeight: 'var(--rmg-leading-b2)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            No workstreams configured.
          </p>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rmg-spacing-04)' }}
          >
            {platform.workstreams.map((ws) => (
              <WorkstreamItem key={ws.workstream_id} workstream={ws} />
            ))}
          </div>
        )}
      </section>

      {/* Teams section */}
      <section style={{ marginBottom: 'var(--rmg-spacing-11)' }}>
        <h2
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h3)',
            lineHeight: 'var(--rmg-leading-h3)',
            color: 'var(--rmg-color-text-heading)',
            marginBottom: 'var(--rmg-spacing-07)',
            paddingBottom: 'var(--rmg-spacing-04)',
            borderBottom: '2px solid var(--rmg-color-red)',
          }}
        >
          Teams
        </h2>
        {platform.teams.length === 0 ? (
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b2)',
              lineHeight: 'var(--rmg-leading-b2)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            No teams configured.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {platform.teams.map((team) => {
              const workstream = platform.workstreams.find(
                (ws) => ws.workstream_id === team.workstream_id
              )
              return (
                <TeamCard
                  key={team.team_id}
                  team={team}
                  workstreamName={workstream?.workstream_name ?? null}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function WorkstreamItem({ workstream }: { workstream: WorkstreamRow }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-06) var(--rmg-spacing-07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rmg-spacing-02)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-04)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h6)',
            lineHeight: 'var(--rmg-leading-h6)',
            color: 'var(--rmg-color-text-heading)',
            fontWeight: 700,
          }}
        >
          {workstream.workstream_name}
        </span>
        <FundingBadge source={workstream.funding_source} />
      </div>
      {workstream.workstream_description && (
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            lineHeight: 'var(--rmg-leading-b3)',
            color: 'var(--rmg-color-text-light)',
            margin: 0,
          }}
        >
          {workstream.workstream_description}
        </p>
      )}
    </div>
  )
}

const FUNDING_BADGE_STYLES: Record<
  WorkstreamRow['funding_source'],
  { backgroundColor: string; color: string; label: string }
> = {
  T4B: {
    backgroundColor: 'var(--rmg-color-surface-light)',
    color: 'var(--rmg-color-blue)',
    label: 'T4B',
  },
  T4T: {
    backgroundColor: 'var(--rmg-color-tint-yellow)',
    color: 'var(--rmg-color-text-body)',
    label: 'T4T',
  },
  external: {
    backgroundColor: 'var(--rmg-color-grey-3)',
    color: 'var(--rmg-color-text-light)',
    label: 'External',
  },
}

function FundingBadge({ source }: { source: WorkstreamRow['funding_source'] }) {
  const { backgroundColor, color, label } = FUNDING_BADGE_STYLES[source]
  return (
    <span
      style={{
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-c1)',
        lineHeight: 'var(--rmg-leading-c1)',
        fontWeight: 700,
        color,
        backgroundColor,
        borderRadius: 'var(--rmg-radius-xl)',
        padding: '2px var(--rmg-spacing-04)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function TeamCard({
  team,
  workstreamName,
}: {
  team: TeamRow
  workstreamName: string | null
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        padding: 'var(--rmg-spacing-07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rmg-spacing-02)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--rmg-font-display)',
          fontSize: 'var(--rmg-text-h6)',
          lineHeight: 'var(--rmg-leading-h6)',
          color: 'var(--rmg-color-text-heading)',
          fontWeight: 700,
        }}
      >
        {team.team_name}
      </span>
      {workstreamName && (
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            lineHeight: 'var(--rmg-leading-b3)',
            color: 'var(--rmg-color-text-light)',
          }}
        >
          {workstreamName}
        </span>
      )}
    </div>
  )
}
