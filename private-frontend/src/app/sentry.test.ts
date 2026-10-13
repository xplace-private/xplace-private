import * as Sentry from '@sentry/react'
import { notFound } from '@tanstack/react-router'
import { afterEach, expect, test, vi } from 'vitest'

import { ApiRequestError, createApiClient } from '../shared/api/api-client'

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
          code: 'secret-authenticator-code',
          details: [{ accessToken: 'secret-token', pan: 'secret-pan', cvc: 'secret-cvc' }],
        },
      },
    }))
    reportReactError(new Error('Integration check'), {
      componentStack: '\n    at BrokenScreen (src/app/test.tsx:1:1)',
    })
  })
  await Sentry.flush(2000)

  expect(send).toHaveBeenCalledOnce()
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
})

test('reports a final API failure with its JSON payload and status', async () => {
  vi.stubEnv('PROD', true)
  const send = vi.fn().mockResolvedValue({ statusCode: 200 })
  const { reportApiRequestError } = await import('./sentry')
  const configuration = Sentry.getClient()?.getOptions()
  if (!configuration) throw new Error('Sentry was not initialized')
  await Sentry.close()
  Sentry.init({
    ...configuration,
    defaultIntegrations: false,
    enabled: true,
    transport: () => ({ send, flush: async () => true }),
  })
  let attempts = 0
  const client = createApiClient({
    baseUrl: 'https://back.x.place/api/v1',
    onRequestError: reportApiRequestError,
    fetch: async () => {
      attempts += 1
      return Response.json({ detail: 'Invalid amount' }, { status: 500 })
    },
  })
  const json = { amount: -10, currency: 'USD', password: 'secret-password' }

  await expect(client.request('transfers/deposits/', {
    method: 'POST', json, retry: 1,
  })).rejects.toMatchObject({ kind: 'http', status: 500 })
  await Sentry.flush(2000)

  expect(attempts).toBe(2)
  expect(send).toHaveBeenCalledOnce()
  const envelope = JSON.stringify(send.mock.calls[0])
  expect(envelope).toContain('https://back.x.place/api/v1/transfers/deposits/')
  expect(envelope).toContain('POST')
  expect(envelope).toContain('status_code')
  expect(envelope).toContain('500')
  expect(envelope).toContain('-10')
  expect(envelope).toContain('USD')
  expect(envelope).not.toContain('secret-password')
  expect(json.password).toBe('secret-password')
})

test('suppresses repeated errors across other events but preserves different requests', async () => {
  vi.stubEnv('PROD', true)
  const send = vi.fn().mockResolvedValue({ statusCode: 200 })
  const { reportApiRequestError } = await import('./sentry')
  const configuration = Sentry.getClient()?.getOptions()
  if (!configuration) throw new Error('Sentry was not initialized')
  await Sentry.close()
  Sentry.init({
    ...configuration,
    defaultIntegrations: false,
    enabled: true,
    transport: () => ({ send, flush: async () => true }),
  })

  for (const [path, method, amount, status, password] of [
    ['deposits', 'POST', 10, 500, 'secret-a'],
    ['deposits', 'POST', 10, 500, 'secret-a'],
    ['deposits', 'POST', 20, 500, 'secret-a'],
    ['deposits', 'POST', 10, 500, 'secret-a'],
    ['withdrawals', 'POST', 10, 500, 'secret-a'],
    ['deposits', 'PATCH', 10, 500, 'secret-a'],
    ['deposits', 'POST', 10, 400, 'secret-a'],
    ['deposits', 'POST', 10, 500, 'secret-b'],
  ] as const) {
    const error = new ApiRequestError('http', status, null, `Request failed with status ${status}`)
    error.stack = `${error.name}: ${error.message}\n    at submit (https://private.x.place/assets/app.js:10:5)`
    reportApiRequestError(error, {
      url: `https://back.x.place/api/${path}/`, method, data: { amount, password },
    })
    await Sentry.flush(2000)
  }

  expect(send).toHaveBeenCalledTimes(5)
  const envelopes = JSON.stringify(send.mock.calls)
  expect(envelopes).toContain('20')
  expect(envelopes).toContain('withdrawals')
  expect(envelopes).toContain('PATCH')
  expect(envelopes).toContain('400')
  expect(envelopes).not.toContain('secret-')

  const event = {
    exception: { values: [{ type: 'Error', value: 'Browser test error' }] },
  }
  Sentry.captureEvent(event)
  await Sentry.flush(2000)
  Sentry.captureMessage('Another error')
  await Sentry.flush(2000)
  Sentry.captureEvent(event)
  await Sentry.flush(2000)
  expect(send).toHaveBeenCalledTimes(7)

  const beforeSend = configuration.beforeSend
  if (!beforeSend) throw new Error('Sentry beforeSend was not configured')
  const oldest = { type: undefined, message: 'Old error' }
  expect(await beforeSend(oldest, {})).not.toBeNull()
  expect(await beforeSend(oldest, {})).toBeNull()
  for (let index = 0; index < 100; index += 1) {
    await beforeSend({ type: undefined, message: `Distinct error ${index}` }, {})
  }
  expect(await beforeSend(oldest, {})).not.toBeNull()
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

  for (const user of [{ id: 42, email: 'user@example.com' }, { id: 43, email: null }, null]) {
    setSentryUser(user)
    Sentry.captureMessage('Identity check')
    await Sentry.flush(2000)
  }

  const events = send.mock.calls.map(([envelope]) =>
    envelope[1].find(([header]) => header.type === 'event')?.[1])
  expect(events).toHaveLength(3)
  expect(events[0]).toMatchObject({ environment: mode, user: { id: '42', email: 'user@example.com' } })
  expect(events[1]).toMatchObject({ environment: mode, user: { id: '43' } })
  expect(JSON.stringify(events[1])).not.toContain('user@example.com')
  expect(JSON.stringify(events[2])).not.toContain('user@example.com')
  expect(events[2]).toHaveProperty('user.id', undefined)
})
