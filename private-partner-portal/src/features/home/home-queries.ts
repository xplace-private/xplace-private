import { queryOptions } from '@tanstack/react-query'

import type { ClientsQuery, HomeGateway } from './api/home-gateway'

export function overviewQuery(gateway: HomeGateway) {
  return queryOptions({
    queryKey: ['home', 'overview'],
    queryFn: ({ signal }) => gateway.getOverview(signal),
    staleTime: 60_000,
  })
}

export function clientsQuery(gateway: HomeGateway, query: ClientsQuery) {
  return queryOptions({
    queryKey: ['home', 'clients', query],
    queryFn: async ({ signal }) => {
      const result = await gateway.getClients(query, signal)
      const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize))
      return result.page > lastPage ? gateway.getClients({ ...query, page: lastPage }, signal) : result
    },
    staleTime: 30_000,
  })
}
