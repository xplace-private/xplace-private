import { createFileRoute, useRouter } from '@tanstack/react-router'

import { AuthScreen } from '../../features/auth/auth-screen'

export const Route = createFileRoute('/auth/authenticator')({ component: AuthenticatorRoute })

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function AuthenticatorRoute() {
  const { authGateway, authSession } = Route.useRouteContext()
  const router = useRouter()

  return <AuthScreen key={authSession} session={authSession === 'two-factor-required' ? 'two-factor-required' : 'authenticator-required'} gateway={authGateway} onSessionChanged={() => router.invalidate()} />
}
