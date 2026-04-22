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

const SIDEBAR_EXPANDED = 240
const SIDEBAR_COLLAPSED = 52
const LS_KEY = 'tessera_nav_collapsed'

type NavSection = {
  label: string
  items: ReadonlyArray<{
    label: string
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
    href: string
  }>
}

const NAV_SECTIONS: ReadonlyArray<NavSection> = [
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside
        style={{
          width: sidebarWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: 'var(--rmg-color-surface-white)',
          borderRight: '1px solid var(--rmg-color-grey-3)',
          transition: 'width 200ms ease',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 3,
            flexShrink: 0,
            backgroundColor: 'var(--rmg-color-red)',
            alignSelf: 'stretch',
          }}
        />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            paddingTop: 'var(--rmg-spacing-06)',
            paddingBottom: 'var(--rmg-spacing-04)',
          }}
        >
          <div
            style={{
              paddingLeft: 'var(--rmg-spacing-04)',
              paddingRight: 'var(--rmg-spacing-04)',
              marginBottom: 'var(--rmg-spacing-07)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {!isCollapsed ? (
              <>
                <div
                  style={{
                    fontFamily: 'var(--rmg-font-display)',
                    fontSize: 'var(--rmg-text-h5)',
                    lineHeight: 'var(--rmg-leading-h5)',
                    fontWeight: 700,
                    color: 'var(--rmg-color-red)',
                  }}
                >
                  Tessera
                </div>
                <div
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-c2)',
                    lineHeight: 'var(--rmg-leading-c2)',
                    color: 'var(--rmg-color-text-light)',
                    marginTop: 2,
                  }}
                >
                  KT Operating System
                </div>
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
                  color: 'var(--rmg-color-white)',
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: 'var(--rmg-text-b3)',
                  lineHeight: '1',
                  fontWeight: 700,
                }}
              >
                T
              </div>
            )}
          </div>

          <nav style={{ flex: 1, overflow: 'hidden' }}>
            {NAV_SECTIONS.map((section, idx) => (
              <div
                key={section.label}
                style={{ marginBottom: 'var(--rmg-spacing-04)' }}
              >
                {!isCollapsed && (
                  <div
                    style={{
                      paddingLeft: 'var(--rmg-spacing-04)',
                      paddingRight: 'var(--rmg-spacing-04)',
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-c2)',
                      lineHeight: 'var(--rmg-leading-c2)',
                      color: 'var(--rmg-color-text-light)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 'var(--rmg-spacing-02)',
                      marginTop: idx === 0 ? 0 : 'var(--rmg-spacing-02)',
                    }}
                  >
                    {section.label}
                  </div>
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

          <div>
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
                  padding: `var(--rmg-spacing-03) var(--rmg-spacing-04)`,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--rmg-color-text-light)',
                  marginTop: 'var(--rmg-spacing-02)',
                }}
              >
                {isCollapsed ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronLeft size={16} />
                )}
              </button>
            )}
          </div>
        </div>
      </aside>

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
  )
}

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>

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
  return (
    <div
      style={{
        paddingLeft: 'var(--rmg-spacing-02)',
        paddingRight: 'var(--rmg-spacing-02)',
        marginBottom: 2,
      }}
    >
      <a
        href={href}
        title={collapsed ? label : undefined}
        style={{ display: 'block', textDecoration: 'none' }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--rmg-spacing-03)',
            padding: `var(--rmg-spacing-02) var(--rmg-spacing-03)`,
            borderRadius: 'var(--rmg-radius-s)',
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-b3)',
            lineHeight: 'var(--rmg-leading-b3)',
            color: active
              ? 'var(--rmg-color-red)'
              : 'var(--rmg-color-text-body)',
            backgroundColor: active
              ? 'var(--rmg-color-tint-red)'
              : 'transparent',
            fontWeight: active ? 700 : 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            justifyContent: collapsed ? 'center' : 'flex-start',
            minWidth: 0,
          }}
        >
          <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
          {!collapsed && label}
        </span>
      </a>
    </div>
  )
}
