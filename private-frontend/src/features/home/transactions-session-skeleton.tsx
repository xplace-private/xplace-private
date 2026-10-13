import { Skeleton } from '../../shared/ui/skeleton'
import { TokenIcon } from '../../shared/ui/token-icon'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { TransactionListSkeleton } from './components/transaction-list'
import {
  currentTransactionPeriod,
  isSameTransactionPeriod,
  transactionPeriodsSince,
} from './transaction-period'

export function TransactionSummarySkeleton() {
  const { t } = useAppTranslation()

  return (
    <section
      className="flex min-w-0 items-start justify-between border border-border bg-card p-4"
      aria-label={t('transactions.loadingList')}
    >
      <div className="flex min-w-0 flex-col gap-[5px]">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex min-w-0 flex-col items-end gap-[5px]">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-28" />
      </div>
    </section>
  )
}

/** Transaction-shaped loading state used while the stored session is validated. */
export function TransactionsSessionSkeleton() {
  const { i18n, t } = useAppTranslation()
  const currentPeriod = currentTransactionPeriod()
  const periods = transactionPeriodsSince(
    new Date(currentPeriod.year, currentPeriod.month - 4, 1),
  )

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 pt-6 pb-4">
      <div className="flex w-fit items-center gap-[7px] border-0 p-0 text-[11px] leading-[13px] font-normal tracking-[1.6px] text-secondary uppercase">
        <TokenIcon className="size-[13px]" src="/assets/transactions/back.svg" />
        {t('common.actions.account')}
      </div>

      <div className="flex min-w-0 w-full gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {periods.map((period, index) => (
          <span
            className={[
              'shrink-0 border px-3.5 py-[8.5px] text-[11px] leading-[13px] font-normal tracking-[1.4px] uppercase',
              index === 0
                ? 'border-transparent bg-foreground text-background'
                : 'border-border bg-transparent text-secondary',
            ].join(' ')}
            key={`${period.year}-${period.month}`}
          >
            {isSameTransactionPeriod(period, currentPeriod)
              ? t('transactions.thisPeriod')
              : new Date(period.year, period.month - 1).toLocaleDateString(
                i18n.resolvedLanguage ?? 'en', {
                  month: 'long',
                  year: 'numeric',
                },
              )}
          </span>
        ))}
      </div>

      <TransactionSummarySkeleton />

      <div className="min-h-90">
        <TransactionListSkeleton rows={5} />
      </div>
    </div>
  )
}
