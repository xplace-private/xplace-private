import { queryOptions } from '@tanstack/react-query'

import type { OccupationGateway } from './api/occupation-gateway'
import type { Occupation } from './model/onboarding-flow'

export class OccupationQueryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'OccupationQueryError'
    this.code = code
  }
}

export function occupationQueryOptions(
  gateway: OccupationGateway,
  search: string,
) {
  const normalizedSearch = search.trim()

  return queryOptions({
    queryKey: ['onboarding', 'occupations', normalizedSearch] as const,
    queryFn: async ({ signal }): Promise<readonly Occupation[]> => {
      const result = await gateway.list(normalizedSearch, signal)

      if (result.ok) return result.data

      throw new OccupationQueryError(result.code, result.message)
    },
    retry: false,
    refetchOnWindowFocus: false,
  })
}
