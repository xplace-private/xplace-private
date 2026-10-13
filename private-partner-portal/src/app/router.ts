import { addIntegration, tanstackRouterBrowserTracingIntegration } from '@sentry/react'
import { createRouter } from '@tanstack/react-router'

import { appRuntime } from './app-runtime'
import { routeTree } from './routeTree.gen'
import { reportReactError } from './sentry'

export const router = createRouter({
  routeTree,
  context: appRuntime,
  scrollRestoration: true,
  ...(import.meta.env.PROD
    ? { defaultOnCatch: (error, info) => reportReactError(error, info, true) }
    : {}),
})

if (import.meta.env.PROD) {
  addIntegration(tanstackRouterBrowserTracingIntegration(router))
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
