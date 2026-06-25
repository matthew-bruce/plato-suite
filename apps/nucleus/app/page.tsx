import { redirect } from 'next/navigation'

// TEMP: defaulting home to Schedule until Dashboard is fixed.
// Revert to Dashboard (see app/dashboard/page.tsx) once ready.
export default function HomePage() {
  redirect('/schedule')
}
