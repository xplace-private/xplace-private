import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'

import { AppToaster } from '../shared/ui/app-toaster'
import { queryClient } from './query-client'

export function RootRoute() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <AppToaster />
    </QueryClientProvider>
  )
}
