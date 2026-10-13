import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Skeleton } from '../../../shared/ui/skeleton'
import { TokenIcon } from '../../../shared/ui/token-icon'
import { formatUsd, type PaymentPlan } from '../model/payment-plan'
import { KNOWN_TRANSACTION_TYPES, type Transaction } from '../model/transaction'

export type { Transaction } from '../model/transaction'

export function TransactionListSkeleton({ rows }: { rows: number }) {
  const { t } = useAppTranslation()

  return (
    <ul className="min-w-0 list-none p-0" aria-label={t('transactions.loadingList')}>
      {Array.from({ length: rows }, (_, index) => (
        <li
          className="flex min-w-0 items-center justify-between gap-3 py-4"
          data-transaction-skeleton="true"
          key={index}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-5 w-32 max-w-full" />
            <Skeleton className="h-4 w-24 max-w-full" />
          </span>
          <span className="flex w-24 min-w-0 flex-col items-end gap-1">
            <Skeleton className="h-5 w-20 max-w-full" />
            <Skeleton className="h-4 w-16 max-w-full" />
          </span>
        </li>
      ))}
    </ul>
  )
}

interface TransactionRowProps {
  canPayOverTime?: boolean | undefined
  paymentPlan?: PaymentPlan | undefined
  transaction: Transaction
  onSelect?: ((transaction: Transaction) => void) | undefined
}

/** A single activity row with presentation derived from its transaction state. */
export function TransactionRow({
  canPayOverTime = false,
  paymentPlan,
  transaction,
  onSelect,
}: TransactionRowProps) {
  const { t } = useAppTranslation()
  const isReversed = transaction.state === 'reversed'
  const isAmountReplaced = isReversed || paymentPlan !== undefined
  const merchant = transaction.merchant ?? (
    KNOWN_TRANSACTION_TYPES.has(transaction.type) ? t('common.notAvailableShort') : transaction.type
  )

  return (
    <li className="border-b border-border last:border-b-0">
      <Button
        className="group -mx-4 h-auto w-[calc(100%+2rem)] items-stretch border-0 px-4 py-4 text-left tracking-normal normal-case active:translate-y-0 active:bg-primary/4"
        variant="ghost"
        textStyle="body-light"
        aria-label={t('transactions.openDetails', {
          merchant,
        })}
        onClick={() => onSelect?.(transaction)}
      >
        <span className="flex w-full min-w-0 items-center justify-between gap-3 transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-active:scale-[0.97] motion-reduce:group-active:scale-[0.99]">
          <span className="flex min-w-0 flex-1 flex-col gap-1 font-light">
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-base leading-5 text-foreground">
                {merchant}
              </span>
              {paymentPlan ? (
                <span className="shrink-0 border border-accent px-1.5 py-0.5 text-[8px] leading-none tracking-[1.1px] text-accent">
                  {t('transactions.planTag')}
                </span>
              ) : null}
            </span>
            <span className="truncate text-xs leading-4 text-secondary">
              {transaction.details}
            </span>
          </span>
          <span className="flex min-w-0 max-w-[55%] shrink-0 flex-col items-end gap-1 font-light">
            <span
              className={[
                'max-w-full truncate text-base leading-5 whitespace-nowrap',
                isAmountReplaced ? 'text-muted line-through' : 'text-foreground',
              ].join(' ')}
              aria-label={
                isReversed
                  ? t('transactions.reversedAmount', {
                      amount: transaction.amount,
                    })
                  : undefined
              }
            >
              {transaction.amount}
            </span>
            {paymentPlan ? (
              <span className="max-w-full truncate text-xs leading-4 whitespace-nowrap text-accent">
                {t('home.paymentPlans.monthly', {
                  amount: formatUsd(paymentPlan.monthlyPaymentCents),
                })}
              </span>
            ) : canPayOverTime ? (
              <span className="flex items-center gap-1 text-xs leading-4 whitespace-nowrap text-accent">
                <TokenIcon className="size-[11px] text-accent" src="/assets/home/pay-over-time.svg" />
                <span>{t('transactions.payOverTime')}</span>
              </span>
            ) : transaction.convertedAmount ? (
              <span className="max-w-full truncate text-xs leading-4 whitespace-nowrap text-secondary">
                {transaction.convertedAmount}
              </span>
            ) : null}
          </span>
        </span>
      </Button>
    </li>
  )
}

interface TransactionListProps {
  canPayOverTime?: ((transaction: Transaction) => boolean) | undefined
  paymentPlansByTransactionId?: ReadonlyMap<string, PaymentPlan> | undefined
  transactions: readonly Transaction[]
  onSelect?: ((transaction: Transaction) => void) | undefined
}

/** Activity list that preserves an explicit empty state for future API data. */
export function TransactionList({
  canPayOverTime,
  paymentPlansByTransactionId,
  transactions,
  onSelect,
}: TransactionListProps) {
  const { t } = useAppTranslation()

  if (transactions.length === 0) {
    return (
      <p className="text-xs leading-5 font-light text-secondary">
        {t('transactions.empty')}
      </p>
    )
  }

  return (
    <ul className="min-w-0 list-none p-0" aria-label={t('transactions.listLabel')}>
      {transactions.map((transaction) => (
        <TransactionRow
          canPayOverTime={canPayOverTime?.(transaction)}
          key={transaction.id}
          paymentPlan={paymentPlansByTransactionId?.get(transaction.id)}
          transaction={transaction}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}
