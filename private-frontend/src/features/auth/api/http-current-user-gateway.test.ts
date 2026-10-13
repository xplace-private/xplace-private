import { describe, expect, test, vi } from 'vitest'

import { createHttpCurrentUserGateway } from './http-current-user-gateway'
import { ApiRequestError } from '../../../shared/api/api-client'

const failure = {
  ok: false,
  code: 'current-user-failed',
  message: 'Unable to restore session. Try again.',
}

test.each(['totp_setup_required', 'totp_required'] as const)('recognizes the backend %s gate on an existing cookie session', async (code) => {
  const gateway = createHttpCurrentUserGateway({
    request: async () => { throw new ApiRequestError('http', 403, JSON.stringify({ error: code }), 'Forbidden') },
  })
  await expect(gateway.get()).resolves.toMatchObject({ ok: false, code })
})

test('keeps unrelated forbidden responses as a session recovery failure', async () => {
  const gateway = createHttpCurrentUserGateway({
    request: async () => { throw new ApiRequestError('http', 403, '{"detail":"Invalid origin"}', 'Forbidden') },
  })
  await expect(gateway.get()).resolves.toEqual(failure)
})

test('loads the authenticated current user from users/me', async () => {
  const request = vi.fn().mockResolvedValue({
    id: 2,
    username: 'alex.morgan',
    email: 'user@example.com',
    avatar: null,
  })
  const gateway = createHttpCurrentUserGateway({ request })

  await expect(gateway.get()).resolves.toEqual({
    ok: true,
    data: {
      id: 2,
      username: 'alex.morgan',
      email: 'user@example.com',
      avatar: null,
    },
  })
  expect(request).toHaveBeenCalledWith('users/me/', {
    authenticated: true,
    signal: undefined,
  })
})

test('accepts a WhatsApp user without an email address', async () => {
  const gateway = createHttpCurrentUserGateway({
    request: () =>
      Promise.resolve({
        id: 3,
        username: null,
        email: null,
        avatar: null,
      }),
  })

  await expect(gateway.get()).resolves.toEqual({
    ok: true,
    data: { id: 3, username: null, email: null, avatar: null },
  })
})

describe('createHttpCurrentUserGateway', () => {
  test.each([
    ['negative id', { id: -1, username: null, email: 'user@example.com', avatar: null }],
    ['fractional id', { id: 2.5, username: null, email: 'user@example.com', avatar: null }],
    ['string id', { id: '2', username: null, email: 'user@example.com', avatar: null }],
    ['missing email', { id: 2, username: null, avatar: null }],
    ['blank email', { id: 2, username: null, email: '  ', avatar: null }],
    ['non-string email', { id: 2, username: null, email: 2, avatar: null }],
    ['non-string username', { id: 2, username: 2, email: 'user@example.com', avatar: null }],
    ['non-string avatar', { id: 2, username: null, email: 'user@example.com', avatar: 2 }],
  ])('returns a safe failure for a %s response', async (_case, body) => {
    const gateway = createHttpCurrentUserGateway({
      request: () => Promise.resolve(body),
    })

    await expect(gateway.get()).resolves.toEqual(failure)
  })

  test('returns a safe failure when the API request rejects', async () => {
    const gateway = createHttpCurrentUserGateway({
      request: () => Promise.reject(new Error('network unavailable')),
    })

    await expect(gateway.get()).resolves.toEqual(failure)
  })
})
