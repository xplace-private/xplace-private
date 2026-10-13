import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'

import type { PrivateBalance } from '../features/home/api/private-balance-gateway'

const routeTestState = vi.hoisted<{
  screenProps: unknown
  balance: { isSuccess: boolean; isPending: boolean; data: PrivateBalance | undefined }
}>(() => ({
  screenProps: null,
  balance: {
    isSuccess: true,
    isPending: false,
    data: {
      availableToSpendCents: 900000,
      spentThisPeriodCents: 123456,
      dueThisPeriodCents: 23456,
      outstandingDebtCents: 150000,
      dueDate: '2026-10-18',
      overdue: [],
    },
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useRouter: () => ({ history: { push() {}, replace() {} } }),
  }
})

vi.mock('../features/home/payment-plans-provider', () => ({
  usePaymentPlans: () => ({
    state: {
      plans: [
        {
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
      ],
    },
  }),
}))

vi.mock('../features/home/private-balance-query', () => ({
  usePrivateBalance: () => routeTestState.balance,
}))

vi.mock('./app-runtime', () => ({
  appRuntime: { privateBalanceGateway: {}, depositsGateway: {}, eurDebtGateway: {} },
}))

vi.mock('../features/payment/eur-debt-query', () => ({
  useEurDebt: vi.fn(() => ({ state: { status: 'loading' } })),
}))

vi.mock('../features/payment/deposits-query', () => ({
  useDeposits: () => ({
    bank: { status: 'timed-out', deposits: [] },
    eur: { status: 'loading', deposits: [] },
    crypto: { status: 'ready', details: { address: '0xAPI', asset: 'USDC', network: 'ERC-20' } },
  }),
}))

vi.mock('../features/payment/payment-screen', () => ({
  PaymentScreen(props: unknown) {
    routeTestState.screenProps = props
    return null
  },
}))

import { PaymentRoute } from './payment-route'
import { useEurDebt } from '../features/payment/eur-debt-query'
import { appRuntime } from './app-runtime'

beforeEach(() => {
  vi.mocked(useEurDebt).mockReturnValue({ state: { status: 'loading' } })
  routeTestState.balance.isPending = false
  routeTestState.balance.data = {
    availableToSpendCents: 900000,
    spentThisPeriodCents: 123456,
    dueThisPeriodCents: 23456,
    outstandingDebtCents: 150000,
    dueDate: '2026-10-18',
    overdue: [],
  }
})

test.each([null, undefined, 0, 150000])('uses due_this_period as the fallback regardless of total debt (%s)', (outstandingDebtCents) => {
  vi.mocked(useEurDebt).mockReturnValue({ state: { status: 'error' } })
  if (routeTestState.balance.data === undefined) throw new Error('Balance fixture is missing')
  if (outstandingDebtCents === undefined) delete routeTestState.balance.data.outstandingDebtCents
  else routeTestState.balance.data.outstandingDebtCents = outstandingDebtCents
  renderToStaticMarkup(<PaymentRoute />)
  expect(routeTestState.screenProps).toMatchObject({
    details: { statement: { balance: 'USD 234.56', amountCents: 23456, loading: false } },
  })
})

test('waits for eur-debt while the fallback balance and date are already loaded', () => {
  renderToStaticMarkup(<PaymentRoute />)
  expect(routeTestState.screenProps).toMatchObject({
    details: { statement: { loading: true, dateLoading: false, statementDate: '18 Oct' } },
  })
})

test('preserves a zero due_this_period fallback despite spending and total debt', () => {
  vi.mocked(useEurDebt).mockReturnValue({ state: { status: 'error' } })
  if (routeTestState.balance.data === undefined) throw new Error('Balance fixture is missing')
  routeTestState.balance.data.dueThisPeriodCents = 0
  renderToStaticMarkup(<PaymentRoute />)
  expect(routeTestState.screenProps).toMatchObject({
    details: { statement: { balance: 'USD 0.00', amountCents: 0, loading: false } },
  })
})

test('keeps the amount unavailable when the balance response is absent', () => {
  routeTestState.balance.data = undefined
  renderToStaticMarkup(<PaymentRoute />)
  expect(routeTestState.screenProps).toMatchObject({
    details: { statement: { balance: 'Not available', amountCents: null } },
  })
})

test('maps Home plan domain data to Payment presentation input at the app boundary', () => {
  routeTestState.screenProps = null

  renderToStaticMarkup(<PaymentRoute />)

  expect(routeTestState.screenProps).toMatchObject({
    details: {
      statement: {
        balance: 'USD 234.56',
        amountCents: 23456,
        statementDate: '18 Oct',
      },
    },
    bankDeposits: { status: 'timed-out', deposits: [] },
    eurDeposits: { status: 'loading', deposits: [] },
    cryptoDeposits: { status: 'ready', details: { address: '0xAPI', asset: 'USDC', network: 'ERC-20' } },
    eurDebt: { status: 'loading' },
    planAdjustments: [
      {
        id: 'plan-emirates',
        merchant: 'Emirates Airlines',
        originalAmount: 'USD 2,840.00',
        monthlyPayment: 'USD 515.93/mo',
        termLabel: '6 months',
        reductionCents: 232407,
        reduction: '−USD 2,324.07',
      },
    ],
  })
  expect(useEurDebt).toHaveBeenCalledWith(appRuntime.eurDebtGateway)
})
