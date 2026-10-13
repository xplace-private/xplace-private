import { afterEach, describe, expect, test, vi } from 'vitest'

import { createApiClient } from '../../../shared/api/api-client'

import { createHttpSumsubTokenGateway } from './http-sumsub-token-gateway'

const failure = {
  ok: false,
  code: 'sumsub-token-failed',
  message: 'Something went wrong. Please try again.',
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('createHttpSumsubTokenGateway', () => {
  test('posts for a valid token and forwards the abort signal', async () => {
    const signal = new AbortController().signal
    const request = vi.fn().mockResolvedValue({ token: '_act-token', userId: '41' })

    await expect(createHttpSumsubTokenGateway({ request }).get(signal)).resolves.toEqual({
      ok: true,
      data: { token: '_act-token', userId: '41' },
    })
    expect(request).toHaveBeenCalledWith('sumsub/access-token/', {
      authenticated: true,
      method: 'POST',
      retry: 2,
      signal,
    })
  })

  test.each([
    ['a blank token', { token: ' ', userId: '41' }],
    ['a blank user id', { token: '_act-token', userId: '' }],
    ['a non-object body', '_act-token'],
  ])('returns a safe failure for %s', async (_description, body) => {
    const gateway = createHttpSumsubTokenGateway({ request: () => Promise.resolve(body) })

    await expect(gateway.get()).resolves.toEqual(failure)
  })

  test('returns a safe failure when the request rejects', async () => {
    const gateway = createHttpSumsubTokenGateway({
      request: () => Promise.reject(new Error('Sumsub sent a secret error')),
    })

    await expect(gateway.get()).resolves.toEqual(failure)
  })

  test.each([1, 2])('loads a token after %i timed-out attempts', async (timeouts) => {
    vi.useFakeTimers()
    let attempts = 0
    const gateway = createHttpSumsubTokenGateway(createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        if (attempts <= timeouts) return new Promise<Response>(() => undefined)
        return Response.json({ token: '_act-token', userId: '41' })
      },
    }))

    const result = gateway.get()
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual({
      ok: true,
      data: { token: '_act-token', userId: '41' },
    })
    expect(attempts).toBe(timeouts + 1)
  })

  test('stops after two timeout retries and returns a safe failure', async () => {
    vi.useFakeTimers()
    let attempts = 0
    const gateway = createHttpSumsubTokenGateway(createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Promise<Response>(() => undefined)
      },
    }))

    const result = gateway.get()
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual(failure)
    expect(attempts).toBe(3)
  })

  test('does not retry when canceled during timeout backoff', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const controller = new AbortController()
    const fetch = vi.fn(async () => new Promise<Response>(() => undefined))
    const gateway = createHttpSumsubTokenGateway(createApiClient({ baseUrl: '/api', fetch }))

    const result = gateway.get(controller.signal)
    await vi.advanceTimersByTimeAsync(10_000)
    controller.abort()
    await vi.runAllTimersAsync()

    await expect(result).resolves.toEqual(failure)
    expect(fetch).toHaveBeenCalledOnce()
  })

  test.each([400, 401, 403, 404])('does not retry HTTP %i', async (status) => {
    const fetch = vi.fn(async () => new Response('{}', { status }))
    const gateway = createHttpSumsubTokenGateway(createApiClient({ baseUrl: '/api', fetch }))

    await expect(gateway.get()).resolves.toEqual(failure)
    expect(fetch).toHaveBeenCalledOnce()
  })
})
