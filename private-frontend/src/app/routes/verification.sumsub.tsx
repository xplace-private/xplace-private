import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

import { SumsubVerificationScreen } from '../../features/verification/sumsub-verification-screen'
import { finishSumsubVerification } from '../navigation'

export const Route = createFileRoute('/verification/sumsub')({
  component: SumsubVerificationRoute,
})

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function SumsubVerificationRoute() {
  const router = useRouter()
  const exit = useCallback(() => {
    finishSumsubVerification(router.history)
  }, [router.history])

  return <SumsubVerificationScreen onExit={exit} />
}
