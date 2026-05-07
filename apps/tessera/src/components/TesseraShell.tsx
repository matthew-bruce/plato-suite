'use client'

import { useState, useEffect, useRef } from 'react'
import {
  BookOpen,
  ClipboardList,
  Users,
  Star,
  Calendar,
  HelpCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  GanttChartSquare,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ItineraryDay, ItinerarySession } from '@/app/itinerary/page'
import { ItineraryPanel } from './ItineraryPanel'

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

// Inline SVG matching Tabler outline gauge icon (ti-gauge)
function GaugeIcon({ size = 16, color = 'currentColor', strokeWidth = 1.75 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M12 7v-4" />
      <path d="M6.457 10.197l-2.83 -1.631" />
      <path d="M17.543 10.197l2.83 -1.631" />
      <path d="M5 12a7 7 0 1 1 14 0" />
      <path d="M18 11.03l-5.97 2.427" />
    </svg>
  )
}

const NAV_SECTIONS: ReadonlyArray<NavSectionDef> = [
  {
    label: 'KT Framework',
    items: [
      { label: 'Dashboard', icon: GaugeIcon as LucideIcon, href: '/' },
      { label: 'Domains',   icon: BookOpen,                href: '/domains' },
      { label: 'Timeline',  icon: GanttChartSquare,        href: '/timeline' },
      { label: 'Sessions',  icon: ClipboardList,           href: '/sessions' },
      { label: 'People',    icon: Users,                   href: '/people' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Nuggets',    icon: Star,        href: '/nuggets' },
      { label: 'Itinerary',  icon: Calendar,    href: '/itinerary' },
      { label: "Parker's 7", icon: HelpCircle,  href: '/parker' },
    ],
  },
]

const PLATO_APPS = [
  { id: 'nucleus',   label: 'Nucleus',   url: 'https://plato-nucleus.vercel.app',   enabled: true },
  { id: 'tessera',   label: 'Tessera',   url: 'https://plato-tessera.vercel.app',   enabled: true },
  { id: 'despatch',  label: 'Despatch',  url: '#',                                  enabled: false },
  { id: 'chronicle', label: 'Chronicle', url: '#',                                  enabled: false },
  { id: 'cursus',    label: 'Cursus',    url: '#',                                  enabled: false },
]

export function TesseraShell({ children, activeRoute }: TesseraShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [itineraryData, setItineraryData] = useState<{ days: ItineraryDay[]; sessions: ItinerarySession[] } | null>(null)
  const [itineraryLoading, setItineraryLoading] = useState(false)
  const hasFetched = useRef(false)

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

  useEffect(() => {
    if (!isPanelOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsPanelOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPanelOpen])

  useEffect(() => {
    if (!isPanelOpen || hasFetched.current) return
    hasFetched.current = true
    setItineraryLoading(true)
    void (async () => {
      const [{ data: days }, { data: sessions }] = await Promise.all([
        supabase.from('tessera_itinerary_days').select('*').order('date'),
        supabase.from('tessera_itinerary_sessions').select('*').order('sort_order'),
      ])
      setItineraryData({
        days:     (days     ?? []) as ItineraryDay[],
        sessions: (sessions ?? []) as ItinerarySession[],
      })
      setItineraryLoading(false)
    })()
  }, [isPanelOpen])

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
      {/* ── Global top bar ── */}
      <div
        style={{
          height: 40,
          flexShrink: 0,
          backgroundColor: '#2A2A2D',
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
          Plato{' '}
          <span style={{ color: '#DA202A' }}>Suite</span>
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
                  fontSize: 11,
                  fontWeight: active ? 700 : 400,
                  color: active ? '#ffffff' : '#8F9495',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  borderBottom: active ? '2px solid #DA202A' : 'none',
                  paddingBottom: active ? 2 : 0,
                  lineHeight: '18px',
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
            backgroundColor: '#ffffff',
            borderRight: '1px solid #EEEEEE',
            transition: 'width 200ms ease',
            overflow: 'hidden',
            height: '100%',
          }}
        >
          {/* ── Brand header ── */}
          <div
            style={{
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 16,
              paddingBottom: 14,
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
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#2A2A2D',
                    marginBottom: 2,
                    lineHeight: 1.2,
                  }}
                >
                  Tessera{' '}
                  <span style={{ color: '#DA202A' }}>KT</span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 10,
                    color: '#8F9495',
                  }}
                >
                  eBusiness Platform
                </div>
              </>
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--rmg-radius-s)',
                  backgroundColor: '#DA202A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontFamily: 'var(--rmg-font-display)',
                  fontSize: 14,
                  fontWeight: 700,
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
              paddingTop: 6,
            }}
          >
            {NAV_SECTIONS.map((section, idx) => (
              <div key={section.label}>
                {idx > 0 && (
                  <div
                    style={{
                      height: 1,
                      backgroundColor: '#EEEEEE',
                      margin: '6px 10px',
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
              paddingBottom: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                height: 1,
                backgroundColor: '#EEEEEE',
                marginBottom: 6,
                marginLeft: 10,
                marginRight: 10,
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
                  color: '#8F9495',
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
            backgroundColor: '#ffffff',
          }}
        >
          {children}
        </main>
      </div>

      {/* ── RHS itinerary panel trigger ── */}
      {!isPanelOpen && (
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          title="Open itinerary"
          style={{
            position: 'fixed',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 40,
            width: 28,
            height: 72,
            backgroundColor: '#ffffff',
            border: '1px solid #EEEEEE',
            borderRight: 'none',
            borderRadius: 'var(--rmg-radius-s) 0 0 var(--rmg-radius-s)',
            boxShadow: '-2px 0 6px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Calendar size={14} color="#8F9495" />
        </button>
      )}

      {/* ── Backdrop ── */}
      {isPanelOpen && (
        <div
          onClick={() => setIsPanelOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.15)',
            zIndex: 49,
          }}
        />
      )}

      {/* ── Itinerary panel ── */}
      <ItineraryPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        isMobile={isMobile}
        days={itineraryData?.days ?? []}
        sessions={itineraryData?.sessions ?? []}
        loading={itineraryLoading}
      />
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
  let color = '#666666'
  let fontWeight = 500

  if (active) {
    bg = '#F8E7E7'
    color = '#DA202A'
    fontWeight = 600
  } else if (hovered) {
    bg = '#F5F5F5'
    color = '#2A2A2D'
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
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 12,
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
      }}
    >
      <Icon size={16} strokeWidth={active ? 2.5 : 1.75} color="currentColor" />
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      )}
    </a>
  )
}
