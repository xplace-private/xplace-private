import {
  addIntegration,
  tanstackRouterBrowserTracingIntegration,
} from '@sentry/react'
import { createRouter } from '@tanstack/react-router'

import { appRuntime } from './app-runtime'
import { routeTree } from './routeTree.gen'
import {
  observeSessionRouteAccess,
  registerSessionRouteObserverDisposal,
} from './session-route-observer'

export const router = createRouter({
  routeTree,
  context: appRuntime,
  scrollRestoration: true,
})

if (import.meta.env.PROD) {
  addIntegration(tanstackRouterBrowserTracingIntegration(router))
}

const stopObservingSessionRouteAccess = observeSessionRouteAccess(
  appRuntime.authSessionStore,
  router,
)
registerSessionRouteObserverDisposal(
  import.meta.hot,
  stopObservingSessionRouteAccess,
)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
