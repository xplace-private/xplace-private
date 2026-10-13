import type { GatewayResult } from '../../../shared/api/gateway-result'
import type {
  PaymentPlan,
  StartPaymentPlanInput,
} from '../model/payment-plan'

export interface PaymentPlansGateway {
  list(): Promise<GatewayResult<readonly PaymentPlan[]>>
  start(input: StartPaymentPlanInput): Promise<GatewayResult<PaymentPlan>>
  settle(planId: string): Promise<GatewayResult>
}

/** Converts unexpected gateway rejections into a user-safe typed failure. */
export function mapUnexpectedPaymentPlansError(
  error: unknown,
): Extract<GatewayResult, { ok: false }> {
  void error

  return {
    ok: false,
    code: 'unexpected-error',
    message: 'Unable to update the plan. Try again.',
  }
}
