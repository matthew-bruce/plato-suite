import Link from 'next/link'
import {
  LayoutGrid,
  Building2,
  Users,
  UserCircle,
  Truck,
  CalendarRange,
  ReceiptText,
  Layers,
  Settings,
  Palette,
} from 'lucide-react'

// Route-scoped shell for the Platform Schedule page.
// The pre-existing NucleusShell is platform-scoped (under /platforms/[slug]),
// so this scope-limited layout matches the spec's grouping
// (Overview / Organisation / Finance / Design System / Settings).
// Will be generalised once more finance pages exist.

const TOP_NAV_BG = '#2A2A2D'
const SIDEBAR_WIDTH = 240
const TOP_NAV_HEIGHT = 44

type NavGroup = {
  heading: string
  items: { label: string; href: string; icon: typeof LayoutGrid; active?: boolean }[]
}

const SIDEBAR_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutGrid, href: '/' }],
  },
  {
    heading: 'Organisation',
    items: [
      { label: 'Org Structure', icon: Building2, href: '#' },
      { label: 'Teams', icon: Users, href: '#' },
      { label: 'Resources', icon: UserCircle, href: '#' },
      { label: 'Suppliers', icon: Truck, href: '#' },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { label: 'Platform Schedule', icon: CalendarRange, href: '/schedule', active: true },
      { label: 'Rate Cards', icon: ReceiptText, href: '#' },
      { label: 'Periods', icon: Layers, href: '#' },
    ],
  },
  {
    heading: 'Design System',
    items: [{ label: 'Components', icon: Palette, href: '/design-system' }],
  },
  {
    heading: 'Settings',
    items: [{ label: 'Settings', icon: Settings, href: '#' }],
  },
]

const SUITE_APPS = [
  { label: 'Nucleus', active: true },
  { label: 'Tessera' },
  { label: 'Despatch' },
  { label: 'Chronicle' },
  { label: 'Cursus' },
]

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--rmg-color-surface-light)' }}>
      {/* Suite top nav */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: TOP_NAV_HEIGHT,
          backgroundColor: TOP_NAV_BG,
          color: 'var(--rmg-color-white)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '32px',
          zIndex: 100,
          fontFamily: 'var(--rmg-font-body)',
          fontSize: '13px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            fontSize: '15px',
            color: 'var(--rmg-color-white)',
          }}
        >
          Plato Suite
        </div>
        <nav style={{ display: 'flex', gap: '18px' }} aria-label="Suite apps">
          {SUITE_APPS.map((app) => (
            <span
              key={app.label}
              style={{
                fontWeight: app.active ? 700 : 500,
                color: app.active
                  ? 'var(--rmg-color-yellow)'
                  : 'rgba(255,255,255,0.7)',
                cursor: 'default',
              }}
            >
              {app.label}
            </span>
          ))}
        </nav>
      </div>

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: TOP_NAV_HEIGHT,
          left: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          backgroundColor: 'var(--rmg-color-white)',
          borderRight: '1px solid var(--rmg-color-grey-3)',
          overflowY: 'auto',
          padding: '16px 8px',
          zIndex: 90,
        }}
      >
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.heading} style={{ marginBottom: 16 }}>
            <div
              style={{
                padding: '6px 10px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--rmg-color-grey-1)',
              }}
            >
              {group.heading}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon
              const isLink = item.href !== '#'
              const inner = (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 10px',
                    borderRadius: 'var(--rmg-radius-xs)',
                    fontSize: '13px',
                    color: item.active
                      ? 'var(--rmg-color-red)'
                      : isLink
                        ? 'var(--rmg-color-text-body)'
                        : 'var(--rmg-color-grey-1)',
                    backgroundColor: item.active
                      ? 'var(--rmg-color-tint-red)'
                      : 'transparent',
                    fontWeight: item.active ? 700 : 500,
                  }}
                >
                  <Icon size={16} strokeWidth={item.active ? 2.4 : 1.75} />
                  {item.label}
                </span>
              )
              return isLink ? (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{ display: 'block', textDecoration: 'none' }}
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={item.label}
                  title="Not yet implemented"
                  style={{ cursor: 'not-allowed' }}
                >
                  {inner}
                </div>
              )
            })}
          </div>
        ))}
      </aside>

      {/* Main */}
      <main
        style={{
          marginTop: TOP_NAV_HEIGHT,
          marginLeft: SIDEBAR_WIDTH,
          minHeight: `calc(100vh - ${TOP_NAV_HEIGHT}px)`,
        }}
      >
        {children}
      </main>
    </div>
  )
}
