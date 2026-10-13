import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'

import { SignOutButton } from '../../features/auth/sign-out-button'
import { HomeScreen } from '../../features/home/home-screen'
import { ProfileSessionError } from '../../features/profile/api/profile-gateway'
import { profileQuery } from '../../features/profile/profile-queries'

export const Route = createFileRoute('/home')({ component: HomeRoute })

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function HomeRoute() {
  const { authGateway, homeGateway, profileGateway } = Route.useRouteContext()
  const router = useRouter()
  const onSessionChanged = useCallback(() => router.invalidate(), [router])
  const profile = useQuery(profileQuery(profileGateway))
  useEffect(() => {
    if (profile.error instanceof ProfileSessionError) void onSessionChanged().catch(() => undefined)
  }, [profile.error, onSessionChanged])
  return <HomeScreen gateway={homeGateway} onSessionChanged={onSessionChanged} knownCompanyName={profile.data?.company} companyNameLoading={profile.isPending} signOut={<SignOutButton gateway={authGateway} onSessionChanged={onSessionChanged} />} onProfile={() => void router.navigate({ to: '/profile' })} onHome={() => void router.navigate({ to: '/home' })} />
}
