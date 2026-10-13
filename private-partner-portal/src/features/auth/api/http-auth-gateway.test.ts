import { expect, test, vi } from 'vitest'

import { createHttpAuthGateway } from './http-auth-gateway'

const baseUrl = 'https://api.example.test/partner/portal/v1/'

test('requests a reset email with CSRF and cookies without changing the sign-in step', async () => {
  const storage = createStorage()
  storage.setItem('partner-portal.auth-two-factor-step', '2fa_verify')
  const requests: Request[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    if (request.url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    expect(request.url).toBe(`${baseUrl}auth/password/forgot/`)
    expect(await request.json()).toEqual({ email: 'partner@example.test' })
    return Response.json({ message: 'If an account exists for this email, we sent password reset instructions.' })
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage })
  expect(await gateway.requestPasswordReset({ email: ' Partner@Example.Test ' })).toEqual({ ok: true })
  expect(requests).toHaveLength(2)
  expect(requests[1]?.headers.get('X-CSRFToken')).toBe('csrf-token')
  expect(requests.every((request) => request.credentials === 'include')).toBe(true)
  expect([...storage.values.values()]).toEqual(['2fa_verify'])
})

function createStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

test('resets a password from a link and clears local session hints without authenticating', async () => {
  const storage = createStorage()
  storage.setItem('partner-portal.auth-two-factor-step', '2fa_verify')
  const onUserChanged = vi.fn()
  const requests: Request[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    if (request.url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    if (request.url.endsWith('auth/password/reset/')) return Response.json({ next: 'done' })
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage, onUserChanged })
  expect(await gateway.resetPassword({ token: 'one-use-token', password: 'a long passphrase' })).toEqual({ ok: true })
  expect(await requests[1]?.json()).toEqual({ token: 'one-use-token', password: 'a long passphrase' })
  expect(requests[1]?.headers.get('X-CSRFToken')).toBe('csrf-token')
  expect(requests[1]?.credentials).toBe('include')
  expect(storage.values.size).toBe(0)
  expect(onUserChanged).toHaveBeenLastCalledWith(null)
  expect(await gateway.getSession()).toBe('anonymous')
})

test.each([
  ['invalid_token', 400, 'invalidToken'],
  ['invalid_password', 400, 'invalidPassword'],
  ['rate_limited', 429, 'rateLimited'],
])('keeps reset failures actionable and private for %s', async (error, status, code) => {
  const storage = createStorage()
  storage.setItem('partner-portal.auth-two-factor-step', '2fa_verify')
  const fetch: typeof globalThis.fetch = async (input) => String(input instanceof Request ? input.url : input).endsWith('auth/csrf/')
    ? Response.json({ csrf_token: 'csrf-token' }) : Response.json({ error, message: 'Private diagnostic' }, { status })
  const result = await createHttpAuthGateway({ baseUrl, fetch, storage }).resetPassword({ token: 'expired-or-used-token', password: 'a long passphrase' })
  expect(result).toMatchObject({ ok: false, code })
  expect(JSON.stringify(result)).not.toContain('Private diagnostic')
  expect([...storage.values.values()]).toEqual(['2fa_verify'])
})

test.each([
  ['forgot', null], ['forgot', { message: null }], ['forgot', { message: '' }],
  ['reset', null], ['reset', { next: '2fa_verify' }], ['reset', { next: null }],
])('rejects a malformed %s response %j without clearing a session', async (operation, body) => {
  const storage = createStorage()
  storage.setItem('partner-portal.auth-two-factor-step', '2fa_verify')
  const fetch: typeof globalThis.fetch = async (input) => String(input instanceof Request ? input.url : input).endsWith('auth/csrf/')
    ? Response.json({ csrf_token: 'csrf-token' }) : Response.json(body)
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage })
  const result = operation === 'forgot' ? await gateway.requestPasswordReset({ email: 'missing@example.test' }) : await gateway.resetPassword({ token: 'token', password: 'a long passphrase' })
  expect(result).toMatchObject({ ok: false, code: 'unexpected' })
  expect([...storage.values.values()]).toEqual(['2fa_verify'])
})

test('allows an explicit recovery retry after a network failure or rejected CSRF, without replaying automatically', async () => {
  let attempts = 0
  let csrfRequests = 0
  const fetch: typeof globalThis.fetch = async (input) => {
    const request = new Request(input)
    if (request.url.endsWith('auth/csrf/')) return Response.json({ csrf_token: `csrf-${++csrfRequests}` })
    if (++attempts === 1) throw new Error('Private network detail')
    if (attempts === 2) return Response.json({ error: 'CSRF Failed: Incorrect token' }, { status: 403 })
    expect(request.headers.get('X-CSRFToken')).toBe('csrf-2')
    return Response.json({ message: 'If an account exists, instructions have been sent.' })
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage: null })
  const input = { email: 'missing@example.test' }
  expect(await gateway.requestPasswordReset(input)).toMatchObject({ ok: false, code: 'network' })
  expect(attempts).toBe(1)
  expect(await gateway.requestPasswordReset(input)).toMatchObject({ ok: false, code: 'csrf' })
  expect(attempts).toBe(2)
  expect(await gateway.requestPasswordReset(input)).toEqual({ ok: true })
  expect(attempts).toBe(3)
})

test('signs in with CSRF and cookies and restores the server-required setup step', async () => {
  const storage = createStorage()
  const requests: Request[] = []
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    if (request.url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    if (request.url.endsWith('auth/login/')) {
      expect(await request.json()).toEqual({ email: 'partner@example.test', password: 'temporary' })
      return Response.json({ next: '2fa_setup' })
    }
    return Response.json({ error: 'two_factor_required', message: 'Two-factor authentication is required.' }, { status: 403 })
  })
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage })
  expect(await gateway.signIn({ email: ' Partner@Example.Test ', password: 'temporary' })).toEqual({ ok: true })
  expect(await gateway.getSession()).toBe('authenticator-required')
  expect(await createHttpAuthGateway({ baseUrl, fetch, storage }).getSession()).toBe('authenticator-required')
  expect(requests.map((request) => request.url)).toEqual([
    `${baseUrl}auth/csrf/`, `${baseUrl}auth/login/`, `${baseUrl}session/`, `${baseUrl}session/`,
  ])
  expect(requests.every((request) => request.credentials === 'include')).toBe(true)
  expect(requests[1]?.headers.get('X-CSRFToken')).toBe('csrf-token')
  expect(requests[1]?.headers.get('Authorization')).toBeNull()
  expect([...storage.values.values()]).toEqual(['2fa_setup'])
})

test('finishes mandatory setup and password change, then verifies and logs out a returning user', async () => {
  const storage = createStorage()
  const onUserChanged = vi.fn()
  const requests: Request[] = []
  const responses = [
    Response.json({ csrf_token: 'csrf-token' }),
    Response.json({ next: '2fa_setup' }),
    Response.json({ secret: 'GEZDGNBVGY3TQOJQ', otpauth_uri: 'otpauth://totp/XPlace?secret=GEZDGNBVGY3TQOJQ&issuer=XPlace' }),
    Response.json({ next: 'password_change' }),
    Response.json({ error: 'password_change_required', message: 'Password change is required.' }, { status: 403 }),
    Response.json({ next: 'done' }),
    new Response(null, { status: 204 }),
    new Response(null, { status: 204 }),
    Response.json({ error: 'Not authenticated' }, { status: 401 }),
    Response.json({ next: '2fa_verify' }),
    Response.json({ error: 'two_factor_required' }, { status: 403 }),
    Response.json({ next: 'done' }),
    new Response(null, { status: 204 }),
  ]
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init))
    const response = responses.shift()
    if (!response) throw new Error('Unexpected request')
    return response
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage, onUserChanged })
  const credentials = { email: 'partner@example.test', password: 'temporary' }
  expect(await gateway.signIn(credentials)).toEqual({ ok: true })
  const setups = await Promise.all([gateway.getAuthenticatorSetup(), gateway.getAuthenticatorSetup()])
  expect(setups[0]).toEqual({ ok: true, data: { secret: 'GEZDGNBVGY3TQOJQ', uri: 'otpauth://totp/XPlace?secret=GEZDGNBVGY3TQOJQ&issuer=XPlace' } })
  expect(setups[1]).toEqual(setups[0])
  expect([...storage.values.values()]).toEqual(['2fa_setup'])
  expect(await gateway.verifyAuthenticatorCode({ code: '123456' })).toEqual({ ok: true })
  expect(await gateway.getSession()).toBe('password-required')
  expect(await gateway.setPassword({ password: 'a long passphrase' })).toEqual({ ok: true })
  expect(await gateway.getSession()).toBe('authenticated')
  expect(await gateway.signOut()).toEqual({ ok: true })
  expect(await gateway.getSession()).toBe('anonymous')
  expect(storage.values.size).toBe(0)
  expect(onUserChanged).toHaveBeenLastCalledWith(null)
  expect(await gateway.signIn(credentials)).toEqual({ ok: true })
  expect(await gateway.getSession()).toBe('two-factor-required')
  expect(await gateway.verifyAuthenticatorCode({ code: '654321' })).toEqual({ ok: true })
  expect(await gateway.getSession()).toBe('authenticated')
  expect(requests.filter((request) => request.method === 'POST').map((request) => request.url)).toEqual([
    `${baseUrl}auth/login/`, `${baseUrl}auth/2fa/setup/`, `${baseUrl}auth/2fa/confirm/`,
    `${baseUrl}auth/password/change/`, `${baseUrl}auth/logout/`, `${baseUrl}auth/login/`, `${baseUrl}auth/2fa/verify/`,
  ])
  expect(await requests[3]?.json()).toEqual({ code: '123456' })
  expect(await requests[5]?.json()).toEqual({ password: 'a long passphrase' })
  expect(await requests[11]?.json()).toEqual({ code: '654321' })
  expect(requests.filter((request) => request.method === 'POST').every((request) => request.headers.get('X-CSRFToken') === 'csrf-token')).toBe(true)
})

test.each([
  ['invalid_code', 401, 'incorrectCode'],
  ['code_reused', 401, 'usedCode'],
  ['account_locked', 403, 'accountLocked'],
  ['rate_limited', 429, 'rateLimited'],
])('keeps the verification step on %s and returns a safe error', async (error, status, code) => {
  const storage = createStorage()
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    if (url.endsWith('auth/login/')) return Response.json({ next: '2fa_verify' })
    if (url.endsWith('session/')) return Response.json({ error: 'two_factor_required' }, { status: 403 })
    return Response.json({ error, message: 'Private diagnostic' }, { status })
  })
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage })
  await gateway.signIn({ email: 'partner@example.test', password: 'temporary' })
  const result = await gateway.verifyAuthenticatorCode({ code: '123456' })
  expect(result).toMatchObject({ ok: false, code })
  expect(JSON.stringify(result)).not.toContain('Private diagnostic')
  expect(await gateway.getSession()).toBe('two-factor-required')
  expect(fetch).toHaveBeenCalledTimes(4)
})

test('does not simulate logout when the backend rejects a partial session', async () => {
  const storage = createStorage()
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    if (url.endsWith('auth/login/')) return Response.json({ next: '2fa_setup' })
    return Response.json({ error: 'two_factor_required' }, { status: 403 })
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage })
  await gateway.signIn({ email: 'partner@example.test', password: 'temporary' })
  expect(await gateway.signOut()).toMatchObject({ ok: false, code: 'twoFactorRequired' })
  expect(await gateway.getSession()).toBe('authenticator-required')
  expect([...storage.values.values()]).toEqual(['2fa_setup'])
})

test('clears a session that expires during verification, but keeps it on network failure', async () => {
  const storage = createStorage()
  let expired = false
  let offline = false
  const fetch: typeof globalThis.fetch = async (input) => {
    if (offline) throw new Error('Private network diagnostic')
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    if (url.endsWith('auth/login/')) return Response.json({ next: '2fa_verify' })
    return expired
      ? Response.json({ error: 'Authentication credentials were not provided.' }, { status: 401 })
      : Response.json({ error: 'two_factor_required' }, { status: 403 })
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage })
  await gateway.signIn({ email: 'partner@example.test', password: 'temporary' })
  offline = true
  expect(await gateway.verifyAuthenticatorCode({ code: '123456' })).toMatchObject({ ok: false, code: 'network' })
  await expect(gateway.getSession()).rejects.toMatchObject({ kind: 'network' })
  expect([...storage.values.values()]).toEqual(['2fa_verify'])
  offline = false
  expired = true
  expect(await gateway.verifyAuthenticatorCode({ code: '123456' })).toMatchObject({ ok: false, code: 'session' })
  expect(storage.values.size).toBe(0)
  expect(await gateway.getSession()).toBe('anonymous')
})

test.each([null, 'authenticated', 'broken'])('does not infer setup or access from an unavailable or invalid hint %s', async (hint) => {
  const storage = createStorage()
  if (hint !== null) storage.setItem('partner-portal.auth-two-factor-step', hint)
  const gateway = createHttpAuthGateway({ baseUrl, storage, fetch: async () => Response.json({ error: 'two_factor_required' }, { status: 403 }) })
  expect(await gateway.getSession()).toBe('anonymous')
})

test('restores full and password-change sessions using only the server response', async () => {
  const storage = createStorage()
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(Response.json({ error: 'password_change_required' }, { status: 403 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json(null))
    .mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }))
  const gateway = createHttpAuthGateway({ baseUrl, storage, fetch })
  expect(await gateway.getSession()).toBe('password-required')
  expect(await gateway.getSession()).toBe('authenticated')
  await expect(gateway.getSession()).rejects.toMatchObject({ kind: 'invalid-response', status: 200 })
  await expect(gateway.getSession()).rejects.toMatchObject({ status: 403 })
})

test('requests a fresh setup after reload without persisting the key or URI', async () => {
  const storage = createStorage()
  let generation = 0
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    if (url.endsWith('auth/login/')) return Response.json({ next: '2fa_setup' })
    if (url.endsWith('session/')) return Response.json({ error: 'two_factor_required' }, { status: 403 })
    const secret = ++generation === 1 ? 'AAAAAAAAAAAAAAAA' : 'BBBBBBBBBBBBBBBB'
    return Response.json({ secret, otpauth_uri: `otpauth://totp/XPlace?secret=${secret}` })
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage })
  await gateway.signIn({ email: 'partner@example.test', password: 'temporary' })
  const first = await gateway.getAuthenticatorSetup()
  const restored = createHttpAuthGateway({ baseUrl, fetch, storage })
  expect(await restored.getSession()).toBe('authenticator-required')
  const second = await restored.getAuthenticatorSetup()
  expect(first.ok && first.data.secret).toBe('AAAAAAAAAAAAAAAA')
  expect(second.ok && second.data.secret).toBe('BBBBBBBBBBBBBBBB')
  expect([...storage.values.values()]).toEqual(['2fa_setup'])
})

test('refreshes CSRF only on a manual retry and never replays the rejected login automatically', async () => {
  let token = 0
  let logins = 0
  const fetch: typeof globalThis.fetch = async (input) => {
    const request = new Request(input)
    if (request.url.endsWith('auth/csrf/')) return Response.json({ csrf_token: `csrf-${++token}` })
    if (++logins === 1) return Response.json({ error: 'CSRF Failed: CSRF token incorrect.' }, { status: 403 })
    expect(request.headers.get('X-CSRFToken')).toBe('csrf-2')
    return Response.json({ next: '2fa_verify' })
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage: null })
  const credentials = { email: 'partner@example.test', password: 'temporary' }
  expect(await gateway.signIn(credentials)).toMatchObject({ ok: false, code: 'csrf' })
  expect(logins).toBe(1)
  expect(await gateway.signIn(credentials)).toEqual({ ok: true })
  expect(logins).toBe(2)
})

test.each([
  { next: 'done' }, { next: null }, [], null,
])('rejects an unexpected login response %j without writing a step hint', async (body) => {
  const storage = createStorage()
  const fetch: typeof globalThis.fetch = async (input) => String(input instanceof Request ? input.url : input).endsWith('auth/csrf/')
    ? Response.json({ csrf_token: 'csrf-token' }) : Response.json(body)
  expect(await createHttpAuthGateway({ baseUrl, fetch, storage }).signIn({ email: 'partner@example.test', password: 'temporary' })).toMatchObject({ ok: false, code: 'unexpected' })
  expect(storage.values.size).toBe(0)
})

test.each([
  { secret: null, otpauth_uri: 'otpauth://totp/XPlace' },
  { secret: 'AAAAAAAAAAAAAAAA', otpauth_uri: 'javascript:alert(1)' },
  { secret: 'AAAAAAAAAAAAAAAA', otpauth_uri: 'otpauth://totp/XPlace?secret=BBBBBBBBBBBBBBBB' },
])('rejects unusable setup data %j and allows a fresh attempt', async (body) => {
  const fetch: typeof globalThis.fetch = async (input) => String(input instanceof Request ? input.url : input).endsWith('auth/csrf/')
    ? Response.json({ csrf_token: 'csrf-token' }) : Response.json(body)
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage: null })
  expect(await gateway.getAuthenticatorSetup()).toMatchObject({ ok: false, code: 'unexpected' })
  expect(await gateway.getAuthenticatorSetup()).toMatchObject({ ok: false, code: 'unexpected' })
})

test('ignores a stale unauthorized restoration after a newer login', async () => {
  const storage = createStorage()
  let finish!: (response: Response) => void
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    if (url.endsWith('auth/login/')) return Response.json({ next: '2fa_verify' })
    return new Promise<Response>((resolve) => { finish = resolve })
  }
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage })
  const pending = gateway.getSession()
  await vi.waitFor(() => expect(finish).toBeDefined())
  await gateway.signIn({ email: 'partner@example.test', password: 'temporary' })
  finish(Response.json({ error: 'Not authenticated' }, { status: 401 }))
  await pending
  expect([...storage.values.values()]).toEqual(['2fa_verify'])
})

test('a setup request from a previous login cannot clear a newer two-factor step', async () => {
  const storage = createStorage()
  let next = '2fa_setup'
  let finish!: (response: Response) => void
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'csrf-token' })
    if (url.endsWith('auth/login/')) return Response.json({ next })
    if (url.endsWith('auth/logout/')) return new Response(null, { status: 204 })
    if (url.endsWith('session/')) return Response.json({ error: 'two_factor_required' }, { status: 403 })
    return new Promise<Response>((resolve) => { finish = resolve })
  }
  const gateway = createHttpAuthGateway({ baseUrl, storage, fetch })
  const credentials = { email: 'partner@example.test', password: 'temporary' }
  await gateway.signIn(credentials)
  const stale = gateway.getAuthenticatorSetup()
  await vi.waitFor(() => expect(finish).toBeDefined())
  expect(await gateway.signOut()).toEqual({ ok: true })
  next = '2fa_verify'
  await gateway.signIn(credentials)
  finish(Response.json({ error: 'Not authenticated' }, { status: 401 }))
  await stale
  expect(await gateway.getSession()).toBe('two-factor-required')
  expect([...storage.values.values()]).toEqual(['2fa_verify'])
})

test('rejects an invalid CSRF response without sending credentials', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ csrf_token: null }))
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage: null })
  expect(await gateway.signIn({ email: 'partner@example.test', password: 'temporary' })).toMatchObject({ ok: false, code: 'unexpected' })
  expect(fetch).toHaveBeenCalledOnce()
})

test.each([
  ['invalid_credentials', 401, 'invalidCredentials'],
  ['invalid_password', 403, 'invalidPassword'],
  ['invalid_request', 400, 'invalidRequest'],
  ['__proto__', 403, 'unexpected'],
])('maps %s without displaying backend messages or inventing error codes', async (error, status, code) => {
  const fetch: typeof globalThis.fetch = async (input) => String(input instanceof Request ? input.url : input).endsWith('auth/csrf/')
    ? Response.json({ csrf_token: 'csrf-token' }) : Response.json({ error, message: 'Private diagnostic' }, { status })
  const gateway = createHttpAuthGateway({ baseUrl, fetch, storage: null })
  const result = error === 'invalid_credentials' ? await gateway.signIn({ email: 'partner@example.test', password: 'temporary' }) : await gateway.setPassword({ password: 'a long passphrase' })
  expect(result).toMatchObject({ ok: false, code })
  expect(JSON.stringify(result)).not.toContain('Private diagnostic')
})
