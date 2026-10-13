import { Button } from '../../shared/ui/button'
import { TokenIcon } from '../../shared/ui/token-icon'
import { useAppTranslation } from '../../shared/i18n/app-i18n'

export interface StatementPlanAdjustment {
  id: string
  merchant: string
  originalAmount: string
  monthlyPayment: string
  termLabel: string
  reductionCents: number
  reduction: string
}

interface StatementPlanDisclosureProps {
  adjustments: readonly StatementPlanAdjustment[]
  expanded: boolean
  onToggle(): void
}

function formatUsdCents(amountCents: number, locale: string): string {
  return `USD ${(amountCents / 100).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Expandable statement reductions supplied as Payment-owned presentation data. */
export function StatementPlanDisclosure({
  adjustments,
  expanded,
  onToggle,
}: StatementPlanDisclosureProps) {
  const { i18n, t } = useAppTranslation()
  if (adjustments.length === 0) return null

  const reductionCents = adjustments.reduce(
    (total, adjustment) => total + adjustment.reductionCents,
    0,
  )
  const contentId = 'statement-plan-adjustments'
  const combinedReduction = formatUsdCents(
    reductionCents,
    i18n.resolvedLanguage === 'en' ? 'en-US' : i18n.resolvedLanguage ?? 'en-US',
  )

  return (
    <div className="min-w-0 border-t border-border">
      <Button
        className="h-auto w-full justify-between gap-3 border-0 px-0 py-2 text-left text-sm leading-6 font-light tracking-normal text-positive normal-case"
        variant="ghost"
        textStyle="light"
        aria-controls={contentId}
        aria-expanded={expanded}
        aria-label={t('payment.statementPlans.toggle', {
          action: t(
            expanded
              ? 'payment.statementPlans.collapse'
              : 'payment.statementPlans.expand',
          ),
          amount: combinedReduction,
        })}
        onClick={onToggle}
      >
        <span className="min-w-0 truncate">
          {t('payment.statementPlans.lower', { amount: combinedReduction })}
        </span>
        <TokenIcon
          className={`size-4 text-secondary transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          src="/assets/home/chevron-down.svg"
        />
      </Button>

      {expanded ? (
        <div
          className="flex min-w-0 flex-col py-2 text-xs leading-5 font-light text-secondary"
          id={contentId}
        >
          <p>
            {t('payment.statementPlans.description')}
          </p>
          <ul className="flex min-w-0 list-none flex-col p-0">
            {adjustments.map((adjustment) => (
              <li
                className="flex min-w-0 items-start justify-between py-[8.5px]"
                key={adjustment.id}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-sans text-sm leading-6 text-foreground">
                    {adjustment.merchant}
                  </span>
                  <span className="min-w-0 whitespace-normal break-words">
                    {adjustment.originalAmount} · {adjustment.monthlyPayment} ×{' '}
                    {adjustment.termLabel}
                  </span>
                </span>
                <span className="flex w-[94px] shrink-0 flex-col items-end text-right">
                  <span className="font-sans text-sm leading-6 whitespace-nowrap text-positive">
                    {adjustment.reduction}
                  </span>
                  <span className="whitespace-nowrap text-accent">
                    {t('payment.statementPlans.thisMonth')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
