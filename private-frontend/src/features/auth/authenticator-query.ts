import { queryOptions } from '@tanstack/react-query'

import type { AuthenticatorGateway } from './api/authenticator-gateway'

export const AUTHENTICATOR_SETUP_QUERY_KEY = ['auth', 'authenticator-setup'] as const

export function authenticatorSetupQueryOptions(gateway: AuthenticatorGateway) {
  return queryOptions({
    queryKey: AUTHENTICATOR_SETUP_QUERY_KEY,
    queryFn: ({ signal }) => gateway.getSetup(signal),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 0,
  })
}
