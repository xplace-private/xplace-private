import { toast } from 'sonner'

import { appI18n } from '../../shared/i18n/app-i18n'
import { formatUsd, type PaymentPlan } from './model/payment-plan'

export function showPaymentPlanStartedToast(plan: PaymentPlan) {
  toast(
    appI18n.t('home.paymentPlans.notifications.started', {
      amount: formatUsd(plan.monthlyPaymentCents),
    }),
  )
}

export function showPaymentPlanSettledToast() {
  toast(appI18n.t('home.paymentPlans.notifications.settled'))
}
