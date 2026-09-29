import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { NAV_LABELS } from '@/app/_components/navLabels'

export const metadata: Metadata = { title: NAV_LABELS.dashboard }

// TEMP: defaulting home to Schedule until Dashboard is fixed.
// Revert to Dashboard (see app/dashboard/page.tsx) once ready.
export default function HomePage() {
  redirect('/schedule')
}
