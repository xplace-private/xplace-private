import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { ModalShell } from '../../../shared/ui/modal-shell'
import {
  formatUsd,
  getRemainingBalanceCents,
  type PaymentPlan,
} from '../model/payment-plan'
import {
  KNOWN_TRANSACTION_TYPES,
  type DeclineReasonCategory,
  type Transaction,
} from '../model/transaction'

interface TransactionDetailModalProps {
  canPayOverTime?: boolean | undefined
  paymentPlan?: PaymentPlan | undefined
  transaction: Transaction
  onClose: () => void
  onPayOverTime?: (() => void) | undefined
}

const statusClasses = new Map([
  ['completed', 'border-positive text-positive'],
  ['pending', 'border-warning/50 text-warning'],
  ['refunded', 'border-positive text-positive'],
  ['declined', 'border-destructive text-destructive'],
  ['reversed', 'border-border text-secondary'],
])

const declineReasonKeys: Record<DeclineReasonCategory, string> = {
  insufficient_funds: 'transactions.details.declineReasons.insufficientFunds',
  limits: 'transactions.details.declineReasons.limits',
  blocked_merchant: 'transactions.details.declineReasons.blockedMerchant',
  incorrect_card_data: 'transactions.details.declineReasons.incorrectCardData',
  try_again: 'transactions.details.declineReasons.tryAgain',
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-border py-3 text-xs leading-5 font-light">
      <span className="shrink-0 text-foreground">{label}</span>
      <span className="min-w-0 text-right text-secondary">{value}</span>
    </div>
  )
}

/** Shared detail sheet for every transaction state. */
export function TransactionDetailModal({
  canPayOverTime = false,
  paymentPlan,
  transaction,
  onClose,
  onPayOverTime,
}: TransactionDetailModalProps) {
  const { t } = useAppTranslation()
  const isPaymentReceived = transaction.type === 'top_up'
  const isKnownType = KNOWN_TRANSACTION_TYPES.has(transaction.type)
  const isDateOnly = transaction.type === 'physical_card' || !isKnownType
  const merchant = transaction.merchant ?? (
    isKnownType ? t('common.notAvailableShort') : transaction.type
  )
  const statusMessages = new Map<string, readonly string[]>([
    ['refunded', [
      t('transactions.details.refundedLine1'),
      t('transactions.details.refundedLine2'),
    ]],
    ['reversed', [
      t('transactions.details.reversedLine1'),
      t('transactions.details.reversedLine2'),
    ]],
  ])
  const statusMessage = paymentPlan
    ? [
        t('transactions.details.planLine'),
        t('transactions.details.remaining', {
          amount: formatUsd(getRemainingBalanceCents(paymentPlan)),
        }),
      ]
    : transaction.state === 'declined' && transaction.declineReasonCategory
      ? [t(declineReasonKeys[transaction.declineReasonCategory])]
      : statusMessages.get(transaction.state)

  return (
    <ModalShell
      ariaLabel={t('transactions.openDetails', {
        merchant,
      })}
      onClose={onClose}
      panelClassName="p-[26px]"
    >
      <header className="flex min-w-0 flex-col items-center gap-8 border-b border-border pb-4 text-center">
        <h2 className="max-w-full text-base leading-7 font-light wrap-anywhere text-foreground">
          {merchant}
        </h2>
        {isPaymentReceived ? (
          <strong className="text-2xl leading-9 font-bold tracking-normal">
            −{transaction.amount}
          </strong>
        ) : (
          <div className="flex min-w-0 flex-col items-center gap-2.5 py-2">
            <strong className="text-2xl leading-8 font-bold tracking-normal">
              {transaction.amount}
            </strong>
            {transaction.convertedAmount ? (
              <span
                className={
                  paymentPlan
                    ? 'text-xs leading-5 font-light text-secondary'
                    : 'font-sans text-xs leading-5 font-light tracking-[1.6px] text-secondary uppercase'
                }
              >
                {transaction.convertedAmount}
              </span>
            ) : null}
          </div>
        )}
        <div className="flex w-full flex-col items-center gap-4">
          <span
            className={`w-fit max-w-full border px-1.5 py-0.5 text-[8px] leading-3 font-light tracking-[1.6px] wrap-anywhere uppercase ${statusClasses.get(transaction.state) ?? 'border-border text-secondary'}`}
          >
            {statusClasses.has(transaction.state)
              ? t(`transactions.status.${transaction.state}`)
              : transaction.state}
          </span>
          {statusMessage ? (
            <p className="text-xs leading-[19.2px] font-light text-secondary">
              {statusMessage.map((line) => (
                <span className="block" key={line}>
                  {line}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </header>

      <div>
        {isDateOnly ? (
          <DetailRow label={t('transactions.details.date')} value={transaction.date ?? t('common.notAvailableShort')} />
        ) : isPaymentReceived ? (
          <>
            <DetailRow label={t('transactions.details.category')} value="Payment" />
            <DetailRow label={t('transactions.details.date')} value={transaction.date ?? t('common.notAvailableShort')} />
          </>
        ) : (
          <>
            <DetailRow label={t('transactions.details.category')} value={transaction.category ?? t('common.notAvailableShort')} />
            <DetailRow label={t('transactions.details.date')} value={transaction.date ?? t('common.notAvailableShort')} />
            {transaction.location !== null ? (
              <DetailRow label={t('transactions.details.location')} value={transaction.location} />
            ) : null}
            <DetailRow label={t('transactions.details.card')} value={transaction.card || t('common.notAvailableShort')} />
            {transaction.rate !== null ? (
              <DetailRow label={t('transactions.details.rate')} value={transaction.rate} />
            ) : null}
            {paymentPlan ? (
              <DetailRow
                label={t('transactions.details.plan')}
                value={`${t('home.paymentPlans.months', { count: paymentPlan.termMonths })} · ${t('home.paymentPlans.monthly', { amount: formatUsd(paymentPlan.monthlyPaymentCents) })}`}
              />
            ) : null}
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 pt-[18px]">
        {isPaymentReceived || isDateOnly ? (
          <Button className="w-full" variant="outline" size="default" onClick={onClose}>
            {t('common.actions.close')}
          </Button>
        ) : (
          <>
            {canPayOverTime && !paymentPlan && onPayOverTime ? (
              <Button className="w-full" variant="default" size="md" onClick={onPayOverTime}>
                {t('transactions.payOverTime')}
              </Button>
            ) : null}
            <div className="flex min-w-0 gap-2">
              <Button className="flex-1" variant="outline" size="default" onClick={onClose}>
                {t('common.actions.close')}
              </Button>
              <Button className="flex-1" variant="outline" size="default" asChild>
                <a href="https://wa.me/971554570290" target="_blank" rel="noopener noreferrer">
                  {t('common.actions.dispute')}
                </a>
              </Button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
