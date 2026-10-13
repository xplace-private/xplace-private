import { queryOptions } from '@tanstack/react-query'

import type { CardsGateway } from './api/cards-gateway'
import type { HomeCard } from './model/card-collection'

export const CARDS_QUERY_KEY = ['home', 'cards'] as const

export class CardsQueryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CardsQueryError'
    this.code = code
  }
}

export function cardsQueryOptions(gateway: CardsGateway) {
  return queryOptions({
    queryKey: CARDS_QUERY_KEY,
    queryFn: async ({ signal }): Promise<readonly HomeCard[]> => {
      const listed = await gateway.list(signal)
      if (!listed.ok) throw new CardsQueryError(listed.code, listed.message)
      if (listed.data.length > 0) return listed.data

      const issued = await gateway.issueVirtual(undefined, signal)
      if (!issued.ok) throw new CardsQueryError(issued.code, issued.message)

      const refreshed = await gateway.list(signal)
      if (!refreshed.ok) throw new CardsQueryError(refreshed.code, refreshed.message)
      if (refreshed.data.length === 0) {
        throw new CardsQueryError(
          'card-issue-refresh-failed',
          'Card issued, but the card list could not be refreshed. Try again.',
        )
      }

      return refreshed.data
    },
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
