import { useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { useAuthFlow } from '../features/auth/auth-flow-provider'
import { useCards } from '../features/home/cards-provider'
import { formatUsd } from '../features/home/model/payment-plan'
import { usePaymentPlans } from '../features/home/payment-plans-provider'
import {
  currentTransactionPeriod,
  transactionPeriodsSince,
} from '../features/home/transaction-period'
import { useTransactions } from '../features/home/transactions-provider'
import { TransactionsScreen } from '../features/home/transactions-screen'
import { formatShortDate } from '../shared/format-short-date'
import { useAppTranslation } from '../shared/i18n/app-i18n'
import { returnToHome } from './navigation'

export function TransactionsRoute() {
  const { i18n, t } = useAppTranslation()
  const router = useRouter()
  const { session } = useAuthFlow()
  const cards = useCards()
  const [activePeriod, setActivePeriod] = useState(currentTransactionPeriod)
  const earliestCardCreatedAt = cards.cards.reduce<Date | undefined>(
    (earliest, card) =>
      card.createdAt !== undefined &&
      (earliest === undefined || card.createdAt < earliest)
        ? card.createdAt
        : earliest,
    undefined,
  )
  const periods = useMemo(
    () => transactionPeriodsSince(earliestCardCreatedAt),
    [earliestCardCreatedAt],
  )
  const transactions = useTransactions({
    enabled: session.status === 'authenticated',
    pageSize: 20,
    period: activePeriod,
  })
  const { state: paymentPlansState, startPlan } = usePaymentPlans()
  const paymentPlansReady =
    session.status === 'authenticated' && paymentPlansState.status === 'ready'
  const transactionsLoading =
    session.status === 'authenticated' &&
    transactions.status === 'loading'

  return (
    <TransactionsScreen
      transactions={transactions.status === 'ready' ? transactions.transactions : []}
      transactionsLoading={transactionsLoading}
      transactionsError={transactions.error ?? undefined}
      count={transactions.summary?.transactionCount ?? 0}
      spent={
        transactions.summary === null
          ? t('common.notAvailableShort')
          : formatUsd(transactions.summary.totalSpentCents, i18n.resolvedLanguage)
      }
      dueDate={
        transactions.summary === null
          ? t('common.notAvailableShort')
          : formatShortDate(
            transactions.summary.dueDate,
            i18n.resolvedLanguage ?? 'en',
          )
      }
      hasNextPage={transactions.hasNextPage}
      isLoadingMore={transactions.isLoadingMore}
      plans={paymentPlansState.plans}
      paymentPlansError={paymentPlansState.loadError ?? undefined}
      startPlan={paymentPlansReady ? startPlan : undefined}
      onLoadMore={transactions.loadMore}
      onRetryTransactions={transactions.retry}
      periods={periods}
      activePeriod={activePeriod}
      onSelectPeriod={setActivePeriod}
      onBack={() => returnToHome(router.history)}
    />
  )
}
