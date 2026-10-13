import { expect, test } from 'vitest'

import type { CurrentUserGateway } from './api/current-user-gateway'
import {
  CURRENT_USER_QUERY_KEY,
  CurrentUserQueryError,
  currentUserQueryOptions,
} from './current-user-query'

test('disables Query retry and throws a safe typed error for a gateway failure', async () => {
  const gateway: CurrentUserGateway = {
    get: () =>
      Promise.resolve({
        ok: false,
        code: 'current-user-failed',
        message: 'Unable to restore session. Try again.',
      }),
  }
  const options = currentUserQueryOptions(gateway)

  expect(options.queryKey).toEqual(CURRENT_USER_QUERY_KEY)
  expect(options.retry).toBe(false)
  expect(options.retryOnMount).toBe(false)
  expect(options.refetchOnWindowFocus).toBe(false)
  expect(options.staleTime).toBe(Infinity)
  await expect(
    options.queryFn?.({ signal: new AbortController().signal } as never),
  ).rejects.toMatchObject({
    name: 'CurrentUserQueryError',
    code: 'current-user-failed',
    message: 'Unable to restore session. Try again.',
  })
})

test('returns the current user and forwards the Query abort signal', async () => {
  const signal = new AbortController().signal
  let receivedSignal: AbortSignal | undefined
  const gateway: CurrentUserGateway = {
    get: (gatewaySignal) => {
      receivedSignal = gatewaySignal
      return Promise.resolve({
        ok: true,
        data: {
          id: 2,
          username: 'alex.morgan',
          email: 'user@example.com',
          avatar: null,
        },
      })
    },
  }

  const result = await currentUserQueryOptions(gateway).queryFn?.({ signal } as never)

  expect(result).toEqual({
    id: 2,
    username: 'alex.morgan',
    email: 'user@example.com',
    avatar: null,
  })
  expect(receivedSignal).toBe(signal)
})

test('preserves the gateway code and message on typed errors', () => {
  const error = new CurrentUserQueryError(
    'current-user-failed',
    'Unable to restore session. Try again.',
  )

  expect(error).toMatchObject({
    name: 'CurrentUserQueryError',
    code: 'current-user-failed',
    message: 'Unable to restore session. Try again.',
  })
})
