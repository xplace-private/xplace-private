import { useState } from 'react'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { InfoBanner } from '../../../shared/ui/info-banner'
import { ModalShell } from '../../../shared/ui/modal-shell'
import {
  formatUsd,
  quotePaymentPlan,
  type PaymentPlanTerm,
} from '../model/payment-plan'
import type { Transaction } from '../model/transaction'
import { PaymentPlanSelector } from './payment-plan-selector'

interface PaymentPlanStartModalProps {
  error?: string | undefined
  isSubmitting: boolean
  transaction: Transaction
  onClose: () => void
  onStart: (term: PaymentPlanTerm) => void
}

function QuoteDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-b border-border py-3 text-xs leading-5 font-light">
      <span className="text-foreground">{label}</span>
      <span className="min-w-0 text-right text-secondary">{value}</span>
    </div>
  )
}

/** Term-selection dialog with submission state owned by its screen. */
export function PaymentPlanStartModal({
  error,
  isSubmitting,
  transaction,
  onClose,
  onStart,
}: PaymentPlanStartModalProps) {
  const { t } = useAppTranslation()
  const merchant = transaction.merchant ?? t('common.notAvailableShort')
  const [selectedTerm, setSelectedTerm] = useState<PaymentPlanTerm>(6)
  const quote = quotePaymentPlan(transaction.amountCents, selectedTerm)

  return (
    <ModalShell
      ariaLabel={t('home.paymentPlans.startAria', {
        merchant,
      })}
      closeDisabled={isSubmitting}
      onClose={onClose}
      panelClassName="flex min-w-0 flex-col p-[26px]"
    >
      <header className="flex min-w-0 flex-col items-center gap-8 border-b border-border pb-4 text-center">
        <h2 className="text-base leading-7 font-light text-foreground">
          {t('home.paymentPlans.startTitle')}
        </h2>
        <div className="flex min-w-0 flex-col items-center gap-2.5 py-2">
          <strong className="max-w-full truncate text-2xl leading-8 font-bold tracking-normal">
            {formatUsd(transaction.amountCents)}
          </strong>
          <span className="max-w-full truncate text-xs leading-5 font-light text-secondary">
            {merchant}
          </span>
        </div>
      </header>

      <div className="flex min-w-0 flex-col">
        <PaymentPlanSelector
          disabled={isSubmitting}
          principalCents={transaction.amountCents}
          selectedTerm={selectedTerm}
          onSelect={setSelectedTerm}
        />
        <div className="py-4">
          <QuoteDetail
            label={t('home.paymentPlans.rate')}
            value={t('home.paymentPlans.aprFixed', { rate: '18.0' })}
          />
          <QuoteDetail label={t('home.paymentPlans.planFee')} value={formatUsd(quote.feeCents)} />
          <QuoteDetail
            label={t('home.paymentPlans.totalRepayable')}
            value={formatUsd(quote.totalRepayableCents)}
          />
        </div>
      </div>

      <div className="py-4">
        <InfoBanner variant="neutral">
          <p className="font-light text-secondary">
            {t('home.concierge.cardholderInfo')}
          </p>
        </InfoBanner>
      </div>

      {error ? (
        <p className="text-xs leading-5 text-destructive" role="alert">
          {t('home.paymentPlans.errors.update')}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-2 pt-[18px]">
        <Button
          className="w-full"
          variant="default"
          size="md"
          disabled={isSubmitting}
          onClick={() => onStart(selectedTerm)}
        >
          {t('home.paymentPlans.startAction', {
            amount: formatUsd(quote.monthlyPaymentCents),
          })}
        </Button>
        <Button
          className="w-full"
          variant="outline"
          size="default"
          disabled={isSubmitting}
          onClick={onClose}
        >
          {t('common.actions.cancel')}
        </Button>
      </div>
    </ModalShell>
  )
}
