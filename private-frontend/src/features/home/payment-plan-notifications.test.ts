import { expect, test, vi } from 'vitest'

const toast = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({ toast }))

import { showPaymentPlanSettledToast } from './payment-plan-notifications'

test('shows the payment-plan settlement confirmation', () => {
  showPaymentPlanSettledToast()

  expect(toast).toHaveBeenCalledWith('PLAN SETTLED')
})
