import { useRouterState } from '@tanstack/react-router'

import { HomeSessionSkeleton } from '../features/home/home-session-skeleton'
import { TransactionsSessionSkeleton } from '../features/home/transactions-session-skeleton'
import { useAppTranslation } from '../shared/i18n/app-i18n'
import { Loader } from '../shared/ui/loader'
import { PrivatePageShell } from '../shared/ui/private-page-shell'

function AccountRouteLoader() {
  const { t } = useAppTranslation()

  return (
    <div className="flex min-h-[441px] min-w-0 max-w-full items-center justify-center">
      <Loader label={t('route.loadingAccount')} tone="light" />
    </div>
  )
}

export function SessionRoutePending() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const content =
    pathname === '/home' ? (
      <HomeSessionSkeleton />
    ) : pathname === '/transactions' ? (
      <TransactionsSessionSkeleton />
    ) : (
      <AccountRouteLoader />
    )

  return (
    <PrivatePageShell>
      {content}
    </PrivatePageShell>
  )
}
