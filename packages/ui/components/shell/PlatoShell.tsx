'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCurrentUser, signOut, onAuthStateChange } from '@plato/auth'

// Adding a new app to the suite: add its key to the activeApp union type below
// and add an entry to the PLATO_APPS array in this file.

export interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  exactMatch?: boolean
}

export interface NavSection {
  heading?: string
  items: NavItem[]
}

export interface ConfigItem {
  label: string
  href?: string
  icon?: React.ReactNode
  element?: React.ReactNode
}

export interface PlatoShellProps {
  activeApp: 'nucleus' | 'tessera' | 'despatch' | 'chronicle' | 'cursus'
  appName: string
  appSubtitle?: string
  navSections: NavSection[]
  configItems?: ConfigItem[]
  children: React.ReactNode
  userInitials?: string
  appUrls?: {
    nucleus?: string
    tessera?: string
    despatch?: string
    chronicle?: string
    cursus?: string
  }
}

const HEADER_HEIGHT = 40
const SIDEBAR_EXPANDED = 220
const SIDEBAR_COLLAPSED = 56
const MOBILE_BREAKPOINT = 768
const LS_KEY = 'plato_nav_collapsed'

type AppKey = 'nucleus' | 'tessera' | 'despatch' | 'chronicle' | 'cursus'

const PLATO_APPS: Array<{ id: AppKey; label: string }> = [
  { id: 'nucleus',   label: 'Nucleus'   },
  { id: 'tessera',   label: 'Tessera'   },
  { id: 'despatch',  label: 'Despatch'  },
  { id: 'chronicle', label: 'Chronicle' },
  { id: 'cursus',    label: 'Cursus'    },
]

const DEFAULT_APP_URLS: Record<AppKey, string> = {
  nucleus:   'https://plato-nucleus.vercel.app',
  tessera:   'https://plato-suite-tessera.vercel.app',
  despatch:  '#',
  chronicle: '#',
  cursus:    '#',
}

export function PlatoShell({
  activeApp,
  appName,
  appSubtitle,
  navSections,
  configItems,
  children,
  userInitials,
  appUrls,
}: PlatoShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
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
  const resolvedUrls = { ...DEFAULT_APP_URLS, ...appUrls }

  function isActive(href: string, exactMatch?: boolean): boolean {
    if (exactMatch || href === '/') return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ── Global header — full viewport width, above sidebar ── */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_HEIGHT,
          backgroundColor: '#2A2A2D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 16,
          paddingRight: 16,
          zIndex: 100,
          boxSizing: 'border-box',
        }}
      >
        {/* Left: red square logo mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              backgroundColor: '#DA202A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            P
          </div>
          <span
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 14,
              fontWeight: 700,
              color: '#ffffff',
              userSelect: 'none',
            }}
          >
            Plato{' '}
            <span style={{ color: '#DA202A' }}>Suite</span>
          </span>
        </div>

        {/* Right: app switcher links + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {PLATO_APPS.map((app) => (
            <AppSwitcherLink
              key={app.id}
              href={resolvedUrls[app.id]}
              label={app.label}
              isActive={app.id === activeApp}
            />
          ))}
          <AccountMenu userInitials={userInitials} />
        </div>
      </header>

      {/* ── Sidebar — fixed, starts below the header ── */}
      <aside
        style={{
          position: 'fixed',
          top: HEADER_HEIGHT,
          left: 0,
          bottom: 0,
          width: sidebarWidth,
          backgroundColor: '#ffffff',
          borderRight: '1px solid #EEEEEE',
          transition: 'width 200ms ease',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 90,
          boxSizing: 'border-box',
        }}
      >
        {/* App header zone */}
        <div
          style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 14,
            paddingBottom: 12,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            borderBottom: '1px solid #EEEEEE',
          }}
        >
          {!isCollapsed ? (
            <>
              <div
                style={{
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#2A2A2D',
                  marginBottom: 2,
                  lineHeight: 1.2,
                }}
              >
                {appName}
              </div>
              {appSubtitle && (
                <div
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 11,
                    color: '#8F9495',
                    lineHeight: 1.4,
                  }}
                >
                  {appSubtitle}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: '#DA202A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontFamily: 'var(--rmg-font-display)',
                fontSize: 14,
                fontWeight: 700,
                userSelect: 'none',
              }}
            >
              {appName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Nav sections */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingTop: 6,
          }}
        >
          {navSections.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: 4 }}>
              {!isCollapsed && section.heading && (
                <div
                  style={{
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: sIdx === 0 ? 4 : 10,
                    paddingBottom: 3,
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#8F9495',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {section.heading}
                </div>
              )}
              {section.items.map((item, iIdx) => (
                <NavItemEl
                  key={iIdx}
                  item={item}
                  active={isActive(item.href, item.exactMatch)}
                  collapsed={isCollapsed}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Configuration section + collapse toggle */}
        <div style={{ flexShrink: 0 }}>
          {configItems && configItems.length > 0 && (
            <>
              <div
                style={{
                  height: 1,
                  backgroundColor: '#EEEEEE',
                  margin: '4px 10px',
                }}
              />
              {!isCollapsed && (
                <div
                  style={{
                    paddingLeft: 14,
                    paddingTop: 6,
                    paddingBottom: 3,
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#8F9495',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Configuration
                </div>
              )}
              {configItems.map((item, cIdx) =>
                item.element ? (
                  <div key={cIdx} style={{ padding: '2px 6px' }}>
                    {item.element}
                  </div>
                ) : (
                  <NavItemEl
                    key={cIdx}
                    item={{
                      label: item.label,
                      href: item.href ?? '#',
                      icon: item.icon,
                    }}
                    active={item.href ? isActive(item.href) : false}
                    collapsed={isCollapsed}
                  />
                )
              )}
            </>
          )}
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
                color: '#8F9495',
                marginTop: 2,
                marginBottom: 8,
                boxSizing: 'border-box',
              }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}
        </div>
      </aside>

      {/* ── Content area ── */}
      <div
        style={{
          marginLeft: sidebarWidth,
          paddingTop: HEADER_HEIGHT,
          minHeight: '100vh',
          transition: 'margin-left 200ms ease',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Nav item with hover state ─────────────────────────────────────────────────

function NavItemEl({
  item,
  active,
  collapsed,
}: {
  item: Pick<NavItem, 'label' | 'href'> & { icon?: React.ReactNode }
  active: boolean
  collapsed: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const bg = active ? '#F8E7E7' : hovered ? '#F5F5F5' : 'transparent'
  const color = active ? '#DA202A' : hovered ? '#2A2A2D' : '#666666'
  const fontWeight = active ? 600 : 500

  return (
    <a
      href={item.href}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: '8px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 13,
        fontWeight,
        width: 'calc(100% - 12px)',
        margin: '1px 6px',
        backgroundColor: bg,
        color,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        justifyContent: collapsed ? 'center' : 'flex-start',
        boxSizing: 'border-box',
        borderLeft: active ? '2px solid #DA202A' : '2px solid transparent',
        transition: 'background-color 150ms ease, color 150ms ease',
      }}
    >
      {item.icon !== undefined && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'currentColor',
          }}
        >
          {item.icon}
        </span>
      )}
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.label}
        </span>
      )}
    </a>
  )
}

// ── App switcher link with hover state ────────────────────────────────────────

function AppSwitcherLink({
  href,
  label,
  isActive,
}: {
  href: string
  label: string
  isActive: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 11,
        fontWeight: isActive ? 700 : 400,
        color: isActive
          ? '#ffffff'
          : hovered
          ? 'rgba(255,255,255,0.85)'
          : 'rgba(255,255,255,0.55)',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        padding: '4px 8px',
        borderBottom: isActive
          ? '2px solid #DA202A'
          : '2px solid transparent',
        backgroundColor:
          hovered && !isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
        borderRadius: 3,
        cursor: 'pointer',
        lineHeight: '18px',
        display: 'inline-block',
        transition: 'color 150ms ease, background-color 150ms ease',
      }}
    >
      {label}
    </a>
  )
}

// ── User avatar ───────────────────────────────────────────────────────────────

function deriveInitials(email: string | null): string {
  if (!email) return '?'
  const local = email.split('@')[0]
  const parts = local.split(/[.\-_]+/).filter(Boolean)
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return chars.toUpperCase() || '?'
}

// Avatar-triggered account menu. Self-contained in the shared shell (ADR-032):
// reads the signed-in user and signs out via @plato/auth directly, so no app
// wires this up per-app. Only ever rendered for authenticated users — the app
// shells bypass PlatoShell on the public auth routes.
function AccountMenu({ userInitials }: { userInitials?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    getCurrentUser().then((u) => {
      if (active) setEmail(u?.email ?? null)
    })
    const unsubscribe = onAuthStateChange((u) => setEmail(u?.email ?? null))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    // Full-session clear happened client-side; navigate to /login and refresh
    // so middleware re-evaluates with the cleared cookies.
    router.replace('/login')
    router.refresh()
  }

  const initials = userInitials ?? deriveInitials(email)

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginLeft: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={email ?? 'Account'}
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          backgroundColor: '#DA202A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 34,
            right: 0,
            minWidth: 210,
            background: '#FFFFFF',
            border: '1px solid var(--rmg-color-grey-3)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            overflow: 'hidden',
            fontFamily: 'var(--rmg-font-body)',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--rmg-color-grey-3)' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--rmg-color-grey-1)',
              }}
            >
              Signed in as
            </div>
            <div style={{ fontSize: 13, color: 'var(--rmg-color-text-heading)', marginTop: 2, wordBreak: 'break-all' }}>
              {email ?? '—'}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              cursor: signingOut ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--rmg-color-red)',
              fontFamily: 'var(--rmg-font-body)',
            }}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
