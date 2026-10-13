import { expect, test } from 'vitest'

import type { SumsubTokenGateway } from './api/sumsub-token-gateway'
import {
  SumsubTokenQueryError,
  SUMSUB_TOKEN_QUERY_KEY,
  loadSumsubToken,
} from './sumsub-token-query'

test('loads the token with its query key and forwards the abort signal', async () => {
  const signal = new AbortController().signal
  let receivedSignal: AbortSignal | undefined
  const gateway: SumsubTokenGateway = {
    get(gatewaySignal) {
      receivedSignal = gatewaySignal
      return Promise.resolve({ ok: true, data: { token: '_act-token', userId: '41' } })
    },
  }

  await expect(loadSumsubToken(gateway, signal)).resolves.toEqual({
    token: '_act-token',
    userId: '41',
  })
  expect(SUMSUB_TOKEN_QUERY_KEY).toEqual(['verification', 'sumsub-token'])
  expect(receivedSignal).toBe(signal)
})

test('throws only the safe gateway failure', async () => {
  const gateway: SumsubTokenGateway = {
    get: () =>
      Promise.resolve({
        ok: false,
        code: 'sumsub-token-failed',
        message: 'Something went wrong. Please try again.',
      }),
  }

  await expect(loadSumsubToken(gateway)).rejects.toEqual(
    new SumsubTokenQueryError(
      'sumsub-token-failed',
      'Something went wrong. Please try again.',
    ),
  )
})
