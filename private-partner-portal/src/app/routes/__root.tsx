import { createRootRouteWithContext, redirect } from '@tanstack/react-router'

import type { AppRuntime } from '../app-runtime'
import { RouteError, RouteNotFound, RoutePending } from '../route-boundaries'
import { RootRoute } from '../root-route'
import { queryClient } from '../query-client'

export const Route = createRootRouteWithContext<AppRuntime>()({
  beforeLoad: async ({ context, location, abortController }) => {
    if (location.pathname === '/auth/forgot-password' || location.pathname === '/auth/reset-password') {
      return { authSession: 'anonymous' as const }
    }
    const authSession = await context.authGateway.getSession()
    abortController.signal.throwIfAborted()
    if (authSession !== 'authenticated') {
      queryClient.removeQueries({ queryKey: ['auth'] })
      queryClient.removeQueries({ queryKey: ['home'] })
      queryClient.removeQueries({ queryKey: ['profile'] })
    }
    const destination = ({
      anonymous: '/auth/sign-in',
      'authenticator-required': '/auth/authenticator',
      'two-factor-required': '/auth/authenticator',
      'password-required': '/auth/set-password',
      authenticated: '/home',
    } as const)[authSession]
    if (location.pathname !== destination && !(authSession === 'authenticated' && location.pathname === '/profile')) {
      throw redirect({ to: destination, replace: true })
    }
    return { authSession }
  },
  component: RootRoute,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
})
