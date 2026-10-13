import { infiniteQueryOptions } from '@tanstack/react-query'

import type { TransactionsGateway, TransactionsListInput } from './api/transactions-gateway'

type TransactionsQueryInput = Omit<TransactionsListInput, 'page' | 'signal'>

export const TRANSACTIONS_QUERY_KEY = ['home', 'transactions'] as const

export class TransactionsQueryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'TransactionsQueryError'
    this.code = code
  }
}

export function transactionsInfiniteQueryOptions(
  gateway: TransactionsGateway,
  input: TransactionsQueryInput,
) {
  return infiniteQueryOptions({
    queryKey: [
      ...TRANSACTIONS_QUERY_KEY,
      input.pageSize,
      input.period?.year ?? null,
      input.period?.month ?? null,
    ] as const,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      const result = await gateway.list({ ...input, page: pageParam, signal })
      if (result.ok) return result.data
      throw new TransactionsQueryError(result.code, result.message)
    },
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
