import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { ForgotPasswordScreen } from '../../features/auth/password-recovery-screen'

export const Route = createFileRoute('/auth/forgot-password')({ component: ForgotPasswordRoute })

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function ForgotPasswordRoute() {
  const { authGateway } = Route.useRouteContext()
  const navigate = useNavigate()

  return <ForgotPasswordScreen gateway={authGateway} onBackToSignIn={() => void navigate({ to: '/auth/sign-in' })} />
}
