import { reportReactError } from './app/sentry'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './app/crowdin'
import { reloadOnStaleChunk } from './app/reload-on-stale-chunk'
import { router } from './app/router'
import './app/styles.css'

const stopStaleChunkRecovery = reloadOnStaleChunk()
import.meta.hot?.dispose(stopStaleChunkRecovery)

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('React root element was not found')
}

createRoot(
  rootElement,
  import.meta.env.PROD
    ? {
        onUncaughtError: reportReactError,
        onCaughtError: (error, info) => reportReactError(error, info, true),
        onRecoverableError: (error, info) => reportReactError(error, info, true),
      }
    : undefined,
).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
