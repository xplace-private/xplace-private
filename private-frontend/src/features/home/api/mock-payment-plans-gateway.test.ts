import { describe, expect, test } from 'vitest'

import { mapUnexpectedPaymentPlansError } from './payment-plans-gateway'
import {
  createMockPaymentPlansGateway,
  mockPaymentPlansGateway,
} from './mock-payment-plans-gateway'

describe('mockPaymentPlansGateway', () => {
  test('lists no active plans for a new in-memory session', async () => {
    await expect(mockPaymentPlansGateway.list()).resolves.toEqual({
      ok: true,
      data: [],
    })
  })

  test('starts a typed plan from numeric input', async () => {
    const gateway = createMockPaymentPlansGateway(
      () => new Date('2026-08-19T00:00:00.000Z'),
    )

    await expect(
      gateway.start({
        transactionId: 'emirates',
        merchant: 'Emirates Airlines',
        currency: 'USD',
        principalCents: 284000,
        termMonths: 6,
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        id: 'plan-emirates',
        transactionId: 'emirates',
        merchant: 'Emirates Airlines',
        currency: 'USD',
        principalCents: 284000,
        termMonths: 6,
        aprBasisPoints: 1800,
        feeCents: 25560,
        totalRepayableCents: 309560,
        monthlyPaymentCents: 51593,
        paidInstallments: 0,
        startedAt: '2026-08-19T00:00:00.000Z',
      },
    })
  })

  test('settles a plan with the existing void-success contract', async () => {
    await expect(mockPaymentPlansGateway.settle('plan-emirates')).resolves.toEqual({
      ok: true,
    })
  })
})

test('maps unexpected gateway rejections to a user-safe failure', () => {
  expect(mapUnexpectedPaymentPlansError(new Error('database password leaked'))).toEqual({
    ok: false,
    code: 'unexpected-error',
    message: 'Unable to update the plan. Try again.',
  })
})
