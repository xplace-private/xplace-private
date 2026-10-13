import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'

import { AuthScreen } from '../../features/auth/auth-screen'

export const Route = createFileRoute('/auth/sign-in')({ component: SignInRoute })

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function SignInRoute() {
  const { authGateway } = Route.useRouteContext()
  const router = useRouter()
  const navigate = useNavigate()

  return <AuthScreen session="anonymous" gateway={authGateway} onSessionChanged={() => router.invalidate()} onForgotPassword={() => void navigate({ to: '/auth/forgot-password' })} />
}
