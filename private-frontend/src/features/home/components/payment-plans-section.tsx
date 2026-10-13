import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { SectionHeader } from '../../../shared/ui/section-header'
import {
  formatUsd,
  formatPaymentPlanStartDate,
  getPaymentPlanProgressPercent,
  getRemainingBalanceCents,
  type PaymentPlan,
} from '../model/payment-plan'

interface PaymentPlansSectionProps {
  plans: readonly PaymentPlan[]
  onSelect: (planId: string) => void
}

function PaymentPlanRow({
  plan,
  onSelect,
}: {
  plan: PaymentPlan
  onSelect: (planId: string) => void
}) {
  const { t } = useAppTranslation()
  const progressPercent = getPaymentPlanProgressPercent(plan)
  const progressRounded = Math.round(progressPercent)

  return (
    <li className="border-b border-border last:border-b-0">
      <Button
        className="group -mx-4 h-auto w-[calc(100%+2rem)] flex-col items-stretch gap-2 px-4 py-4 text-left normal-case active:translate-y-0 active:bg-primary/4"
        variant="ghost"
        textStyle="body-light"
        aria-label={t('home.paymentPlans.openDetails', {
          merchant: plan.merchant,
        })}
        onClick={() => onSelect(plan.id)}
      >
        <span className="flex w-full min-w-0 items-start justify-between gap-3 transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-active:scale-[0.97] motion-reduce:group-active:scale-[0.99]">
          <span className="flex min-w-0 flex-1 flex-col gap-[5px] font-light">
            <span className="truncate font-sans text-sm leading-6 text-foreground">{plan.merchant}</span>
            <span className="whitespace-normal text-xs leading-4 text-secondary">
              {t('home.paymentPlans.summary', {
                months: plan.termMonths,
                remaining: formatUsd(getRemainingBalanceCents(plan)),
                total: formatUsd(plan.totalRepayableCents),
                date: formatPaymentPlanStartDate(plan.startedAt),
              })}
            </span>
          </span>
          <span className="max-w-[45%] shrink-0 truncate font-sans text-sm leading-6 font-light whitespace-nowrap text-foreground">
            {t('home.paymentPlans.monthly', {
              amount: formatUsd(plan.monthlyPaymentCents),
            })}
          </span>
        </span>
        <span
          className="relative block w-full border-t-2 border-border"
          role="progressbar"
          aria-label={t('home.paymentPlans.progressLabel', {
            merchant: plan.merchant,
          })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressRounded}
        >
          <span
            className="absolute left-0 top-[-2px] block border-t-2 border-accent"
            style={{ width: `${progressPercent}%` }}
          />
        </span>
      </Button>
    </li>
  )
}

/** Active payment plans shown between Activity and card management. */
export function PaymentPlansSection({ plans, onSelect }: PaymentPlansSectionProps) {
  const { t } = useAppTranslation()
  if (plans.length === 0) return null

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader>{t('home.paymentPlans.title')}</SectionHeader>
      <p className="text-xs leading-5 font-light text-secondary">
        {t('home.paymentPlans.description')}
      </p>
      <ul className="min-w-0 list-none p-0" aria-label={t('home.paymentPlans.title')}>
        {plans.map((plan) => (
          <PaymentPlanRow key={plan.id} plan={plan} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  )
}
