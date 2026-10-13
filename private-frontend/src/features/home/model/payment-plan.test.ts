import { describe, expect, test } from 'vitest'

import {
  formatUsd,
  getPaymentPlanProgressPercent,
  getRemainingBalanceCents,
  getStatementReductionCents,
  isPayOverTimeEligible,
  quotePaymentPlan,
} from './payment-plan'

describe('payment plan domain', () => {
  test.each([
    [3, 12780, 296780, 98927],
    [6, 25560, 309560, 51593],
    [9, 38340, 322340, 35816],
  ] as const)('quotes %i months using the fixed 18%% APR', (term, fee, total, monthly) => {
    expect(quotePaymentPlan(284000, term)).toMatchObject({
      feeCents: fee,
      totalRepayableCents: total,
      monthlyPaymentCents: monthly,
    })
  })

  test('reduces this statement by the purchase less its first instalment', () => {
    expect(getStatementReductionCents(quotePaymentPlan(284000, 6))).toBe(232407)
  })

  test.each([
    ['card', false, 'USD', 100001, 'completed', false, true],
    ['card', true, 'USD', 100001, 'completed', false, true],
    ['card', false, 'USD', 100000, 'completed', false, false],
    ['card', false, 'EUR', 200000, 'completed', false, false],
    ['card', false, 'USD', 200000, 'reversed', false, false],
    ['card', false, 'USD', 200000, 'pending', true, false],
    ['refund', true, 'USD', 200000, 'completed', false, false],
    ['top_up', true, 'USD', 200000, 'completed', false, false],
    ['physical_card', false, 'USD', 200000, 'completed', false, false],
    ['future_type', false, 'USD', 200000, 'completed', false, false],
    ['card', false, 'USD', 200000, 'processing', false, false],
  ] as const)(
    'checks card type, currency, threshold, state, and active-plan ownership',
    (type, isCredit, currency, amountCents, state, hasPlan, expected) => {
      const transaction = { type, isCredit, currency, amountCents, state }
      expect(isPayOverTimeEligible(transaction, hasPlan)).toBe(expected)
    },
  )

  test('deducts paid rounded instalments from the total repayable', () => {
    const quote = quotePaymentPlan(284000, 6)

    expect(
      getRemainingBalanceCents({
        ...quote,
        id: 'plan-emirates',
        transactionId: 'emirates-airlines-12-aug-1422',
        merchant: 'Emirates Airlines',
        currency: 'USD',
        paidInstallments: 1,
        startedAt: '2026-08-19T00:00:00.000Z',
      }),
    ).toBe(257967)
  })

  test('derives remaining balance from paid rounded instalments without going below zero', () => {
    const quote = quotePaymentPlan(284000, 6)

    expect(
      getRemainingBalanceCents({
        ...quote,
        id: 'plan-emirates',
        transactionId: 'emirates-airlines-12-aug-1422',
        merchant: 'Emirates Airlines',
        currency: 'USD',
        paidInstallments: 7,
        startedAt: '2026-08-19T00:00:00.000Z',
      }),
    ).toBe(0)
  })

  test.each([
    [-1, 0],
    [3, 50],
    [7, 100],
  ])('maps %i paid instalments to clamped progress', (paidInstallments, expected) => {
    expect(getPaymentPlanProgressPercent({ paidInstallments, termMonths: 6 })).toBe(expected)
  })

  test('formats integer cents as USD with two decimal places', () => {
    expect(formatUsd(232407)).toBe('USD 2,324.07')
  })
})
