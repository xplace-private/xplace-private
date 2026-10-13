import { quotePaymentPlan } from '../model/payment-plan'

import type { PaymentPlansGateway } from './payment-plans-gateway'

type Clock = () => Date

export function createMockPaymentPlansGateway(
  now: Clock = () => new Date(),
): PaymentPlansGateway {
  return {
    list() {
      return Promise.resolve({ ok: true, data: [] })
    },
    start(input) {
      return Promise.resolve({
        ok: true,
        data: {
          ...input,
          ...quotePaymentPlan(input.principalCents, input.termMonths),
          id: `plan-${input.transactionId}`,
          paidInstallments: 0,
          startedAt: now().toISOString(),
        },
      })
    },
    settle() {
      return Promise.resolve({ ok: true })
    },
  }
}

export const mockPaymentPlansGateway = createMockPaymentPlansGateway()
