import * as Sentry from '@sentry/react'
import { isNotFound } from '@tanstack/react-router'

import type { CurrentUser } from '../features/auth/api/current-user-gateway'
import type { ApiClientOptions } from '../shared/api/api-client'

const SECRET_FIELD = /password|passwd|token|secret|authorization|cookie|otp|(?:^|[_-])pin(?:$|[_-])|^(?:code|pan|cvv|cvc|card_?number|security_?code)$/i
const reportedErrors = new Set<string>()

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'https://743e59b7a977c4e8f32fb4990faf7fd0@o4509822456692736.ingest.us.sentry.io/4512175739109376',
    environment: import.meta.env.MODE,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: ['outgoingRequest'],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    sampleRate: 1,
    tracesSampleRate: 0.1,
    // Backend CORS does not allow Sentry tracing headers yet.
    tracePropagationTargets: [],
    enhanceFetchErrorMessages: 'report-only',
    integrations: (defaults) => defaults.filter(({ name }) => name !== 'Console' && name !== 'Dedupe'),
    beforeBreadcrumb(breadcrumb) {
      const data = breadcrumb.data
      if (data) {
        for (const key of ['url', 'from', 'to']) {
          const value = data[key]
          if (typeof value === 'string') {
            data[key] = value.split(/[?#]/)[0]
          }
        }
      }
      return breadcrumb
    },
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/[?#].*$/, '')
      }
      if (event.request) {
        delete event.request.headers
        delete event.request.cookies
        if (event.request.data !== undefined) {
          try {
            event.request.data = JSON.stringify(event.request.data, (key, value: unknown) =>
              SECRET_FIELD.test(key) ? '[Filtered]' : value,
            )
          } catch {
            event.request.data = '[Unserializable request body]'
          }
        }
      }
      const key = JSON.stringify([
        event.exception?.values?.map(({ type, value, stacktrace, mechanism }) =>
          [type, value, stacktrace, mechanism?.handled]),
        event.message,
        event.level,
        event.fingerprint,
        event.user?.id,
        event.request?.url,
        event.request?.method,
        event.request?.data,
        event.contexts?.response,
      ])
      if (reportedErrors.has(key)) return null
      // ponytail: remember the last 100 errors per page; older errors may be sent again.
      if (reportedErrors.size >= 100) {
        const oldest = reportedErrors.values().next().value
        if (oldest !== undefined) reportedErrors.delete(oldest)
      }
      reportedErrors.add(key)
      return event
    },
  })
}

export function setSentryUser(user: Pick<CurrentUser, 'id' | 'email'> | null) {
  Sentry.setUser(user === null ? null : {
    id: String(user.id),
    ...(user.email === null ? {} : { email: user.email }),
  })
}

export function reportReactError(
  error: unknown,
  { componentStack }: { componentStack?: string | null | undefined },
) {
  if (isNotFound(error)) return
  Sentry.reactErrorHandler()(error, { componentStack: componentStack ?? null })
}

export const reportApiRequestError: NonNullable<ApiClientOptions['onRequestError']> =
  (error, request) => {
    if (!Sentry.isEnabled()) return
    Sentry.withScope((scope) => {
      scope.addEventProcessor((event) => ({ ...event, request }))
      scope.setContext('response', { status_code: error.status })
      Sentry.captureException(error)
    })
  }
