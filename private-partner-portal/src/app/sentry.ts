import * as Sentry from '@sentry/react'
import { isNotFound } from '@tanstack/react-router'

const SECRET_FIELD = /password|passwd|token|secret|authorization|cookie|otp|(?:^|[_-])pin(?:$|[_-])|^(?:code|pan|cvv|cvc|card_?number|security_?code)$/i
const reportedErrors = new Set<string>()

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'https://db1300b15a2806ad3eb3a74bc774a8a7@o4509822456692736.ingest.us.sentry.io/4512175745531904',
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
    // Send tracing headers only after the API CORS contract allows them.
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
            const data: unknown = typeof event.request.data === 'string'
              ? JSON.parse(event.request.data)
              : event.request.data
            event.request.data = JSON.stringify(data, (key, value: unknown) =>
              SECRET_FIELD.test(key) ? '[Filtered]' : value,
            )
          } catch {
            event.request.data = '[Filtered request body]'
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
        event.user?.email,
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

export function setSentryUser(user: { email: string } | null) {
  Sentry.setUser(user)
}

export function reportReactError(
  error: unknown,
  { componentStack }: { componentStack?: string | null | undefined },
  handled = false,
) {
  if (isNotFound(error)) return
  Sentry.captureReactException(error, { componentStack: componentStack ?? null }, {
    mechanism: { type: 'auto.function.react.error_handler', handled },
  })
}
