import { createFileRoute } from '@tanstack/react-router'

import { useAuthFlow } from '../../features/auth/auth-flow-provider'
import { AuthenticatorScreen } from '../../features/auth/authenticator-screen'

export const Route = createFileRoute('/authenticator')({ component: AuthenticatorRoute })

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function AuthenticatorRoute() {
  const { authenticatorGateway, routeAccess } = Route.useRouteContext()
  const { completeTwoFactor, signOut } = useAuthFlow()
  if (routeAccess.status !== 'two-factor-required') return null

  return <AuthenticatorScreen key={routeAccess.requirement} gateway={authenticatorGateway} requirement={routeAccess.requirement} onCompleted={completeTwoFactor} onSignOut={signOut} />
}
