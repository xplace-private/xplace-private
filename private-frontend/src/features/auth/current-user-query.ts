import { queryOptions } from '@tanstack/react-query'

import type { CurrentUser, CurrentUserGateway } from './api/current-user-gateway'

export const CURRENT_USER_QUERY_KEY = ['auth', 'current-user'] as const

export class CurrentUserQueryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CurrentUserQueryError'
    this.code = code
  }
}

export function currentUserQueryOptions(gateway: CurrentUserGateway) {
  return queryOptions({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async ({ signal }): Promise<CurrentUser> => {
      const result = await gateway.get(signal)

      if (result.ok) {
        return result.data
      }

      throw new CurrentUserQueryError(result.code, result.message)
    },
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
}
