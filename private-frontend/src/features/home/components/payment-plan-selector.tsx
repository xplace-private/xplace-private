import { cn } from '../../../shared/cn'
import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import {
  formatUsd,
  PAYMENT_PLAN_TERMS,
  quotePaymentPlan,
  type PaymentPlanTerm,
} from '../model/payment-plan'

interface PaymentPlanSelectorProps {
  disabled?: boolean
  principalCents: number
  selectedTerm: PaymentPlanTerm
  onSelect: (term: PaymentPlanTerm) => void
}

/** Renders the available payment-plan quotes from numeric principal data. */
export function PaymentPlanSelector({
  disabled = false,
  principalCents,
  selectedTerm,
  onSelect,
}: PaymentPlanSelectorProps) {
  const { t } = useAppTranslation()

  return (
    <div className="flex min-w-0 flex-col gap-2" aria-label={t('home.paymentPlans.termsLabel')}>
      {PAYMENT_PLAN_TERMS.map((term) => {
        const quote = quotePaymentPlan(principalCents, term)
        const isSelected = selectedTerm === term

        return (
          <Button
            className={cn(
              'h-auto flex-col items-start gap-[5px] bg-card px-[17px] py-[15px] text-left normal-case hover:border-accent hover:bg-card hover:text-foreground',
              isSelected && 'border-accent',
            )}
            variant="outline"
            textStyle="body"
            aria-pressed={isSelected}
            disabled={disabled}
            key={term}
            onClick={() => onSelect(term)}
          >
            <span
              className={cn(
                'font-sans text-xs leading-5 font-light tracking-[1.6px] uppercase',
                isSelected ? 'text-accent' : 'text-secondary',
              )}
            >
              {t('home.paymentPlans.months', { count: term })}
            </span>
            <span className="flex max-w-full min-w-0 items-end gap-0.5 whitespace-nowrap">
              <strong className="min-w-0 truncate text-2xl leading-6 font-bold tracking-normal text-foreground">
                {formatUsd(quote.monthlyPaymentCents)}
              </strong>
              <span className="pb-0.5 text-xs leading-5 font-light tracking-[1.6px] text-secondary">
                {t('home.paymentPlans.perMonth')}
              </span>
            </span>
            <span className="max-w-full whitespace-normal text-xs leading-5 font-light tracking-normal text-secondary">
              {t('home.paymentPlans.totalCost', {
                total: formatUsd(quote.totalRepayableCents),
                cost: formatUsd(quote.feeCents),
              })}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
