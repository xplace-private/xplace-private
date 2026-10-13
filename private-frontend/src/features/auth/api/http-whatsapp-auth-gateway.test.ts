import { expect, test, vi } from 'vitest'

import type {
  ApiClient,
  ApiRequestOptions,
} from '../../../shared/api/api-client'
import { ApiRequestError } from '../../../shared/api/api-client'
import { createHttpWhatsAppAuthGateway } from './http-whatsapp-auth-gateway'

test('starts a WhatsApp challenge with the complete international phone number', async () => {
  const requests: Array<{ path: string; options?: ApiRequestOptions }> = []
  const apiClient: ApiClient = {
    request(path, options) {
      requests.push(options === undefined ? { path } : { path, options })
      return Promise.resolve({
        challenge_id: 'challenge-1',
        expires_in_seconds: 600,
        resend_after_seconds: 60,
      })
    },
  }
  const gateway = createHttpWhatsAppAuthGateway(apiClient, {
    invalidate: vi.fn(),
  }, () => 'xplace')

  await expect(gateway.requestCode({ phone: '+44 20 7183 8750' })).resolves.toEqual({
    ok: true,
    data: {
      challengeId: 'challenge-1',
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    },
  })
  expect(requests).toEqual([
    {
      path: 'users/web/auth/whatsapp/start/',
      options: {
        method: 'POST',
        json: { phone: '+442071838750' },
        retry: false,
      },
    },
  ])
})

test.each([
  ['+971 55 457 0290', '+971554570290'],
  ['+44 20 7183 8750', '+442071838750'],
])('normalizes formatted international phone %s', async (phone, expectedPhone) => {
  let sentPhone: unknown
  const gateway = createHttpWhatsAppAuthGateway(
    {
      request: (_path, options) => {
        sentPhone = (options?.json as { phone?: unknown } | undefined)?.phone
        return Promise.resolve({
          challenge_id: 'challenge-1',
          expires_in_seconds: 600,
          resend_after_seconds: 60,
        })
      },
    },
    { invalidate: vi.fn() },
    () => 'xplace',
  )

  await gateway.requestCode({ phone })

  expect(sentPhone).toBe(expectedPhone)
})

test('verifies the challenge, rotates CSRF state, and returns no browser tokens', async () => {
  let request: { path: string; options?: ApiRequestOptions } | undefined
  const apiClient: ApiClient = {
    async request(path, options) {
      request = options === undefined ? { path } : { path, options }
      return { is_new: true, is_private: true, totp_setup_required: false, totp_required: false }
    },
  }
  const invalidate = vi.fn()
  const gateway = createHttpWhatsAppAuthGateway(apiClient, { invalidate }, () => 'xplace')

  await expect(
    gateway.verifyOtp({ challengeId: 'challenge-1', code: '123456' }),
  ).resolves.toEqual({
    ok: true,
    data: { isNew: true, isPrivate: true, twoFactorRequirement: null },
  })
  expect(request).toEqual({
    path: 'users/web/auth/whatsapp/verify/',
    options: {
      method: 'POST',
      json: { challenge_id: 'challenge-1', otp: '123456', partner: 'xplace' },
      retry: false,
    },
  })
  expect(invalidate).toHaveBeenCalledOnce()
})

test('ends the backend session and clears cached CSRF state on sign out', async () => {
  let request: { path: string; options?: ApiRequestOptions } | undefined
  const apiClient: ApiClient = {
    async request(path, options) {
      request = options === undefined ? { path } : { path, options }
      return null
    },
  }
  const invalidate = vi.fn()
  const gateway = createHttpWhatsAppAuthGateway(apiClient, { invalidate }, () => 'xplace')

  await expect(gateway.signOut()).resolves.toBeUndefined()

  expect(request).toEqual({
    path: 'users/web/auth/logout/',
    options: { method: 'POST', retry: false },
  })
  expect(invalidate).toHaveBeenCalledOnce()
})

test.each([
  [true, false, 'totp_setup_required'],
  [false, true, 'totp_required'],
] as const)('returns the required 2FA step after WhatsApp verification (%s, %s)', async (setup, verify, requirement) => {
  const gateway = createHttpWhatsAppAuthGateway({
    request: async () => ({ is_new: setup, is_private: true, totp_setup_required: setup, totp_required: verify }),
  }, { invalidate: vi.fn() }, () => 'xplace')
  await expect(gateway.verifyOtp({ challengeId: 'challenge-1', code: '123456' })).resolves.toMatchObject({
    ok: true, data: { twoFactorRequirement: requirement },
  })
})

test.each([
  null,
  {},
  { challenge_id: '', expires_in_seconds: 600, resend_after_seconds: 60 },
  { challenge_id: 'challenge-1', expires_in_seconds: -1, resend_after_seconds: 60 },
  { challenge_id: 'challenge-1', expires_in_seconds: 600, resend_after_seconds: 1.5 },
])('returns a safe failure for a malformed challenge response %#', async (body) => {
  const gateway = createHttpWhatsAppAuthGateway(
    { request: () => Promise.resolve(body) },
    { invalidate: vi.fn() },
    () => 'xplace',
  )

  await expect(gateway.requestCode({ phone: '554570290' })).resolves.toEqual({
    ok: false,
    code: 'otp-request-failed',
    message: 'Something went wrong. Please try again.',
  })
})

test.each([
  {
    messages: ['Invalid phone number'],
    expected: 'Invalid phone number',
  },
  {
    messages: ['Ensure this field has no more than 20 characters.'],
    expected: 'Ensure this field has no more than 20 characters.',
  },
  {
    messages: ['Invalid phone number.', 'Use the international format.'],
    expected: 'Invalid phone number. Use the international format.',
  },
])('shows backend phone validation messages $messages', async ({
  messages,
  expected,
}) => {
    const gateway = createHttpWhatsAppAuthGateway(
      {
        request: () =>
          Promise.reject(
            new ApiRequestError(
              'http',
              400,
              JSON.stringify({ phone: messages }),
              'Request failed with status 400',
            ),
          ),
      },
      { invalidate: vi.fn() },
      () => 'xplace',
    )

    await expect(
      gateway.requestCode({ phone: '11111111' }),
    ).resolves.toEqual({
      ok: false,
      code: 'otp-request-failed',
      message: expected,
    })
})

test('uses the safe fallback for a malformed backend field error', async () => {
  const gateway = createHttpWhatsAppAuthGateway(
    {
      request: () =>
        Promise.reject(
          new ApiRequestError(
            'http',
            400,
            JSON.stringify({ phone: [400, null] }),
            'Request failed with status 400',
          ),
        ),
    },
    { invalidate: vi.fn() },
    () => 'xplace',
  )

  await expect(
    gateway.requestCode({ phone: '11111111' }),
  ).resolves.toEqual({
    ok: false,
    code: 'otp-request-failed',
    message: 'Something went wrong. Please try again.',
  })
})

test.each([
  [
    { error: 'WhatsApp verification is unavailable' },
    'WhatsApp verification is unavailable',
  ],
  [{ detail: 'Invalid origin' }, 'Invalid origin'],
])('shows a backend request error from %#', async (body, expected) => {
  const gateway = createHttpWhatsAppAuthGateway(
    {
      request: () =>
        Promise.reject(
          new ApiRequestError(
            'http',
            400,
            JSON.stringify(body),
            'Request failed with status 400',
          ),
        ),
    },
    { invalidate: vi.fn() },
    () => 'xplace',
  )

  await expect(
    gateway.requestCode({ phone: '11111111' }),
  ).resolves.toEqual({
    ok: false,
    code: 'otp-request-failed',
    message: expected,
  })
})

test('formats the backend resend cooldown from a 429 response', async () => {
  const gateway = createHttpWhatsAppAuthGateway(
    {
      request: () =>
        Promise.reject(
          new ApiRequestError(
            'http',
            429,
            JSON.stringify({
              error: 'Please wait before requesting another code.',
              retry_after_seconds: 57,
            }),
            'Request failed with status 429',
          ),
        ),
    },
    { invalidate: vi.fn() },
    () => 'xplace',
  )

  await expect(gateway.requestCode({ phone: '554570290' })).resolves.toEqual({
    ok: false,
    code: 'otp-request-failed',
    message: 'Please try again in 57s.',
    retryAfterSeconds: 57,
  })
})

test.each([null, {}, { is_new: 'yes', is_private: true },
  { is_new: true, is_private: true },
  { is_new: true, is_private: true, totp_setup_required: true, totp_required: true },
  { is_new: false, is_private: false, totp_setup_required: true, totp_required: false },
])(
  'returns a safe failure for a malformed verification response %#',
  async (body) => {
    const invalidate = vi.fn()
    const gateway = createHttpWhatsAppAuthGateway(
      { request: () => Promise.resolve(body) },
      { invalidate },
      () => 'xplace',
    )

    await expect(
      gateway.verifyOtp({ challengeId: 'challenge-1', code: '123456' }),
    ).resolves.toEqual({
      ok: false,
      code: 'otp-verification-failed',
      message: 'Something went wrong. Please try again.',
    })
    expect(invalidate).not.toHaveBeenCalled()
  },
)

test('returns a safe verification failure for an invalid or expired code', async () => {
  const gateway = createHttpWhatsAppAuthGateway(
    {
      request: () =>
        Promise.reject(
          new ApiRequestError(
            'http',
            400,
            JSON.stringify({ error: 'Invalid or expired verification' }),
            'Request failed with status 400',
          ),
        ),
    },
    { invalidate: vi.fn() },
    () => 'xplace',
  )

  await expect(
    gateway.verifyOtp({ challengeId: 'challenge-1', code: '000000' }),
  ).resolves.toEqual({
    ok: false,
    code: 'otp-verification-failed',
    message: 'Invalid or expired verification',
  })
})

test('shows backend field validation when verifying a code', async () => {
  const gateway = createHttpWhatsAppAuthGateway(
    {
      request: () =>
        Promise.reject(
          new ApiRequestError(
            'http',
            400,
            JSON.stringify({ otp: ['Ensure this field has at most 8 characters.'] }),
            'Request failed with status 400',
          ),
        ),
    },
    { invalidate: vi.fn() },
    () => 'xplace',
  )

  await expect(
    gateway.verifyOtp({ challengeId: 'challenge-1', code: '123456' }),
  ).resolves.toEqual({
    ok: false,
    code: 'otp-verification-failed',
    message: 'Ensure this field has at most 8 characters.',
  })
})
