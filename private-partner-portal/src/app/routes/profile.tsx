import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { SignOutButton } from '../../features/auth/sign-out-button'
import type { HomeOverview } from '../../features/home/api/home-gateway'
import { overviewQuery } from '../../features/home/home-queries'
import { ProfileScreen } from '../../features/profile/profile-screen'

export const Route = createFileRoute('/profile')({ component: ProfileRoute })

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function ProfileRoute() {
  const { authGateway, homeGateway, profileGateway } = Route.useRouteContext()
  const router = useRouter()
  const queryClient = useQueryClient()
  const onSessionChanged = useCallback(() => router.invalidate(), [router])
  const knownCompanyName = queryClient.getQueryData<HomeOverview>(overviewQuery(homeGateway).queryKey)?.partnerName
  return <ProfileScreen gateway={profileGateway} knownCompanyName={knownCompanyName} onSessionChanged={onSessionChanged} signOut={<SignOutButton gateway={authGateway} onSessionChanged={onSessionChanged} />} onHome={() => void router.navigate({ to: '/home' })} onProfile={() => void router.navigate({ to: '/profile' })} />
}
