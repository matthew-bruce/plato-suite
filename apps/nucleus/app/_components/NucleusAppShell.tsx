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

const APP_URLS = {
  nucleus:   'https://plato-nucleus.vercel.app',
  tessera:   'https://plato-tessera.vercel.app',
  despatch:  '#',
  chronicle: '#',
  cursus:    '#',
}

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
      { label: 'Org Structure', icon: <Building2 size={16} />,  href: '#' },
      { label: 'Teams',         icon: <Users size={16} />,      href: '#' },
      { label: 'Resources',     icon: <UserCircle size={16} />, href: '#' },
      { label: 'Suppliers',     icon: <Truck size={16} />,      href: '#' },
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

const CONFIG_ITEMS: ConfigItem[] = [
  { label: 'Settings', icon: <Settings size={16} />, href: '#' },
]

export function NucleusAppShell({ children }: { children: ReactNode }) {
  return (
    <PlatoShell
      activeApp="nucleus"
      appName="Nucleus"
      appSubtitle="eBusiness Platform"
      navSections={NAV_SECTIONS}
      configItems={CONFIG_ITEMS}
      appUrls={APP_URLS}
    >
      {children}
    </PlatoShell>
  )
}
