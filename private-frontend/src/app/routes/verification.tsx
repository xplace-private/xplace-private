import {
  createFileRoute,
  Outlet,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useCallback } from 'react'

import { useAuthFlow } from '../../features/auth/auth-flow-provider'
import { VerificationScreen } from '../../features/verification/verification-screen'
import { completeVerification, startSumsubVerification } from '../navigation'

export const Route = createFileRoute('/verification')({
  component: VerificationRoute,
})

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function VerificationRoute() {
  const router = useRouter()
  const { signOut } = useAuthFlow()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const showHome = useCallback(() => {
    completeVerification(router.history)
  }, [router.history])
  const showSumsub = useCallback(() => {
    startSumsubVerification(router.history)
  }, [router.history])

  if (pathname === '/verification/sumsub') return <Outlet />

  return (
    <VerificationScreen
      onStartSdk={showSumsub}
      onCompleted={showHome}
      onSignOut={signOut}
    />
  )
}
