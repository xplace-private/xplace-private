import { queryOptions } from '@tanstack/react-query'

import type { ProfileGateway } from './api/profile-gateway'

export function profileQuery(gateway: ProfileGateway) {
  return queryOptions({
    queryKey: ['profile', 'account'],
    queryFn: ({ signal }) => gateway.getProfile(signal),
    staleTime: 60_000,
  })
}
