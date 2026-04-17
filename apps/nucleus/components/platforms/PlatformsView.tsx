'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PlatformRow } from '@/lib/supabase/platforms'

type Props = {
  platforms: PlatformRow[]
}

export function PlatformsView({ platforms }: Props) {
  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 'var(--rmg-spacing-09)' }}>
        <h1
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h2)',
            lineHeight: 'var(--rmg-leading-h2)',
            color: 'var(--rmg-color-text-heading)',
            marginBottom: 'var(--rmg-spacing-03)',
          }}
        >
          Platforms
        </h1>
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b2)',
            lineHeight: 'var(--rmg-leading-b2)',
            color: 'var(--rmg-color-text-light)',
          }}
        >
          Technology-owned platform groups
        </p>
      </div>

      {/* Empty state */}
      {platforms.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--rmg-spacing-13) var(--rmg-spacing-07)',
            backgroundColor: 'var(--rmg-color-surface-light)',
            borderRadius: 'var(--rmg-radius-m)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h5)',
              lineHeight: 'var(--rmg-leading-h5)',
              color: 'var(--rmg-color-text-heading)',
              marginBottom: 'var(--rmg-spacing-03)',
            }}
          >
            No platforms configured yet.
          </p>
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            Platforms will appear here once they have been added to the system.
          </p>
        </div>
      )}

      {/* Platform grid */}
      {platforms.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 480px), 1fr))',
            gap: 'var(--rmg-spacing-06)',
          }}
        >
          {platforms.map((platform) => (
            <PlatformCard key={platform.platform_id} platform={platform} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlatformCard({ platform }: { platform: PlatformRow }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={`/platforms/${platform.platform_slug}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: hovered ? 'var(--rmg-shadow-megamenu)' : 'var(--rmg-shadow-card)',
        transition: 'box-shadow 150ms ease',
        cursor: 'pointer',
        padding: 'var(--rmg-spacing-07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rmg-spacing-03)',
      }}
    >
      {/* Name and code badge row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--rmg-spacing-04)',
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h5)',
            lineHeight: 'var(--rmg-leading-h5)',
            color: 'var(--rmg-color-text-heading)',
            fontWeight: 700,
            margin: 0,
          }}
        >
          {platform.platform_name}
        </h2>
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

      {/* Description */}
      {platform.platform_description && (
        <p
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            lineHeight: 'var(--rmg-leading-b3)',
            color: 'var(--rmg-color-text-light)',
            margin: 0,
          }}
        >
          {platform.platform_description}
        </p>
      )}
    </div>
    </Link>
  )
}
