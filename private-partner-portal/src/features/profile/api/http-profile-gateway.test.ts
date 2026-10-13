import { expect, test, vi } from 'vitest'

import { createHttpProfileGateway } from './http-profile-gateway'
import { ProfileSessionError } from './profile-gateway'

const baseUrl = 'https://api.example.test/partner/portal/v1/'
const account = {
  partner: { name: 'Acme Partners', slug: 'acme' },
  account: { full_name: 'Alex Partner', email: 'alex@example.test', phone: '' },
  must_change_password: false,
  totp_configured: true,
}

test('loads the server profile with cookies and preserves empty account values', async () => {
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    expect(request.url).toBe(`${baseUrl}me/`)
    expect(request.credentials).toBe('include')
    expect(request.headers.get('Authorization')).toBeNull()
    return Response.json(account)
  } })
  expect(await gateway.getProfile(new AbortController().signal)).toEqual({
    company: 'Acme Partners', partnerSlug: 'acme', fullName: 'Alex Partner',
    email: 'alex@example.test', phone: '', mustChangePassword: false, totpConfigured: true,
  })
})

test.each([
  { ...account, account: { full_name: 'Alex', email: 'alex@example.test' } },
  { ...account, must_change_password: 'false' },
])('rejects malformed profile data instead of inventing missing values', async body => {
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async () => Response.json(body) })
  const request = gateway.getProfile(new AbortController().signal)
  await expect(request).rejects.toMatchObject({ kind: 'invalid-response' })
})

test('preserves explicitly null profile values', async () => {
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async () => Response.json({ ...account, partner: { name: null, slug: null }, account: { full_name: null, email: null, phone: null } }) })
  expect(await gateway.getProfile(new AbortController().signal)).toMatchObject({ company: null, partnerSlug: null, fullName: null, email: null, phone: null })
})

test('refreshes CSRF on an explicit retry without automatically repeating password requests', async () => {
  let csrfCalls = 0
  let passwordCalls = 0
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    if (request.url.endsWith('auth/csrf/')) return Response.json({ csrf_token: `csrf-${++csrfCalls}` })
    passwordCalls++
    expect(request.headers.get('X-CSRFToken')).toBe(`csrf-${passwordCalls}`)
    return passwordCalls === 1 ? Response.json({ error: 'CSRF Failed: Invalid token' }, { status: 403 }) : Response.json({ next: 'done' })
  } })
  const input = { currentPassword: 'old', password: 'a new passphrase', code: '123456' }
  expect(await gateway.changePassword(input)).toMatchObject({ ok: false, code: 'csrf' })
  expect(passwordCalls).toBe(1)
  expect(await gateway.changePassword(input)).toEqual({ ok: true })
  expect(csrfCalls).toBe(2)
})

test('shares a pending CSRF request between profile actions and keeps their contracts', async () => {
  let csrfCalls = 0
  let completeCsrf!: (response: Response) => void
  const csrf = new Promise<Response>(resolve => { completeCsrf = resolve })
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    if (request.url.endsWith('auth/csrf/')) { csrfCalls++; return csrf }
    expect(request.credentials).toBe('include')
    expect(request.headers.get('X-CSRFToken')).toBe('shared-csrf')
    return request.url.endsWith('auth/password/change/') ? Response.json({ next: 'done' }) : new Response(null, { status: 204 })
  } })
  const password = gateway.changePassword({ currentPassword: 'old', password: 'a new passphrase', code: '123456' })
  const sessions = gateway.revokeOtherSessions()
  await vi.waitFor(() => expect(csrfCalls).toBe(1))
  completeCsrf(Response.json({ csrf_token: 'shared-csrf' }))
  expect(await password).toEqual({ ok: true })
  expect(await sessions).toEqual({ ok: true })
  expect(csrfCalls).toBe(1)
})

test('cancelled profile reads do not become authentication failures', async () => {
  const controller = new AbortController()
  controller.abort()
  const gateway = createHttpProfileGateway({ baseUrl })
  await expect(gateway.getProfile(controller.signal)).rejects.toMatchObject({ kind: 'aborted' })
})

test('keeps mutation failures safe and rejects an unexpected successful response', async () => {
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async input => new Request(input).url.endsWith('auth/csrf/')
    ? Response.json({ csrf_token: 'profile-csrf' }) : Response.json({ next: 'password_change' }) })
  expect(await gateway.changePassword({ currentPassword: 'old', password: 'a new passphrase', code: '123456' })).toMatchObject({ ok: false, code: 'unexpected' })
  const offline = createHttpProfileGateway({ baseUrl, fetch: async () => { throw new Error('Private diagnostic') } })
  expect(await offline.revokeOtherSessions()).toMatchObject({ ok: false, code: 'network' })
})

test('reports expired profile reads through the feature session boundary', async () => {
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async () => Response.json({ error: 'Not authenticated' }, { status: 401 }) })
  await expect(gateway.getProfile(new AbortController().signal)).rejects.toBeInstanceOf(ProfileSessionError)
})

test('revokes other sessions with a CSRF-protected POST and requires a 204 response', async () => {
  let status = 204
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    if (request.url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'profile-csrf' })
    expect(request.url).toBe(`${baseUrl}auth/sessions/revoke-all/`)
    expect(request.method).toBe('POST')
    expect(request.headers.get('X-CSRFToken')).toBe('profile-csrf')
    expect(await request.text()).toBe('')
    return status === 204 ? new Response(null, { status }) : Response.json({}, { status })
  } })
  expect(await gateway.revokeOtherSessions()).toEqual({ ok: true })
  status = 200
  expect(await gateway.revokeOtherSessions()).toMatchObject({ ok: false, code: 'unexpected' })
})

test.each([
  ['invalid_credentials', 401, 'currentPassword'],
  ['invalid_code', 401, 'incorrectCode'],
  ['code_reused', 401, 'usedCode'],
  ['invalid_password', 400, 'invalidPassword'],
  ['Not authenticated', 401, 'session'],
  ['two_factor_required', 403, 'session'],
])('handles %s safely without treating a credential or code mistake as session expiry', async (error, status, code) => {
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async input => new Request(input).url.endsWith('auth/csrf/')
    ? Response.json({ csrf_token: 'profile-csrf' })
    : Response.json({ error, message: 'Private server diagnostic' }, { status }) })
  const result = await gateway.changePassword({ currentPassword: 'old', password: 'a new passphrase', code: '123456' })
  expect(result).toMatchObject({ ok: false, code })
  expect(JSON.stringify(result)).not.toContain('Private server diagnostic')
})

test('changes a profile password using the current password and TOTP with CSRF and cookies', async () => {
  const requests: Request[] = []
  const gateway = createHttpProfileGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    if (request.url.endsWith('auth/csrf/')) return Response.json({ csrf_token: 'profile-csrf' })
    expect(request.url).toBe(`${baseUrl}auth/password/change/`)
    expect(await request.json()).toEqual({ current_password: 'current-password', password: 'a new passphrase', code: '123456' })
    expect(request.headers.get('X-CSRFToken')).toBe('profile-csrf')
    return Response.json({ next: 'done' })
  } })
  expect(await gateway.changePassword({ currentPassword: 'current-password', password: 'a new passphrase', code: '123456' })).toEqual({ ok: true })
  expect(requests.every(request => request.credentials === 'include')).toBe(true)
})
