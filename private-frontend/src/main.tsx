import { reportReactError } from './app/sentry'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './app/crowdin'
import { reloadOnStaleChunk } from './app/reload-on-stale-chunk'
import { router } from './app/router'
import { initializeTheme } from './app/theme-config'
import './shared/api/app-env'
import './app/styles.css'

reloadOnStaleChunk()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('React root element was not found')
}

async function bootstrap(element: HTMLElement) {
  await initializeTheme()

  createRoot(
    element,
    import.meta.env.PROD
      ? {
          onUncaughtError: reportReactError,
          onCaughtError: reportReactError,
          onRecoverableError: reportReactError,
        }
      : undefined,
  ).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void bootstrap(rootElement)
