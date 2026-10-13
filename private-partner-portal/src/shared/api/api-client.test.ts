import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  createApiClient,
  isApiRequestError,
} from './api-client'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('createApiClient', () => {
  test('rejects a successful status that does not match the endpoint contract', async () => {
    const client = createApiClient({ baseUrl: '/api', fetch: async () => Response.json(null) })
    await expect(client.request('session/', { expectedStatus: 204 })).rejects.toMatchObject({ kind: 'invalid-response', status: 200 })
  })
  test('includes browser cookies with every API request', async () => {
    let request: Request | undefined
    const client = createApiClient({
      baseUrl: 'https://back-stage.x.place/api/v1',
      fetch: async (input, init) => {
        request = new Request(input, init)
        return Response.json({ id: 2 })
      },
    })

    await client.request('users/me/')

    expect(request?.credentials).toBe('include')
  })

  test('adds the current CSRF token to unsafe requests', async () => {
    let request: Request | undefined
    const client = createApiClient({
      baseUrl: 'https://back-stage.x.place/api/v1',
      getCsrfToken: () => Promise.resolve('csrf-token-1'),
      fetch: async (input, init) => {
        request = new Request(input, init)
        return Response.json({ ok: true })
      },
    })

    await client.request('cards/', { method: 'POST', json: {} })

    expect(request?.headers.get('X-CSRFToken')).toBe('csrf-token-1')
  })

  test('joins a relative endpoint without adding a bearer header', async () => {
    const requests: Request[] = []
    const client = createApiClient({
      baseUrl: 'https://back-stage.x.place/api/v1',
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ id: 2 })
      },
    })

    await client.request('users/me/', { authenticated: true })

    expect(requests[0]?.url).toBe('https://back-stage.x.place/api/v1/users/me/')
    expect(requests[0]?.headers.get('Authorization')).toBeNull()
  })

  test('keeps same-origin API paths relative and sends JSON request data', async () => {
    let request: Request | undefined
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async (input, init) => {
        request = new Request(input, init)
        return Response.json({ ok: true })
      },
    })

    await client.request('/otp/', { method: 'POST', json: { phone: '554570290' } })

    expect(request?.url).toBe('http://localhost/api/otp/')
    expect(request?.method).toBe('POST')
    expect(request?.headers.get('Content-Type')).toBe('application/json')
    await expect(request?.json()).resolves.toEqual({ phone: '554570290' })
  })

  test('performs one request plus ten retries for a retryable GET', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Response('{}', { status: 503 })
      },
    })

    const request = client.request('users/me/')
    const rejection = expect(request).rejects.toMatchObject({ status: 503 })
    await vi.runAllTimersAsync()

    await rejection
    expect(attempts).toBe(11)
  })

  test('performs one request plus ten retries when a retryable GET times out', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Promise<Response>(() => undefined)
      },
    })

    const request = client.request('users/me/')
    const rejection = expect(request).rejects.toMatchObject({
      kind: 'network',
      status: null,
    })
    await vi.runAllTimersAsync()

    await rejection
    expect(attempts).toBe(11)
  })

  test('does not retry a timeout when retry is disabled', async () => {
    vi.useFakeTimers()
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Promise<Response>(() => undefined)
      },
    })

    const request = client.request('users/me/', { retry: false })
    const rejection = expect(request).rejects.toMatchObject({ kind: 'network' })
    await vi.runAllTimersAsync()

    await rejection
    expect(attempts).toBe(1)
  })

  test.each([200, 204])(
    'returns null for a successful bodyless HEAD response with status %i',
    async (status) => {
      const client = createApiClient({
        baseUrl: '/api',
        fetch: async () => new Response(null, { status }),
      })

      await expect(
        client.request('users/me/', { method: 'HEAD' }),
      ).resolves.toBeNull()
    },
  )

  test('returns null for a successful bodyless 204 response', async () => {
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => new Response(null, { status: 204 }),
    })

    await expect(
      client.request('users/web/auth/logout/', { method: 'POST' }),
    ).resolves.toBeNull()
  })

  test('retries HEAD requests by default', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Response('{}', { status: 503 })
      },
    })

    const request = client.request('users/me/', { method: 'HEAD' })
    const rejection = expect(request).rejects.toMatchObject({ status: 503 })
    await vi.runAllTimersAsync()

    await rejection
    expect(attempts).toBe(11)
  })

  test('uses the capped jittered delay when a retryable response has Retry-After', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Response('{}', {
          status: 503,
          headers: { 'Retry-After': '86400' },
        })
      },
    })

    const request = client.request('users/me/')
    const rejection = request.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(300)

    expect(attempts).toBe(2)
    await vi.runAllTimersAsync()
    expect(await rejection).toMatchObject({ status: 503 })
  })

  test.each([408, 429, 500, 599])('retries GET responses with status %i', async (status) => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Response('{}', { status })
      },
    })

    const request = client.request('users/me/')
    const rejection = expect(request).rejects.toMatchObject({ status })
    await vi.runAllTimersAsync()

    await rejection
    expect(attempts).toBe(11)
  })

  test.each([400, 401, 403, 404])('does not retry GET responses with status %i', async (status) => {
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Response('{}', { status })
      },
    })

    await expect(client.request('users/me/')).rejects.toMatchObject({ status })
    expect(attempts).toBe(1)
  })

  test('does not retry when retry is disabled', async () => {
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Response('{}', { status: 503 })
      },
    })

    await expect(
      client.request('otp/', { method: 'POST', retry: false }),
    ).rejects.toBeDefined()
    expect(attempts).toBe(1)
  })

  test('does not retry POST requests by default', async () => {
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Response('{}', { status: 503 })
      },
    })

    await expect(client.request('otp/', { method: 'POST' })).rejects.toBeDefined()
    expect(attempts).toBe(1)
  })

  test.each(['PUT', 'PATCH', 'DELETE'] as const)(
    'does not retry %s requests by default',
    async (method) => {
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(1)
      let attempts = 0
      const client = createApiClient({
        baseUrl: '/api',
        fetch: async () => {
          attempts += 1
          return new Response('{}', { status: 503 })
        },
      })

      const request = client.request('resource/', { method })
      const rejection = expect(request).rejects.toMatchObject({ status: 503 })
      await vi.runAllTimersAsync()

      await rejection
      expect(attempts).toBe(1)
    },
  )

  test.each(['PUT', 'PATCH', 'DELETE'] as const)(
    'retries %s requests when the endpoint explicitly opts in',
    async (method) => {
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(1)
      let attempts = 0
      const client = createApiClient({
        baseUrl: '/api',
        fetch: async () => {
          attempts += 1
          return new Response('{}', { status: 503 })
        },
      })

      const request = client.request('resource/', { method, retry: true })
      const rejection = expect(request).rejects.toMatchObject({ status: 503 })
      await vi.runAllTimersAsync()

      await rejection
      expect(attempts).toBe(11)
    },
  )

  test('retries POST requests when retry is explicitly enabled', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(1)
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () => {
        attempts += 1
        return new Response('{}', { status: 503 })
      },
    })

    const request = client.request('otp/', { method: 'POST', retry: true })
    const rejection = expect(request).rejects.toMatchObject({ status: 503 })
    await vi.runAllTimersAsync()

    await rejection
    expect(attempts).toBe(11)
  })

  test('marks an aborted request as aborted', async () => {
    const controller = new AbortController()
    let attempts = 0
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async (input, init) => {
        attempts += 1
        const request = new Request(input, init)
        return new Promise<Response>((_resolve, reject) => {
          if (request.signal.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
            return
          }
          request.signal.addEventListener(
            'abort',
            () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            },
            { once: true },
          )
        })
      },
    })

    const request = client.request('users/me/', { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toMatchObject({
      kind: 'aborted',
      status: null,
      body: null,
    })
    expect(attempts).toBe(1)
  })

  test('calls onUnauthorized once before rejecting an authenticated 401 response', async () => {
    const onUnauthorized = vi.fn()
    const client = createApiClient({
      baseUrl: '/api',
      onUnauthorized,
      fetch: async () => new Response('{"detail":"Unauthorized"}', { status: 401 }),
    })

    await expect(
      client.request('users/me/', { authenticated: true }),
    ).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  test.each([
    { authenticated: false, status: 401 },
    { authenticated: true, status: 403 },
  ])(
    'does not call onUnauthorized for an authenticated=$authenticated status=$status response',
    async ({ authenticated, status }) => {
      const onUnauthorized = vi.fn()
      const client = createApiClient({
        baseUrl: '/api',
        onUnauthorized,
        fetch: async () => new Response('{}', { status }),
      })

      await expect(
        client.request('users/me/', { authenticated }),
      ).rejects.toMatchObject({ status })
      expect(onUnauthorized).not.toHaveBeenCalled()
    },
  )

  test('keeps an HTTP error body as unknown text without assuming JSON', async () => {
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () =>
        new Response('Service unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        }),
    })

    await expect(
      client.request('users/me/', { retry: false }),
    ).rejects.toMatchObject({
      kind: 'http',
      status: 503,
      body: 'Service unavailable',
    })
  })

  test('exposes invalid JSON responses without guessing their contents', async () => {
    const client = createApiClient({
      baseUrl: '/api',
      fetch: async () =>
        new Response('not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    })

    const result = client.request('users/me/')

    await expect(result).rejects.toSatisfy(isApiRequestError)
    await expect(result).rejects.toMatchObject({
      kind: 'invalid-response',
      status: 200,
      body: null,
    })
  })
})


test('preserves cancellation while reading the response body', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.error(new DOMException('Aborted', 'AbortError')) },
  })
  const client = createApiClient({
    baseUrl: '/api',
    fetch: async () => new Response(body, { headers: { 'Content-Type': 'application/json' } }),
  })

  await expect(client.request('users/me/', { retry: false })).rejects.toMatchObject({ kind: 'aborted' })
})
