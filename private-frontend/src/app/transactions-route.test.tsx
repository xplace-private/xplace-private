import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

const routeTestState = vi.hoisted(() => ({
  authenticated: false,
  paymentPlansStatus: 'loading' as 'loading' | 'ready' | 'load-failed',
  paymentPlansLoadError: null as string | null,
  transactionsStatus: 'loading' as 'idle' | 'loading' | 'ready' | 'error',
  transactions: [] as readonly unknown[],
  transactionsInput: null as unknown,
  screenProps: null as unknown,
  cards: [
    { createdAt: new Date(2026, 6, 10) },
    { createdAt: new Date(2026, 7, 12) },
  ] as readonly unknown[],
}))

vi.mock('../features/home/transactions-provider', () => ({
  useTransactions: (input: unknown) => {
    routeTestState.transactionsInput = input
    return {
      status: routeTestState.transactionsStatus,
      transactions: routeTestState.transactions,
      count: 21,
      summary: {
        year: 2026,
        month: 9,
        transactionCount: 3,
        totalSpentCents: 12345,
        dueDate: '2026-10-05',
      },
      error: null,
      hasNextPage: true,
      isLoadingMore: false,
      retry() {},
      loadMore() {},
    }
  },
}))

vi.mock('../features/home/cards-provider', () => ({
  useCards: () => ({ cards: routeTestState.cards }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useRouter: () => ({ history: { push() {}, replace() {} } }),
  }
})

vi.mock('../features/auth/auth-flow-provider', () => ({
  useAuthFlow: () => ({
    session: {
      status: routeTestState.authenticated ? 'authenticated' : 'anonymous',
    },
  }),
}))

vi.mock('../features/home/payment-plans-provider', () => ({
  usePaymentPlans: () => ({
    state: {
      status: routeTestState.paymentPlansStatus,
      plans: ['active-plan'],
      loadError: routeTestState.paymentPlansLoadError,
    },
    startPlan() {
      return Promise.resolve({ ok: false, code: 'unused', message: 'unused' })
    },
  }),
}))

vi.mock('../features/home/transactions-screen', () => ({
  TransactionsScreen(props: {
    plans: readonly unknown[]
    paymentPlansError?: string
    startPlan?: () => unknown
    transactions?: readonly unknown[]
    transactionsLoading?: boolean
    count?: number
    spent?: string
    dueDate?: string
  }) {
    routeTestState.screenProps = props
    return null
  },
}))

import { TransactionsRoute } from './transactions-route'

test('only exposes the plan-start action to an authenticated transactions route', () => {
  routeTestState.authenticated = false
  routeTestState.paymentPlansStatus = 'ready'
  routeTestState.paymentPlansLoadError = null
  routeTestState.screenProps = null

  renderToStaticMarkup(<TransactionsRoute />)
  const unauthenticatedProps = routeTestState.screenProps as {
    plans: readonly unknown[]
    startPlan?: () => unknown
  }
  expect(unauthenticatedProps.plans).toEqual(['active-plan'])
  expect(unauthenticatedProps.startPlan).toBeUndefined()

  routeTestState.authenticated = true
  renderToStaticMarkup(<TransactionsRoute />)
  const authenticatedProps = routeTestState.screenProps as {
    startPlan?: () => unknown
  }
  expect(authenticatedProps.startPlan).toBeTypeOf('function')

  routeTestState.paymentPlansStatus = 'loading'
  renderToStaticMarkup(<TransactionsRoute />)
  const loadingProps = routeTestState.screenProps as { startPlan?: () => unknown }
  expect(loadingProps.startPlan).toBeUndefined()
})

test('passes the safe initial payment-plan load failure to transactions', () => {
  routeTestState.authenticated = true
  routeTestState.paymentPlansStatus = 'load-failed'
  routeTestState.paymentPlansLoadError = 'Unable to load payment plans. Try again.'

  renderToStaticMarkup(<TransactionsRoute />)
  const props = routeTestState.screenProps as {
    paymentPlansError?: string
    startPlan?: () => unknown
  }

  expect(props.paymentPlansError).toBe('Unable to load payment plans. Try again.')
  expect(props.startPlan).toBeUndefined()
})

test('loads the current month and exposes every month since the first card', () => {
  routeTestState.authenticated = true
  routeTestState.transactionsStatus = 'ready'
  routeTestState.transactions = [{ id: 'backend-transaction' }]
  routeTestState.screenProps = null

  renderToStaticMarkup(<TransactionsRoute />)

  expect(routeTestState.transactionsInput).toEqual({
    enabled: true,
    pageSize: 20,
    period: expect.objectContaining({ year: expect.any(Number), month: expect.any(Number) }),
  })
  expect(routeTestState.screenProps).toMatchObject({
    transactions: routeTestState.transactions,
    transactionsLoading: false,
    count: 3,
    spent: 'USD 123.45',
    dueDate: '5 Oct',
    hasNextPage: true,
    periods: expect.arrayContaining([
      { year: 2026, month: 9 },
      { year: 2026, month: 8 },
      { year: 2026, month: 7 },
    ]),
  })

  routeTestState.authenticated = false
  renderToStaticMarkup(<TransactionsRoute />)
  expect(routeTestState.transactionsInput).toMatchObject({ enabled: false })
})

test('derives loading from the transactions request', () => {
  routeTestState.authenticated = true
  routeTestState.transactionsStatus = 'loading'

  renderToStaticMarkup(<TransactionsRoute />)
  expect(routeTestState.screenProps).toMatchObject({
    transactionsLoading: true,
  })

  routeTestState.transactionsStatus = 'ready'
  renderToStaticMarkup(<TransactionsRoute />)
  expect(routeTestState.screenProps).toMatchObject({
    transactionsLoading: false,
  })
})
