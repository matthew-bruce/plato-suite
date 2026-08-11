'use client'

import type { ReactNode } from 'react'
import {
  LayoutGrid,
  Building2,
  Users,
  UserCircle,
  Truck,
  CalendarRange,
  ReceiptText,
  Layers,
  LineChart,
  Palette,
  Settings,
  EyeOff,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { PlatoShell } from '@plato/ui'
import type { NavSection, ConfigItem } from '@plato/ui'
import { isPublicPath } from '@plato/auth'
import { usePrivacyMode } from '@/context/PrivacyModeContext'

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Dashboard', icon: <LayoutGrid size={16} />, href: '/', exactMatch: true },
    ],
  },
  {
    heading: 'Organisation',
    items: [
      { label: 'Org Structure', icon: <Building2 size={16} />,  href: '#', disabled: true },
      { label: 'Teams',         icon: <Users size={16} />,      href: '#', disabled: true },
      { label: 'Resources',     icon: <UserCircle size={16} />, href: '/people' },
      { label: 'Suppliers',     icon: <Truck size={16} />,      href: '#', disabled: true },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { label: 'Platform Schedule', icon: <CalendarRange size={16} />, href: '/schedule' },
      { label: 'Blended Rates',      icon: <LineChart size={16} />,     href: '/rates'    },
      { label: 'Rate Cards',         icon: <ReceiptText size={16} />,   href: '#', disabled: true },
      { label: 'Periods',            icon: <Layers size={16} />,        href: '#', disabled: true },
    ],
  },
  {
    heading: 'Design System',
    items: [
      { label: 'Components', icon: <Palette size={16} />, href: '/design-system' },
    ],
  },
]

const CONFIG_ITEMS: ConfigItem[] = [
  { label: 'Settings', icon: <Settings size={16} />, href: '#', disabled: true },
  { label: 'Privacy mode', element: <PrivacyModeNavItem /> },
]

export function NucleusAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Auth pages (login / forgot / reset / callback) render standalone — no nav
  // chrome. Middleware guarantees only these are reachable without a session.
  if (isPublicPath(pathname)) {
    return <>{children}</>
  }

  return (
    <PlatoShell
      activeApp="nucleus"
      appName="Nucleus"
      appSubtitle="eBusiness Platform"
      navSections={NAV_SECTIONS}
      configItems={CONFIG_ITEMS}
    >
      {children}
    </PlatoShell>
  )
}

/* ── Privacy Mode toggle ───────────────────────────────────────── */

function PrivacyModeNavItem() {
  const { isPrivate, togglePrivacy } = usePrivacyMode()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 6,
        width: 'calc(100% - 12px)',
        margin: '1px 6px',
        boxSizing: 'border-box',
        backgroundColor: isPrivate ? '#FFF1F1' : 'transparent',
        color: isPrivate ? '#C8102E' : '#666666',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 13,
        fontWeight: isPrivate ? 500 : 400,
        transition: 'background-color 150ms ease, color 150ms ease',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'currentColor',
        }}
      >
        <EyeOff size={16} />
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Privacy mode
      </span>
      <PrivacyToggle on={isPrivate} onToggle={togglePrivacy} />
    </div>
  )
}

function PrivacyToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Toggle privacy mode"
      onClick={onToggle}
      style={{
        position: 'relative',
        width: 32,
        height: 18,
        borderRadius: 9,
        border: 'none',
        background: on ? '#C8102E' : '#D5D5D5',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        transition: 'background-color 180ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 180ms ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
