import { describe, expect, test, vi } from 'vitest'

import { createHttpPrivateBalanceGateway } from './http-private-balance-gateway'

const response = {
  available_to_spend: '9500.22',
  spent_this_period: '499.88',
  due_this_period: '499.88',
  outstanding_debt: '625.28',
  due_date: '2026-09-05',
  overdue: [
    { due_date: '2026-08-05', amount: '125.40', closed: false },
  ],
}

describe('createHttpPrivateBalanceGateway', () => {
  test('loads and validates the private balance contract', async () => {
    const request = vi.fn().mockResolvedValue(response)

    await expect(createHttpPrivateBalanceGateway({ request }).get()).resolves.toEqual({
      ok: true,
      data: {
        availableToSpendCents: 950022,
        spentThisPeriodCents: 49988,
        dueThisPeriodCents: 49988,
        outstandingDebtCents: 62528,
        dueDate: '2026-09-05',
        overdue: [
          { dueDate: '2026-08-05', amountCents: 12540, closed: false },
        ],
      },
    })
    expect(request).toHaveBeenCalledWith('cards/private/balance/', {
      authenticated: true,
      signal: undefined,
    })
  })

  test.each([
    ['numeric money', { ...response, available_to_spend: 9500.22 }],
    ['missing current debt', { ...response, due_this_period: undefined }],
    ['null current debt', { ...response, due_this_period: null }],
    ['numeric current debt', { ...response, due_this_period: 499.88 }],
    ['invalid current debt', { ...response, due_this_period: 'invalid' }],
    ['invalid total debt', { ...response, outstanding_debt: 'invalid' }],
    ['negative total debt', { ...response, outstanding_debt: '-1.00' }],
    ['numeric total debt', { ...response, outstanding_debt: 625.28 }],
    ['invalid date', { ...response, due_date: '2026-02-30' }],
    ['invalid overdue row', { ...response, overdue: [{ due_date: null, amount: '1.00', closed: false }] }],
  ])('returns a safe failure for %s', async (_case, body) => {
    const gateway = createHttpPrivateBalanceGateway({
      request: () => Promise.resolve(body),
    })

    await expect(gateway.get()).resolves.toEqual({
      ok: false,
      code: 'private-balance-failed',
      message: 'Unable to load balance. Try again.',
    })
  })

  test.each([undefined, null])('keeps unavailable total debt unknown on older deployments (%s)', async (outstanding_debt) => {
    expect(await createHttpPrivateBalanceGateway({ request: async () => ({ ...response, outstanding_debt }) }).get())
      .toMatchObject({ ok: true, data: { outstandingDebtCents: null } })
  })
})
