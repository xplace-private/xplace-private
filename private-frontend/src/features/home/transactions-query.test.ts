import { expect, test, vi } from 'vitest'

import type { TransactionsGateway } from './api/transactions-gateway'
import {
  TransactionsQueryError,
  transactionsInfiniteQueryOptions,
} from './transactions-query'

function createGateway(): TransactionsGateway {
  return {
    list: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        count: 21,
        nextPage: 2,
        transactions: [],
        summary: { year: 2026, month: 8, transactionCount: 21, totalSpentCents: 1000, dueDate: '2026-09-05' },
      },
    }),
  }
}

test('keys the private transaction feed by page size and selected month', () => {
  const gateway = createGateway()
  const fullPage = transactionsInfiniteQueryOptions(gateway, { pageSize: 20 })
  const samePage = transactionsInfiniteQueryOptions(gateway, { pageSize: 20 })
  const homePage = transactionsInfiniteQueryOptions(gateway, { pageSize: 5 })
  const july = transactionsInfiniteQueryOptions(gateway, {
    pageSize: 20,
    period: { year: 2026, month: 7 },
  })

  expect(fullPage.queryKey).toEqual(['home', 'transactions', 20, null, null])
  expect(fullPage.queryKey).toEqual(samePage.queryKey)
  expect(fullPage.queryKey).not.toEqual(homePage.queryKey)
  expect(july.queryKey).toEqual(['home', 'transactions', 20, 2026, 7])
  expect(fullPage.initialPageParam).toBe(1)
  expect(fullPage.getNextPageParam?.({ nextPage: 2 } as never, [], 1, [])).toBe(2)
})

test('requests the supplied page and surfaces a safe typed failure', async () => {
  const gateway = createGateway()
  const options = transactionsInfiniteQueryOptions(gateway, {
    pageSize: 5,
    period: { year: 2026, month: 8 },
  })

  await expect(
    options.queryFn?.({ pageParam: 3, signal: new AbortController().signal } as never),
  ).resolves.toMatchObject({ nextPage: 2 })
  expect(gateway.list).toHaveBeenCalledWith({
    page: 3,
    pageSize: 5,
    period: { year: 2026, month: 8 },
    signal: expect.any(AbortSignal),
  })

  const failureGateway: TransactionsGateway = {
    ...gateway,
    list: () =>
      Promise.resolve({
        ok: false,
        code: 'transactions-failed',
        message: 'Unable to load transactions. Try again.',
      }),
  }
  const failure = transactionsInfiniteQueryOptions(failureGateway, { pageSize: 20 })

  await expect(
    failure.queryFn?.({ pageParam: 1, signal: new AbortController().signal } as never),
  ).rejects.toEqual(
    new TransactionsQueryError(
      'transactions-failed',
      'Unable to load transactions. Try again.',
    ),
  )
})
