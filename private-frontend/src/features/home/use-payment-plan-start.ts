import { useState } from 'react'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { appI18n } from '../../shared/i18n/app-i18n'
import type {
  PaymentPlan,
  PaymentPlanTerm,
  StartPaymentPlanInput,
} from './model/payment-plan'
import type { Transaction } from './model/transaction'
import { showPaymentPlanStartedToast } from './payment-plan-notifications'

export type StartPaymentPlan = (
  input: StartPaymentPlanInput,
) => Promise<GatewayResult<PaymentPlan>>

/** Shared screen orchestration for opening and submitting the plan-start dialog. */
export function usePaymentPlanStart(startPlan: StartPaymentPlan | undefined) {
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const open = (nextTransaction: Transaction) => {
    setError(undefined)
    setTransaction(nextTransaction)
  }

  const close = () => {
    if (isSubmitting) return
    setError(undefined)
    setTransaction(null)
  }

  const start = async (termMonths: PaymentPlanTerm) => {
    if (!transaction || !startPlan || isSubmitting) return

    setIsSubmitting(true)
    setError(undefined)
    const result = await startPlan({
      transactionId: transaction.id,
      merchant: transaction.merchant ?? appI18n.t('common.notAvailableShort'),
      currency: transaction.currency,
      principalCents: transaction.amountCents,
      termMonths,
    })
    setIsSubmitting(false)

    if (result.ok) {
      setTransaction(null)
      showPaymentPlanStartedToast(result.data)
    } else {
      setError(result.message)
    }
  }

  return { close, error, isSubmitting, open, start, transaction }
}
