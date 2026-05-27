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
  Palette,
  Settings,
} from 'lucide-react'
import { PlatoShell } from '@plato/ui'
import type { NavSection, ConfigItem } from '@plato/ui'

const navSections: NavSection[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Dashboard', icon: <LayoutGrid size={16} />, href: '/', exactMatch: true },
    ],
  },
  {
    heading: 'Organisation',
    items: [
      { label: 'Org Structure',  icon: <Building2 size={16} />,  href: '#' },
      { label: 'Teams',          icon: <Users size={16} />,       href: '#' },
      { label: 'Resources',      icon: <UserCircle size={16} />,  href: '#' },
      { label: 'Suppliers',      icon: <Truck size={16} />,       href: '#' },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { label: 'Platform Schedule', icon: <CalendarRange size={16} />, href: '/schedule' },
      { label: 'Rate Cards',         icon: <ReceiptText size={16} />,   href: '#'         },
      { label: 'Periods',            icon: <Layers size={16} />,        href: '#'         },
    ],
  },
  {
    heading: 'Design System',
    items: [
      { label: 'Components', icon: <Palette size={16} />, href: '/design-system' },
    ],
  },
]

const configItems: ConfigItem[] = [
  { label: 'Settings', icon: <Settings size={16} />, href: '#' },
]

export default function ScheduleLayout({ children }: { children: ReactNode }) {
  return (
    <PlatoShell
      activeApp="nucleus"
      appName="Nucleus"
      appSubtitle="eBusiness Platform"
      navSections={navSections}
      configItems={configItems}
      appUrls={{ tessera: 'https://plato-tessera.vercel.app' }}
    >
      {children}
    </PlatoShell>
  )
}
