import { useState } from 'react'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { showPaymentPlanSettledToast } from './payment-plan-notifications'

export type SettlePaymentPlan = (planId: string) => Promise<GatewayResult>

/** Home-owned orchestration for confirmation, pending, failure, and success states. */
export function usePaymentPlanSettlement(settlePlan: SettlePaymentPlan | undefined) {
  const [planId, setPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const open = (nextPlanId: string) => {
    setError(undefined)
    setPlanId(nextPlanId)
  }

  const close = () => {
    if (isSubmitting) return
    setError(undefined)
    setPlanId(null)
  }

  const settle = async () => {
    if (!planId || !settlePlan || isSubmitting) return

    setIsSubmitting(true)
    setError(undefined)
    const result = await settlePlan(planId)
    setIsSubmitting(false)

    if (result.ok) {
      setPlanId(null)
      showPaymentPlanSettledToast()
    } else {
      setError(result.message)
    }
  }

  return { close, error, isSubmitting, open, planId, settle }
}
