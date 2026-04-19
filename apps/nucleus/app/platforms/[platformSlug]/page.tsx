import { redirect } from 'next/navigation'

export default async function PlatformRootPage({
  params,
}: {
  params: Promise<{ platformSlug: string }>
}) {
  const { platformSlug } = await params
  redirect(`/platforms/${platformSlug}/overview`)
}
