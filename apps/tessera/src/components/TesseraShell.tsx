'use client'

import { useState, useEffect } from 'react'
import {
  LayoutGrid,
  BookOpen,
  ClipboardList,
  Layers,
  Users,
  Star,
  Calendar,
  HelpCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface TesseraShellProps {
  children: React.ReactNode
  activeRoute: string
}

const SIDEBAR_EXPANDED = 220
const SIDEBAR_COLLAPSED = 56
const LS_KEY = 'tessera_nav_collapsed'

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>

type NavSectionDef = {
  label: string
  items: ReadonlyArray<{
    label: string
    icon: LucideIcon
    href: string
  }>
}

const NAV_SECTIONS: ReadonlyArray<NavSectionDef> = [
  {
    label: 'KT Framework',
    items: [
      { label: 'Dashboard', icon: LayoutGrid, href: '/' },
      { label: 'Domains', icon: BookOpen, href: '/domains' },
      { label: 'Sessions', icon: ClipboardList, href: '/sessions' },
      { label: 'App Groups', icon: Layers, href: '/groups' },
      { label: 'People', icon: Users, href: '/people' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Nuggets', icon: Star, href: '/nuggets' },
      { label: 'Itinerary', icon: Calendar, href: '/itinerary' },
      { label: "Parker's 7", icon: HelpCircle, href: '/parker' },
    ],
  },
]

const PLATO_APPS = [
  { id: 'nucleus', label: 'Nucleus', url: 'https://plato-nucleus.vercel.app', enabled: true },
  { id: 'tessera', label: 'Tessera', url: 'https://plato-tessera.vercel.app', enabled: true },
]

export function TesseraShell({ children, activeRoute }: TesseraShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(LS_KEY, String(next))
      return next
    })
  }

  const isCollapsed = collapsed || isMobile
  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED

  function isActive(href: string) {
    if (href === '/') return activeRoute === '/'
    return activeRoute === href || activeRoute.startsWith(href + '/')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* ── Global top header ── */}
      <div
        style={{
          height: 40,
          flexShrink: 0,
          backgroundColor: 'var(--rmg-color-red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 14,
            fontWeight: 700,
            color: '#ffffff',
            userSelect: 'none',
          }}
        >
          Plato
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {PLATO_APPS.map((app) => {
            const active = app.id === 'tessera'
            return (
              <a
                key={app.id}
                href={app.url}
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 13,
                  fontWeight: active ? 700 : 400,
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.7)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {app.label}
              </a>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ── Sidebar ── */}
        <aside
          style={{
            width: sidebarWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRight: '1px solid var(--rmg-color-grey-3)',
            transition: 'width 200ms ease',
            overflow: 'hidden',
            height: '100%',
          }}
        >
          {/* ── Identity block ── */}
          <div
            style={{
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 20,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {!isCollapsed ? (
              <>
                <div
                  style={{
                    fontFamily: 'var(--rmg-font-display)',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--rmg-color-red)',
                    marginBottom: 2,
                  }}
                >
                  Tessera
                </div>
                <div
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 12,
                    color: 'var(--rmg-color-text-light)',
                    marginBottom: 12,
                  }}
                >
                  KT Operating System
                </div>
                <div
                  style={{
                    height: 3,
                    borderRadius: 100,
                    background: 'linear-gradient(to right, #DA202A, #0892CB)',
                    marginBottom: 20,
                  }}
                />
              </>
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--rmg-radius-s)',
                  backgroundColor: 'var(--rmg-color-red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 20,
                }}
              >
                T
              </div>
            )}
          </div>

          {/* ── Nav sections ── */}
          <nav
            style={{
              flex: 1,
              overflow: 'hidden',
              paddingLeft: 8,
              paddingRight: 8,
            }}
          >
            {NAV_SECTIONS.map((section, idx) => (
              <div key={section.label}>
                {!isCollapsed && (
                  <div
                    style={{
                      paddingLeft: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--rmg-color-grey-1)',
                      marginBottom: 4,
                      marginTop: idx === 0 ? 0 : 20,
                      fontFamily: 'var(--rmg-font-body)',
                    }}
                  >
                    {section.label}
                  </div>
                )}
                {isCollapsed && idx > 0 && (
                  <div
                    style={{
                      height: 1,
                      backgroundColor: 'var(--rmg-color-grey-3)',
                      margin: '8px 4px',
                    }}
                  />
                )}
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    label={item.label}
                    Icon={item.icon}
                    href={item.href}
                    active={isActive(item.href)}
                    collapsed={isCollapsed}
                  />
                ))}
              </div>
            ))}
          </nav>

          {/* ── Bottom: settings + collapse toggle ── */}
          <div
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingBottom: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                height: 1,
                backgroundColor: 'var(--rmg-color-grey-3)',
                marginBottom: 8,
                marginLeft: 4,
                marginRight: 4,
              }}
            />
            <NavItem
              label="Settings"
              Icon={Settings}
              href="/settings"
              active={isActive('/settings')}
              collapsed={isCollapsed}
            />
            {!isMobile && (
              <button
                type="button"
                onClick={toggle}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-end',
                  width: '100%',
                  padding: '6px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--rmg-color-grey-1)',
                  marginTop: 2,
                }}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: 'var(--rmg-color-surface-light)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

// ── Nav item with hover state ────────────────────────────────────────────────

function NavItem({
  label,
  Icon,
  href,
  active,
  collapsed,
}: {
  label: string
  Icon: LucideIcon
  href: string
  active: boolean
  collapsed: boolean
}) {
  const [hovered, setHovered] = useState(false)

  let bg = 'transparent'
  let color = 'var(--rmg-color-text-body)'
  let fontWeight = 500

  if (active) {
    bg = 'var(--rmg-color-red)'
    color = '#ffffff'
    fontWeight = 600
  } else if (hovered) {
    bg = 'var(--rmg-color-grey-4)'
    color = 'var(--rmg-color-text-heading)'
  }

  return (
    <a
      href={href}
      title={collapsed ? label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: '8px 12px',
        borderRadius: 'var(--rmg-radius-m)',
        cursor: 'pointer',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 14,
        fontWeight,
        width: '100%',
        backgroundColor: bg,
        color,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        justifyContent: collapsed ? 'center' : 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 1.75} color="currentColor" />
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      )}
    </a>
  )
}
