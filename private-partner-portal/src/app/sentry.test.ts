import * as Sentry from '@sentry/react'
import { notFound } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'

afterEach(async () => {
  Sentry.setUser(null)
  await Sentry.close()
  Sentry.getCurrentScope().setClient(undefined)
  vi.unstubAllEnvs()
  vi.resetModules()
})

test('captures React errors with request data while redacting secrets', async () => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('MODE', 'staging')
  const send = vi.fn().mockResolvedValue({ statusCode: 200 })
  const { reportReactError } = await import('./sentry')
  const configuration = Sentry.getClient()?.getOptions()
  expect(configuration).toMatchObject({
    dsn: 'https://db1300b15a2806ad3eb3a74bc774a8a7@o4509822456692736.ingest.us.sentry.io/4512175745531904',
    environment: 'staging',
    sampleRate: 1,
    tracesSampleRate: 0.1,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: ['outgoingRequest'],
      urlQueryParams: false,
    },
    tracePropagationTargets: [],
  })
  if (!configuration) throw new Error('Sentry was not initialized')
  await Sentry.close()
  Sentry.init({
    ...configuration,
    defaultIntegrations: false,
    enabled: true,
    transport: () => ({ send, flush: async () => true }),
  })
  reportReactError(notFound(), {})

  Sentry.addBreadcrumb({
    category: 'fetch',
    data: { url: 'https://back.x.place/api/users/?token=secret#private' },
  })
  Sentry.withScope((scope) => {
    scope.addEventProcessor((event) => ({
      ...event,
      request: {
        url: 'https://private.x.place/home?token=secret#private',
        headers: { Authorization: 'secret-authorization' },
        cookies: { session: 'secret-cookie' },
        data: {
          amount: 0,
          currency: 'USD',
          date: '2026-10-01',
          note: '',
          password: 'secret-password',
          new_pin: 'secret-pin',
          otp: 'secret-otp',
          details: [{ accessToken: 'secret-token', pan: 'secret-pan', cvc: 'secret-cvc' }],
        },
      },
    }))
    reportReactError(new Error('Integration check'), {
      componentStack: '\n    at BrokenScreen (src/app/test.tsx:1:1)',
    })
  })
  reportReactError(new Error('Caught error'), {}, true)
  await Sentry.flush(2000)

  expect(send).toHaveBeenCalledTimes(2)
  const envelope = JSON.stringify(send.mock.calls[0])
  expect(envelope).toContain('Integration check')
  expect(envelope).toContain('BrokenScreen')
  expect(envelope).toContain('https://back.x.place/api/users/')
  expect(envelope).toContain('https://private.x.place/home')
  expect(envelope).toContain('2026-10-01')
  expect(envelope).toContain('USD')
  expect(envelope).toContain('[Filtered]')
  expect(envelope).not.toContain('secret')
  expect(envelope).not.toContain('#private')
  expect(JSON.stringify(send.mock.calls[0])).toContain('"handled":false')
  expect(JSON.stringify(send.mock.calls[1])).toContain('"handled":true')
})

test('suppresses duplicates across other errors while keeping different request data', async () => {
  vi.stubEnv('PROD', true)
  await import('./sentry')
  const beforeSend = Sentry.getClient()?.getOptions().beforeSend
  if (!beforeSend) throw new Error('Sentry beforeSend was not configured')
  const event = () => ({ type: undefined, message: 'Repeated error', request: { data: { amount: 10, password: 'private' } } })
  expect(await beforeSend(event(), {})).not.toBeNull()
  expect(await beforeSend({ ...event(), request: { data: JSON.stringify({ amount: 10, password: 'private' }) } }, {})).toBeNull()
  const rawBody = await beforeSend({ type: undefined, message: 'Raw body', request: { data: 'password=private' } }, {})
  expect(rawBody).toHaveProperty('request.data', '[Filtered request body]')
  expect(await beforeSend({ type: undefined, message: 'Another error' }, {})).not.toBeNull()
  expect(await beforeSend(event(), {})).toBeNull()
  expect(await beforeSend({ ...event(), request: { data: { amount: 20 } } }, {})).not.toBeNull()
  for (let index = 0; index < 100; index += 1) {
    await beforeSend({ type: undefined, message: `Distinct error ${index}` }, {})
  }
  expect(await beforeSend(event(), {})).not.toBeNull()
})

test('does not initialize Sentry in local development', async () => {
  vi.stubEnv('PROD', false)
  await import('./sentry')
  expect(Sentry.isEnabled()).toBe(false)
})

test.each(['dev', 'staging', 'production'])('reports %s environment and keeps different users distinct', async (mode) => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('MODE', mode)
  const send = vi.fn<NonNullable<ReturnType<typeof Sentry.getClient>>['sendEnvelope']>()
    .mockResolvedValue({ statusCode: 200 })
  const { setSentryUser } = await import('./sentry')
  const configuration = Sentry.getClient()?.getOptions()
  if (!configuration) throw new Error('Sentry was not initialized')
  await Sentry.close()
  Sentry.init({
    ...configuration,
    defaultIntegrations: false,
    enabled: true,
    transport: () => ({ send, flush: async () => true }),
  })

  for (const user of [{ email: 'user@example.com' }, { email: 'another@example.com' }, null]) {
    setSentryUser(user)
    Sentry.captureMessage('Identity check')
    await Sentry.flush(2000)
  }

  const events = send.mock.calls.map(([envelope]) =>
    envelope[1].find(([header]) => header.type === 'event')?.[1])
  expect(events).toHaveLength(3)
  expect(events[0]).toMatchObject({ environment: mode, user: { email: 'user@example.com' } })
  expect(events[1]).toMatchObject({ environment: mode, user: { email: 'another@example.com' } })
  expect(JSON.stringify(events[1])).not.toContain('user@example.com')
  expect(JSON.stringify(events[2])).not.toContain('user@example.com')
  expect(events[2]).toHaveProperty('user.id', undefined)
})
