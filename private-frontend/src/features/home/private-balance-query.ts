import { queryOptions, useQuery } from '@tanstack/react-query'

import type {
  PrivateBalance,
  PrivateBalanceGateway,
} from './api/private-balance-gateway'

export const PRIVATE_BALANCE_QUERY_KEY = ['home', 'private-balance'] as const

export class PrivateBalanceQueryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'PrivateBalanceQueryError'
    this.code = code
  }
}

export function privateBalanceQueryOptions(gateway: PrivateBalanceGateway) {
  return queryOptions({
    queryKey: PRIVATE_BALANCE_QUERY_KEY,
    queryFn: async (): Promise<PrivateBalance> => {
      // The route owns this refresh, so it must survive transient unmounts.
      const result = await gateway.get()
      if (result.ok) return result.data
      throw new PrivateBalanceQueryError(result.code, result.message)
    },
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}

export function usePrivateBalance(
  gateway: PrivateBalanceGateway,
  enabled: boolean,
) {
  return useQuery({ ...privateBalanceQueryOptions(gateway), enabled })
}
