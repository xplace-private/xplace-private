import { createRootRouteWithContext, redirect } from '@tanstack/react-router'

import { RouteError, RouteNotFound } from '../route-boundaries'
import { resolveRouteSession } from '../route-session-resolver'
import type { AppRouterContext } from '../router-context'
import { RootRoute } from '../root-route'
import { SessionRoutePending } from '../session-route-pending'

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context, location }) => {
    const decision = await resolveRouteSession(context, location.pathname)
    if (decision.kind === 'redirect') {
      throw redirect({ to: decision.to, replace: true })
    }
    return { routeAccess: decision.access }
  },
  component: RootRouteComponent,
  pendingComponent: SessionRoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
})

// TanStack file routes must export Route alongside their local component.
// eslint-disable-next-line react-refresh/only-export-components
function RootRouteComponent() {
  const { routeAccess } = Route.useRouteContext()
  return <RootRoute routeAccess={routeAccess} />
}
