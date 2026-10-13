import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { ModalActions } from '../../../shared/ui/modal-actions'
import { ModalShell } from '../../../shared/ui/modal-shell'
import {
  formatUsd,
  getRemainingBalanceCents,
  type PaymentPlan,
} from '../model/payment-plan'

interface SettlePaymentPlanModalProps {
  error: string | undefined
  isSubmitting: boolean
  plan: PaymentPlan
  onCancel: () => void
  onConfirm: () => void
}

/** Compact confirmation that remains open while settlement is pending or fails. */
export function SettlePaymentPlanModal({
  error,
  isSubmitting,
  plan,
  onCancel,
  onConfirm,
}: SettlePaymentPlanModalProps) {
  const { t } = useAppTranslation()
  const remainingBalance = formatUsd(getRemainingBalanceCents(plan))

  return (
    <ModalShell
      ariaLabel={t('home.paymentPlans.settleAria', { merchant: plan.merchant })}
      closeDisabled={isSubmitting}
      onClose={onCancel}
      panelClassName="flex min-w-0 flex-col gap-6 p-6"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="font-sans text-base leading-6 font-bold tracking-normal">
          {t('home.paymentPlans.settleTitle')}
        </h2>
        <p className="text-xs leading-5 font-light text-secondary">
          {t('home.paymentPlans.settleDescription')}
        </p>
      </div>

      {error ? (
        <p className="text-xs leading-5 text-destructive" role="alert">
          {t('home.paymentPlans.errors.update')}
        </p>
      ) : null}

      <ModalActions
        cancelDisabled={isSubmitting}
        saveDisabled={isSubmitting}
        saveContent={t('home.paymentPlans.confirm', { amount: remainingBalance })}
        saveClassName="text-[10px] leading-3 whitespace-normal"
        saveTextStyle="body"
        onCancel={onCancel}
        onSave={onConfirm}
      />
    </ModalShell>
  )
}
