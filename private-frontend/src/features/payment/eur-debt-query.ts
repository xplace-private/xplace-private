import { useQuery } from '@tanstack/react-query'

import type { EurDebtGateway, EurDebtQuote } from './api/eur-debt-gateway'

export const EUR_DEBT_QUERY_KEY = ['payment', 'eur-debt'] as const

export type EurDebtState =
  | { status: 'loading' | 'unavailable' | 'error' }
  | { status: 'ready'; quote: EurDebtQuote }

export function useEurDebt(gateway: EurDebtGateway) {
  const query = useQuery({
    queryKey: EUR_DEBT_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const result = await gateway.get(signal)
      if (!result.ok) throw new Error(result.message)
      return result.data
    },
    retry: false,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })
  const state: EurDebtState = query.isFetching || query.isPending
    ? { status: 'loading' }
    : query.isError
      ? { status: 'error' }
      : { status: 'ready', quote: query.data }

  return { state }
}
