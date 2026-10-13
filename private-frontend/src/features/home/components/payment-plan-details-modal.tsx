import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { InfoBanner } from '../../../shared/ui/info-banner'
import { ModalShell } from '../../../shared/ui/modal-shell'
import {
  formatUsd,
  formatPaymentPlanStartDate,
  getPaymentPlanProgressPercent,
  getRemainingBalanceCents,
  type PaymentPlan,
} from '../model/payment-plan'
import { DetailRow } from './transaction-detail-modal'

interface PaymentPlanDetailsModalProps {
  plan: PaymentPlan
  onClose: () => void
  onSettle: () => void
}

/** Active-plan detail sheet with the early-settlement intent. */
export function PaymentPlanDetailsModal({
  plan,
  onClose,
  onSettle,
}: PaymentPlanDetailsModalProps) {
  const { t } = useAppTranslation()
  const remainingBalanceCents = getRemainingBalanceCents(plan)
  const progressPercent = Math.round(getPaymentPlanProgressPercent(plan))
  const fixedApr = t('home.paymentPlans.aprFixed', {
    rate: (plan.aprBasisPoints / 100).toFixed(1),
  })

  return (
    <ModalShell
      ariaLabel={t('home.paymentPlans.openDetails', { merchant: plan.merchant })}
      onClose={onClose}
      panelClassName="flex min-w-0 flex-col p-[26px]"
    >
      <header className="flex min-w-0 flex-col items-center gap-8 border-b border-border pb-4 text-center">
        <h2 className="max-w-full truncate text-base leading-7 font-light text-foreground">
          {plan.merchant}
        </h2>
        <div className="flex min-w-0 max-w-full flex-col items-center gap-2.5 py-2">
          <strong className="max-w-full truncate text-2xl leading-8 font-bold tracking-normal">
            {formatUsd(remainingBalanceCents)}
          </strong>
          <span className="max-w-full truncate text-xs leading-5 font-light text-secondary">
            {t('home.paymentPlans.remainingOf', {
              total: formatUsd(plan.totalRepayableCents),
            })}
          </span>
        </div>
      </header>

      <div>
        <DetailRow
          label={t('home.paymentPlans.monthlyLabel')}
          value={formatUsd(plan.monthlyPaymentCents)}
        />
        <DetailRow
          label={t('home.paymentPlans.term')}
          value={`${t('home.paymentPlans.months', { count: plan.termMonths })} · ${formatPaymentPlanStartDate(plan.startedAt)}`}
        />
        <DetailRow label={t('home.paymentPlans.rate')} value={fixedApr} />
        <DetailRow label={t('home.paymentPlans.planFee')} value={formatUsd(plan.feeCents)} />
        <DetailRow
          label={t('home.paymentPlans.progress')}
          value={t('home.paymentPlans.paid', { percent: progressPercent })}
        />
        <DetailRow
          label={t('home.paymentPlans.settleToday')}
          value={formatUsd(remainingBalanceCents)}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-2 pt-[18px]">
        <InfoBanner variant="neutral">
          <p className="font-light text-secondary">
            {t('home.paymentPlans.settleInfo')}
          </p>
        </InfoBanner>
        <div className="flex min-w-0 flex-col gap-2 pt-[18px]">
          <Button className="w-full" variant="default" size="md" onClick={onSettle}>
            {t('home.paymentPlans.settleAction', {
              amount: formatUsd(remainingBalanceCents),
            })}
          </Button>
          <Button className="w-full" variant="outline" size="default" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
