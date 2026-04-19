'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid,
  GitBranch,
  Users,
  UserCircle,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

export type PlatformOption = {
  platform_slug: string
  platform_name: string
  platform_code: string
}

interface NucleusShellProps {
  children: React.ReactNode
  platforms: PlatformOption[]
  activePlatformSlug: string | null
}

const SIDEBAR_EXPANDED = 240
const SIDEBAR_COLLAPSED = 52
const LS_KEY = 'nucleus_nav_collapsed'

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutGrid, path: 'overview' },
  { label: 'Workstreams', icon: GitBranch, path: 'workstreams' },
  { label: 'Teams', icon: Users, path: 'teams' },
  { label: 'Resources', icon: UserCircle, path: 'resources' },
  { label: 'Periods', icon: Calendar, path: 'periods' },
] as const

export function NucleusShell({
  children,
  platforms,
  activePlatformSlug,
}: NucleusShellProps) {
  const pathname = usePathname()
  const router = useRouter()
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

  function handlePlatformChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const slug = e.target.value
    if (slug) router.push(`/platforms/${slug}/overview`)
  }

  const isCollapsed = collapsed || isMobile
  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED

  function getNavHref(path: string) {
    if (!activePlatformSlug) return '#'
    return `/platforms/${activePlatformSlug}/${path}`
  }

  function isActive(path: string) {
    if (!activePlatformSlug) return false
    return pathname === `/platforms/${activePlatformSlug}/${path}`
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
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
        {/* Red accent stripe */}
        <div
          style={{
            width: 3,
            flexShrink: 0,
            backgroundColor: 'var(--rmg-color-red)',
            alignSelf: 'stretch',
          }}
        />

        {/* Sidebar content */}
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
          {/* Brand */}
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
                  Nucleus
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
                  Org &amp; Resource management
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
                N
              </div>
            )}
          </div>

          {/* Platform switcher */}
          {!isCollapsed && (
            <div
              style={{
                paddingLeft: 'var(--rmg-spacing-04)',
                paddingRight: 'var(--rmg-spacing-04)',
                marginBottom: 'var(--rmg-spacing-06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-c2)',
                  lineHeight: 'var(--rmg-leading-c2)',
                  color: 'var(--rmg-color-text-light)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--rmg-spacing-02)',
                }}
              >
                Platform
              </div>
              <select
                value={activePlatformSlug ?? ''}
                onChange={handlePlatformChange}
                style={{
                  display: 'block',
                  width: '100%',
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-b3)',
                  lineHeight: 'var(--rmg-leading-b3)',
                  color: 'var(--rmg-color-text-body)',
                  backgroundColor: 'var(--rmg-color-surface-light)',
                  border: '1px solid var(--rmg-color-grey-2)',
                  borderRadius: 'var(--rmg-radius-s)',
                  padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
                  cursor: 'pointer',
                }}
              >
                {platforms.map((p) => (
                  <option key={p.platform_slug} value={p.platform_slug}>
                    {p.platform_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Management nav */}
          <nav style={{ flex: 1, overflow: 'hidden' }}>
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
                }}
              >
                Management
              </div>
            )}
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.path}
                label={item.label}
                Icon={item.icon}
                href={getNavHref(item.path)}
                active={isActive(item.path)}
                collapsed={isCollapsed}
                disabled={!activePlatformSlug}
              />
            ))}
          </nav>

          {/* Bottom: Settings + collapse toggle */}
          <div>
            <NavItem
              label="Settings"
              Icon={Settings}
              href={getNavHref('settings')}
              active={isActive('settings')}
              collapsed={isCollapsed}
              disabled={!activePlatformSlug}
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

      {/* Main content */}
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
  disabled,
}: {
  label: string
  Icon: LucideIcon
  href: string
  active: boolean
  collapsed: boolean
  disabled: boolean
}) {
  const inner = (
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
          : disabled
            ? 'var(--rmg-color-grey-1)'
            : 'var(--rmg-color-text-body)',
        backgroundColor: active ? 'var(--rmg-color-tint-red)' : 'transparent',
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
  )

  return (
    <div
      style={{
        paddingLeft: 'var(--rmg-spacing-02)',
        paddingRight: 'var(--rmg-spacing-02)',
        marginBottom: 2,
      }}
    >
      {disabled ? (
        <span
          title="Select a platform to navigate"
          style={{ display: 'block', cursor: 'not-allowed' }}
        >
          {inner}
        </span>
      ) : (
        <a
          href={href}
          title={collapsed ? label : undefined}
          style={{ display: 'block', textDecoration: 'none' }}
        >
          {inner}
        </a>
      )}
    </div>
  )
}
