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
  GanttChartSquare,
} from 'lucide-react'
import { PlatoShell } from '@plato/ui'
import type { NavSection, ConfigItem } from '@plato/ui'
import { supabase } from '@/lib/supabase'
import type { ItineraryDay, ItinerarySession } from '@/app/itinerary/page'
import { ItineraryPanel } from './ItineraryPanel'

// Custom gauge icon — matches Tabler outline ti-gauge
function GaugeIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'KT Framework',
    items: [
      { label: 'Dashboard',  icon: <GaugeIcon />,          href: '/',          exactMatch: true },
      { label: 'Domains',    icon: <BookOpen size={16} />,      href: '/domains'   },
      { label: 'Timeline',   icon: <GanttChartSquare size={16} />, href: '/timeline'  },
      { label: 'Sessions',   icon: <ClipboardList size={16} />, href: '/sessions'  },
      { label: 'People',     icon: <Users size={16} />,         href: '/people'    },
    ],
  },
  {
    heading: 'Reference',
    items: [
      { label: 'Nuggets',    icon: <Star size={16} />,      href: '/nuggets'   },
      { label: 'Itinerary',  icon: <Calendar size={16} />,  href: '/itinerary' },
      { label: "Parker's 7", icon: <HelpCircle size={16} />, href: '/parker'   },
    ],
  },
]

const CONFIG_ITEMS: ConfigItem[] = [
  { label: 'Settings', icon: <Settings size={16} />, href: '/settings' },
]

export function TesseraAppShell({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [itineraryData, setItineraryData] = useState<{
    days: ItineraryDay[]
    sessions: ItinerarySession[]
  } | null>(null)
  const [itineraryLoading, setItineraryLoading] = useState(false)
  const hasFetched = useRef(false)

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

  return (
    <>
      <PlatoShell
        activeApp="tessera"
        appName="Tessera KT"
        appSubtitle="eBusiness Platform"
        navSections={NAV_SECTIONS}
        configItems={CONFIG_ITEMS}
      >
        {children}
      </PlatoShell>

      {/* ── Itinerary quick-view panel trigger ── */}
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
            borderRadius: '8px 0 0 8px',
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
    </>
  )
}
