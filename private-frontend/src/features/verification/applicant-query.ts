import { queryOptions } from '@tanstack/react-query'

import type { ApplicantGateway } from './api/applicant-gateway'

export const APPLICANT_QUERY_KEY = ['verification', 'applicant'] as const

export class ApplicantQueryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApplicantQueryError'
    this.code = code
  }
}

export function applicantQueryOptions(gateway: ApplicantGateway) {
  return queryOptions({
    queryKey: APPLICANT_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const result = await gateway.get(signal)
      if (result.ok) return result.data
      throw new ApplicantQueryError(result.code, result.message)
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
}
