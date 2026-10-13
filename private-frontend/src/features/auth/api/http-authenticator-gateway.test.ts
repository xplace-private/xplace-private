import { expect, test, vi } from 'vitest'

import { ApiRequestError, createApiClient } from '../../../shared/api/api-client'
import { createHttpAuthenticatorGateway } from './http-authenticator-gateway'

const secret = 'JBSWY3DPEHPK3PXP'
const uri = `otpauth://totp/XPlace%3Auser-7?secret=${secret}&issuer=XPlace&algorithm=SHA1&digits=6&period=30`

test('loads the real setup URI through a CSRF-protected cookie request', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ secret, otpauth_uri: uri })))
  const gateway = createHttpAuthenticatorGateway(createApiClient({
    baseUrl: 'https://backend.example/api/v1/', fetch, getCsrfToken: async () => 'csrf-token',
  }))

  await expect(gateway.getSetup()).resolves.toEqual({ ok: true, data: { secret, uri } })
  const request = fetch.mock.calls[0]?.[0]
  if (!(request instanceof Request)) throw new Error('Missing setup request')
  expect(request.url).toBe('https://backend.example/api/v1/users/web/auth/totp/setup/')
  expect(request.method).toBe('POST')
  expect(request.credentials).toBe('include')
  expect(request.headers.get('X-CSRFToken')).toBe('csrf-token')
})

test.each([
  null, {}, { secret, otpauth_uri: 'https://example.com/' },
  { secret, otpauth_uri: 'otpauth://hotp/XPlace?secret=JBSWY3DPEHPK3PXP' },
  { secret, otpauth_uri: 'otpauth://totp/XPlace?secret=AAAAAAAA' },
  { secret: 'not-base32', otpauth_uri: uri },
])('rejects unsafe or mismatched authenticator setup %#', async (body) => {
  const gateway = createHttpAuthenticatorGateway({ request: async () => body })
  expect((await gateway.getSetup()).ok).toBe(false)
})

test.each([
  ['totp_setup_required', 'confirm', { totp_enabled: true }],
  ['totp_required', 'verify', { totp_verified: true }],
] as const)('submits the code to the backend %s step', async (requirement, endpoint, body) => {
  const request = vi.fn(async () => body)
  const gateway = createHttpAuthenticatorGateway({ request })

  await expect(gateway.verifyCode({ code: '123456', requirement })).resolves.toEqual({ ok: true })
  expect(request).toHaveBeenCalledOnce()
  expect(request).toHaveBeenCalledWith(`users/web/auth/totp/${endpoint}/`, {
    method: 'POST', json: { code: '123456' }, authenticated: true, retry: false,
  })
})

test.each([{}, null, { totp_verified: false }, { totp_enabled: true }])('does not open a session for malformed verification success %#', async (body) => {
  const gateway = createHttpAuthenticatorGateway({ request: async () => body })
  expect((await gateway.verifyCode({ code: '123456', requirement: 'totp_required' })).ok).toBe(false)
})

test('does not send incomplete codes to the backend', async () => {
  const request = vi.fn()
  const gateway = createHttpAuthenticatorGateway({ request })
  await expect(gateway.verifyCode({ code: '12345', requirement: 'totp_required' })).resolves.toMatchObject({ ok: false, code: 'invalid_code' })
  expect(request).not.toHaveBeenCalled()
})

test.each([
  [400, { error: 'invalid_code' }, 'invalid_code'],
  [400, { code: ['Enter the 6-digit code from your authenticator app.'] }, 'invalid_code'],
  [429, { error: 'too_many_attempts', retry_after_seconds: 300 }, 'too_many_attempts'],
  [409, { error: 'totp_already_enabled' }, 'session-changed'],
  [400, { error: 'totp_setup_required' }, 'session-changed'],
  [500, { detail: 'internal sensitive error' }, 'authenticator-failed'],
])('maps backend status %s to a safe authenticator error', async (status, body, code) => {
  const gateway = createHttpAuthenticatorGateway({
    request: async () => { throw new ApiRequestError('http', status, JSON.stringify(body), 'Request failed') },
  })
  const result = await gateway.verifyCode({ code: '123456', requirement: 'totp_required' })
  expect(result).toMatchObject({ ok: false, code })
  expect(JSON.stringify(result)).not.toContain('internal sensitive error')
})
