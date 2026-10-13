import { useState } from 'react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import { InfoBanner } from '../../shared/ui/info-banner'
import { TokenIcon } from '../../shared/ui/token-icon'
import { PaymentPlanStartModal } from './components/payment-plan-start-modal'
import { TransactionDetailModal } from './components/transaction-detail-modal'
import { TransactionInfiniteScroll } from './components/transaction-infinite-scroll'
import {
  TransactionList,
  TransactionListSkeleton,
  type Transaction,
} from './components/transaction-list'
import {
  isPayOverTimeEligible,
  type PaymentPlan,
} from './model/payment-plan'
import { allTransactions } from './transaction-data'
import {
  currentTransactionPeriod,
  isSameTransactionPeriod,
  type TransactionPeriod,
} from './transaction-period'
import { TransactionSummarySkeleton } from './transactions-session-skeleton'
import { usePaymentPlanStart, type StartPaymentPlan } from './use-payment-plan-start'

interface PeriodTabsProps {
  periods: readonly TransactionPeriod[]
  activePeriod: TransactionPeriod
  currentPeriod: TransactionPeriod
  onSelect: (period: TransactionPeriod) => void
}

/** Horizontally scrollable period selector with one active visual state. */
export function PeriodTabs({
  periods,
  activePeriod,
  currentPeriod,
  onSelect,
}: PeriodTabsProps) {
  const { i18n, t } = useAppTranslation()

  return (
    <div
      className="flex min-w-0 w-full gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={t('transactions.periodsLabel')}
    >
      {periods.map((period) => {
        const isActive = isSameTransactionPeriod(period, activePeriod)

        return (
          <Button
            className={isActive
              ? 'shrink-0 shadow-none'
              : 'shrink-0 text-secondary shadow-none'}
            variant={isActive ? 'default' : 'outline'}
            size="chip"
            textStyle="body"
            aria-pressed={isActive}
            key={`${period.year}-${period.month}`}
            onClick={() => onSelect(period)}
          >
            {isSameTransactionPeriod(period, currentPeriod)
              ? t('transactions.thisPeriod')
              : new Date(period.year, period.month - 1).toLocaleDateString(
                i18n.resolvedLanguage ?? 'en', {
                  month: 'long',
                  year: 'numeric',
                },
              )}
          </Button>
        )
      })}
    </div>
  )
}

interface TransactionsScreenProps {
  transactions?: readonly Transaction[]
  transactionsLoading?: boolean | undefined
  transactionsError?: string | undefined
  count?: number | undefined
  spent?: string | undefined
  dueDate?: string | undefined
  hasNextPage?: boolean | undefined
  isLoadingMore?: boolean | undefined
  plans?: readonly PaymentPlan[]
  paymentPlansError?: string | undefined
  startPlan?: StartPaymentPlan | undefined
  onLoadMore?: (() => void) | undefined
  onRetryTransactions?: (() => void) | undefined
  periods?: readonly TransactionPeriod[]
  activePeriod?: TransactionPeriod | undefined
  onSelectPeriod?: ((period: TransactionPeriod) => void) | undefined
  onBack?: () => void
}

const DEFAULT_PERIOD = currentTransactionPeriod()

/** Full transaction history screen from the account activity entry point. */
export function TransactionsScreen({
  transactions = allTransactions,
  transactionsLoading = false,
  transactionsError,
  count = 12,
  spent = 'USD 6,239',
  dueDate = 'N/A',
  hasNextPage = false,
  isLoadingMore = false,
  plans = [],
  paymentPlansError,
  startPlan,
  onLoadMore,
  onRetryTransactions,
  periods = [DEFAULT_PERIOD],
  activePeriod = DEFAULT_PERIOD,
  onSelectPeriod,
  onBack,
}: TransactionsScreenProps) {
  const { t } = useAppTranslation()
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const paymentPlanStart = usePaymentPlanStart(startPlan)
  const hasInitialTransactionsError =
    transactionsError !== undefined && transactions.length === 0
  const paymentPlansByTransactionId = new Map(
    plans.map((plan) => [plan.transactionId, plan]),
  )

  const canPayOverTime = (transaction: Transaction) =>
    startPlan !== undefined &&
    isPayOverTimeEligible(transaction, paymentPlansByTransactionId.has(transaction.id))

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 pt-6 pb-4">
      <Button
        className="w-fit text-secondary"
        variant="ghost"
        size="back"
        textStyle="body"
        onClick={onBack}
      >
        <TokenIcon className="size-[13px]" src="/assets/transactions/back.svg" />
        {t('common.actions.account')}
      </Button>

      <PeriodTabs
        periods={periods}
        activePeriod={activePeriod}
        currentPeriod={DEFAULT_PERIOD}
        onSelect={onSelectPeriod ?? (() => undefined)}
      />

      {transactionsLoading ? <TransactionSummarySkeleton /> : <section className="flex min-w-0 items-start justify-between border border-border bg-card p-4">
        <div className="flex min-w-0 flex-col gap-[5px]">
          <span className="text-xs leading-5 font-light text-secondary">
            {t('transactions.spent')}
          </span>
          <strong className="text-base leading-4 font-bold">
            {spent}
          </strong>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-[5px] text-right">
          <span className="text-xs leading-5 font-light text-secondary">
            {t('transactions.due', { date: dueDate })}
          </span>
          <strong className="text-base leading-4 font-bold whitespace-nowrap">
            {hasInitialTransactionsError
              ? t('common.notAvailableShort')
              : t('transactions.count', { count })}
          </strong>
        </div>
      </section>}

      {paymentPlansError ? (
        <InfoBanner variant="warning">
          {t('home.paymentPlans.errors.load')}
        </InfoBanner>
      ) : null}
      {transactionsError ? (
        <InfoBanner variant="warning">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span>{t('transactions.errors.load')}</span>
            {onRetryTransactions ? (
              <Button variant="outline" size="sm" onClick={onRetryTransactions}>
                {t('common.actions.retry')}
              </Button>
            ) : null}
          </div>
        </InfoBanner>
      ) : null}

      <div className="min-h-90">
        {transactionsLoading ? (
          <TransactionListSkeleton rows={5} />
        ) : hasInitialTransactionsError ? null : (
          <>
            <TransactionList
              canPayOverTime={canPayOverTime}
              paymentPlansByTransactionId={paymentPlansByTransactionId}
              transactions={transactions}
              onSelect={setSelectedTransaction}
            />
            {isLoadingMore ? <TransactionListSkeleton rows={3} /> : null}
            {hasNextPage && onLoadMore && !transactionsError ? (
              <TransactionInfiniteScroll enabled={!isLoadingMore} onLoadMore={onLoadMore} />
            ) : null}
          </>
        )}
      </div>

      {selectedTransaction ? (
        <TransactionDetailModal
          canPayOverTime={canPayOverTime(selectedTransaction)}
          paymentPlan={paymentPlansByTransactionId.get(selectedTransaction.id)}
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onPayOverTime={() => {
            setSelectedTransaction(null)
            paymentPlanStart.open(selectedTransaction)
          }}
        />
      ) : null}

      {paymentPlanStart.transaction ? (
        <PaymentPlanStartModal
          error={paymentPlanStart.error}
          isSubmitting={paymentPlanStart.isSubmitting}
          transaction={paymentPlanStart.transaction}
          onClose={paymentPlanStart.close}
          onStart={(term) => void paymentPlanStart.start(term)}
        />
      ) : null}
    </div>
  )
}
