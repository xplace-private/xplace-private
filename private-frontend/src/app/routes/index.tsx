import { createFileRoute } from '@tanstack/react-router'

import { AuthScreen } from '../../features/auth/auth-screen'
import { useAuthFlow } from '../../features/auth/auth-flow-provider'
import { useVerificationFlow } from '../../features/verification/verification-flow-provider'

export const Route = createFileRoute('/')({
  component: AuthRoute,
})

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function AuthRoute() {
  const { session, state } = useAuthFlow()
  const { applicantStatus } = useVerificationFlow()
  const postAuthenticationPending =
    session.status === 'authenticated' &&
    state.step === 'code' &&
    applicantStatus === 'loading'

  return <AuthScreen postAuthenticationPending={postAuthenticationPending} />
}
