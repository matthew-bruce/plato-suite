import { TesseraShell } from '@/components/TesseraShell'
import { supabase } from '@/lib/supabase'
import { DomainsClient } from '@/components/DomainsClient'

export const dynamic = 'force-dynamic'

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'SCOPED'

export type DomainRow = {
  id: string
  name: string
  slug: string
  risk_level: RiskLevel | null
  description: string | null
  active_dimensions: number
  completed_dimensions: number
  session_count: number
  total_hours: number
}

const RISK_ORDER: Record<string, number> = {
  HIGH: 1, MEDIUM: 2, LOW: 3, SCOPED: 4,
}

type RawDomain = {
  id: string
  name: string
  slug: string
  risk_level: string | null
  description: string | null
}

type RagRow = {
  domain_id: string
  dimension: string
  score: string
}

type LinkRow = {
  domain_id: string
  session_id: string
}

type SessionRow = {
  id: string
  duration_hrs: number | string | null
}

export default async function DomainsPage() {
  const [domainsRes, ragRes, linksRes] = await Promise.all([
    supabase
      .from('tessera_domains')
      .select('id, name, slug, risk_level, description'),
    supabase
      .from('tessera_rag_scores')
      .select('domain_id, dimension, score'),
    supabase
      .from('tessera_kt_session_domain_links')
      .select('domain_id, session_id'),
  ])

  if (domainsRes.error) console.error('[DomainsPage] domains:', domainsRes.error)
  if (ragRes.error)     console.error('[DomainsPage] rag:', ragRes.error)
  if (linksRes.error)   console.error('[DomainsPage] links:', linksRes.error)

  const rawDomains = (domainsRes.data ?? []) as RawDomain[]
  const ragScores  = (ragRes.data  ?? []) as RagRow[]
  const links      = (linksRes.data ?? []) as LinkRow[]

  // Fetch session durations for all linked session IDs
  const sessionIds = [...new Set(links.map((l) => l.session_id))]
  const sessionHoursMap = new Map<string, number>()
  if (sessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from('tessera_kt_sessions')
      .select('id, duration_hrs')
      .in('id', sessionIds)
    for (const s of (sessions ?? []) as SessionRow[]) {
      if (s.duration_hrs != null) {
        sessionHoursMap.set(s.id, Number(s.duration_hrs))
      }
    }
  }

  // Aggregate readiness + session stats per domain
  const domains: DomainRow[] = rawDomains
    .map((d) => {
      const domainRag   = ragScores.filter((r) => r.domain_id === d.id)
      const domainLinks = links.filter((l) => l.domain_id === d.id)

      const activeDimensions = new Set(
        domainRag
          .filter((r) => r.score === 'AMBER' || r.score === 'GREEN')
          .map((r) => r.dimension),
      ).size
      const completedDimensions = new Set(
        domainRag.filter((r) => r.score === 'GREEN').map((r) => r.dimension),
      ).size
      const sessionCount = domainLinks.length
      const totalHours   = domainLinks.reduce(
        (sum, l) => sum + (sessionHoursMap.get(l.session_id) ?? 0),
        0,
      )

      return {
        id:                   d.id,
        name:                 d.name,
        slug:                 d.slug,
        risk_level:           (d.risk_level as RiskLevel | null),
        description:          d.description,
        active_dimensions:    activeDimensions,
        completed_dimensions: completedDimensions,
        session_count:        sessionCount,
        total_hours:          totalHours,
      }
    })
    .sort((a, b) => {
      const oa = RISK_ORDER[a.risk_level ?? ''] ?? 5
      const ob = RISK_ORDER[b.risk_level ?? ''] ?? 5
      if (oa !== ob) return oa - ob
      return a.name.localeCompare(b.name)
    })

  return (
    <TesseraShell activeRoute="/domains">
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
          {/* Page header */}
          <div style={{ marginBottom: 24 }}>
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
              Domains
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
              12 KT domains · CG → TCS transition
            </p>
          </div>

          <DomainsClient domains={domains} />
        </div>
      </div>
    </TesseraShell>
  )
}
