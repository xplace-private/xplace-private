import { describe, expect, test } from 'vitest'

import type { PaymentPlan } from './payment-plan'
import {
  createPaymentPlansState,
  paymentPlansReducer,
} from './payment-plans-state'

const plan: PaymentPlan = {
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
}

describe('paymentPlansReducer', () => {
  test('replaces loading state with plans returned by the gateway', () => {
    expect(
      paymentPlansReducer(createPaymentPlansState(), {
        type: 'plansLoaded',
        generation: 0,
        plans: [plan],
      }),
    ).toEqual({
      generation: 0,
      status: 'ready',
      plans: [plan],
      loadError: null,
      mutationError: null,
    })
  })

  test('adds a newly started plan to the active collection', () => {
    const started = paymentPlansReducer(createPaymentPlansState(), {
      type: 'planStarted',
      generation: 0,
      plan,
    })

    expect(started).toEqual({
      generation: 0,
      status: 'ready',
      plans: [plan],
      loadError: null,
      mutationError: null,
    })
  })

  test('removes only the settled plan from the active collection', () => {
    const otherPlan: PaymentPlan = {
      ...plan,
      id: 'plan-hotel',
      transactionId: 'hotel',
      merchant: 'The Ned',
    }
    const state = {
      status: 'ready' as const,
      generation: 3,
      plans: [plan, otherPlan],
      loadError: null,
      mutationError: null,
    }

    expect(
      paymentPlansReducer(state, {
        type: 'planSettled',
        generation: 3,
        planId: plan.id,
      }),
    ).toEqual({
      generation: 3,
      status: 'ready',
      plans: [otherPlan],
      loadError: null,
      mutationError: null,
    })
  })

  test('distinguishes an initial load failure from a mutation failure', () => {
    expect(
      paymentPlansReducer(createPaymentPlansState(), {
        type: 'plansLoadFailed',
        generation: 0,
        message: 'Unable to load payment plans. Try again.',
      }),
    ).toEqual({
      generation: 0,
      status: 'load-failed',
      plans: [],
      loadError: 'Unable to load payment plans. Try again.',
      mutationError: null,
    })
  })

  test('stores a mutation failure without discarding active plans', () => {
    const state = {
      status: 'ready' as const,
      generation: 4,
      plans: [plan],
      loadError: null,
      mutationError: null,
    }

    expect(
      paymentPlansReducer(state, {
        type: 'mutationFailed',
        generation: 4,
        message: 'Unable to update the plan. Try again.',
      }),
    ).toEqual({
      generation: 4,
      status: 'ready',
      plans: [plan],
      loadError: null,
      mutationError: 'Unable to update the plan. Try again.',
    })
  })

  test('resets all payment-plan state for a new client session', () => {
    const started = paymentPlansReducer(createPaymentPlansState(), {
      type: 'planStarted',
      generation: 0,
      plan,
    })

    expect(
      paymentPlansReducer(started, { type: 'sessionReset', generation: 1 }),
    ).toEqual(createPaymentPlansState(1))
  })

  test('ignores completion events from an older generation', () => {
    const loading = paymentPlansReducer(createPaymentPlansState(), {
      type: 'plansLoading',
      generation: 2,
    })

    expect(
      paymentPlansReducer(loading, {
        type: 'plansLoaded',
        generation: 1,
        plans: [plan],
      }),
    ).toBe(loading)
    expect(
      paymentPlansReducer(loading, { type: 'plansLoading', generation: 1 }),
    ).toBe(loading)
    expect(
      paymentPlansReducer(loading, { type: 'sessionReset', generation: 1 }),
    ).toBe(loading)
  })
})
