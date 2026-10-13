import { createFileRoute, useRouter } from '@tanstack/react-router'

import { useAuthFlow } from '../../features/auth/auth-flow-provider'
import { OnboardingScreen } from '../../features/onboarding/onboarding-screen'
import { useVerificationFlow } from '../../features/verification/verification-flow-provider'
import { completeOnboarding, returnToAuthentication } from '../navigation'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingRoute,
})

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function OnboardingRoute() {
  const router = useRouter()
  const { signOut } = useAuthFlow()
  const { invalidateApplicant } = useVerificationFlow()

  return (
    <OnboardingScreen
      onBackToAuth={() => void returnToAuthentication(router.history, signOut)}
      onCompleted={async () => {
        const applicant = await invalidateApplicant()
        if (
          applicant === null ||
          applicant.sumsubId === null ||
          applicant.sumsubId.trim() === ''
        ) {
          return false
        }

        completeOnboarding(router.history)
        return true
      }}
    />
  )
}
