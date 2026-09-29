import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { NAV_LABELS } from '@/app/_components/navLabels'

// page.tsx here is a client component and cannot export metadata, so the
// route's tab title lives on this pass-through server layout instead.
export const metadata: Metadata = { title: NAV_LABELS.components }

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return children
}
