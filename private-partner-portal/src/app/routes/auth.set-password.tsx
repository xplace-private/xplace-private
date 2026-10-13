import { createFileRoute, useRouter } from '@tanstack/react-router'

import { AuthScreen } from '../../features/auth/auth-screen'

export const Route = createFileRoute('/auth/set-password')({ component: SetPasswordRoute })

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function SetPasswordRoute() {
  const { authGateway } = Route.useRouteContext()
  const router = useRouter()

  return <AuthScreen session="password-required" gateway={authGateway} onSessionChanged={() => router.invalidate()} />
}
