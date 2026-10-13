import { expect, test } from 'vitest'

import type { OccupationGateway } from './api/occupation-gateway'
import {
  OccupationQueryError,
  occupationQueryOptions,
} from './occupation-query'

test('uses the normalized search in the key and forwards it with the abort signal', async () => {
  const signal = new AbortController().signal
  let receivedSearch: string | undefined
  let receivedSignal: AbortSignal | undefined
  const gateway: OccupationGateway = {
    list(search, gatewaySignal) {
      receivedSearch = search
      receivedSignal = gatewaySignal
      return Promise.resolve({
        ok: true,
        data: [{ id: 11, name: 'Accountant' }],
      })
    },
  }
  const options = occupationQueryOptions(gateway, '  account  ')

  await expect(options.queryFn?.({ signal } as never)).resolves.toEqual([
    { id: 11, name: 'Accountant' },
  ])
  expect(options.queryKey).toEqual(['onboarding', 'occupations', 'account'])
  expect(receivedSearch).toBe('account')
  expect(receivedSignal).toBe(signal)
  expect(options.retry).toBe(false)
  expect(options.refetchOnWindowFocus).toBe(false)
})

test('throws a safe typed error for a gateway failure', async () => {
  const gateway: OccupationGateway = {
    list: () =>
      Promise.resolve({
        ok: false,
        code: 'occupations-failed',
        message: 'Unable to load occupations. Try again.',
      }),
  }

  await expect(
    occupationQueryOptions(gateway, '').queryFn?.({
      signal: new AbortController().signal,
    } as never),
  ).rejects.toEqual(
    new OccupationQueryError(
      'occupations-failed',
      'Unable to load occupations. Try again.',
    ),
  )
})
