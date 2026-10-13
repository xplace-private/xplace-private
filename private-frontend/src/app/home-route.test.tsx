import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

const homeRouteTestState = vi.hoisted(() => ({
  authenticated: false,
  cardsStatus: 'ready' as 'loading' | 'ready' | 'error',
  cards: [{ id: 'card-17', lastFour: '7391' }] as readonly unknown[],
  selectedCard: { id: 'card-17', name: 'Virtual card', lastFour: '7391' } as unknown,
  cardsError: null as string | null,
  paymentPlansStatus: 'loading' as 'loading' | 'ready' | 'load-failed',
  paymentPlansLoadError: null as string | null,
  calls: [] as string[],
  signOutResult: true,
  homeProps: null as unknown,
  onSignOut: null as (() => void) | null,
  transactionsStatus: 'loading' as 'idle' | 'loading' | 'ready' | 'error',
  transactions: [] as readonly unknown[],
  transactionsError: null as string | null,
  transactionsInput: null as unknown,
  balanceStatus: 'ready' as 'loading' | 'ready' | 'error',
  balance: {
    availableToSpendCents: 950022,
    spentThisPeriodCents: 49988,
    dueThisPeriodCents: 49988,
    dueDate: '2026-09-05',
    overdue: [],
  } as unknown,
  applicant: { lastName: 'Morgan', gender: 'female' } as unknown,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useRouter: () => ({
      history: {
        push(path: string) {
          homeRouteTestState.calls.push(`push:${path}`)
        },
        replace(path: string) {
          homeRouteTestState.calls.push(`replace:${path}`)
        },
      },
    }),
  }
})

vi.mock('../features/auth/auth-flow-provider', () => ({
  useAuthFlow: () => ({
    session: {
      status: homeRouteTestState.authenticated ? 'authenticated' : 'anonymous',
    },
    async signOut() {
      homeRouteTestState.calls.push('signOut')
      return homeRouteTestState.signOutResult
    },
  }),
}))

vi.mock('../features/home/payment-plans-provider', () => ({
  usePaymentPlans: () => ({
    state: {
      status: homeRouteTestState.paymentPlansStatus,
      plans: ['active-plan'],
      loadError: homeRouteTestState.paymentPlansLoadError,
    },
    startPlan() {
      return Promise.resolve({ ok: false, code: 'unused', message: 'unused' })
    },
    settlePlan() {
      return Promise.resolve({ ok: false, code: 'unused', message: 'unused' })
    },
    resetSession() {
      homeRouteTestState.calls.push('resetSession')
    },
  }),
}))

vi.mock('../features/home/cards-provider', () => ({
  useCards: () => ({
    status: homeRouteTestState.cardsStatus,
    cards: homeRouteTestState.cards,
    error: homeRouteTestState.cardsError,
    selectedCardId:
      (homeRouteTestState.selectedCard as { id: string } | null)?.id ?? null,
    selectedCard: homeRouteTestState.selectedCard,
    selectCard(cardId: string) {
      homeRouteTestState.calls.push(`selectCard:${cardId}`)
    },
    retry() {
      homeRouteTestState.calls.push('retryCards')
    },
    resetSession() {
      homeRouteTestState.calls.push('resetCards')
    },
    issueVirtual(name: string) {
      homeRouteTestState.calls.push(`issueVirtual:${name}`)
      return Promise.resolve({ ok: true })
    },
    rename(cardId: string, name: string) {
      homeRouteTestState.calls.push(`rename:${cardId}:${name}`)
      return Promise.resolve({ ok: true, data: { name } })
    },
    setFrozen(cardId: string, frozen: boolean) {
      homeRouteTestState.calls.push(`setFrozen:${cardId}:${frozen}`)
      return Promise.resolve({ ok: true })
    },
    changePin(cardId: string, pin: string) {
      homeRouteTestState.calls.push(`changePin:${cardId}:${pin}`)
      return Promise.resolve({ ok: true })
    },
    getDetails(cardId: string, expiration: string) {
      homeRouteTestState.calls.push(`getDetails:${cardId}:${expiration}`)
      return Promise.resolve({
        ok: true,
        data: { number: '4917 0032 7714 7391', expires: expiration, securityCode: '318' },
      })
    },
  }),
}))

vi.mock('../features/home/transactions-provider', () => ({
  useTransactions: (input: unknown) => {
    homeRouteTestState.transactionsInput = input
    return {
      status: homeRouteTestState.transactionsStatus,
      transactions: homeRouteTestState.transactions,
      error: homeRouteTestState.transactionsError,
      retry() {
        homeRouteTestState.calls.push('retryTransactions')
      },
      resetSession() {
        homeRouteTestState.calls.push('resetTransactions')
      },
    }
  },
}))

vi.mock('../features/home/private-balance-query', () => ({
  usePrivateBalance: () => ({
    isPending: homeRouteTestState.balanceStatus === 'loading',
    isSuccess: homeRouteTestState.balanceStatus === 'ready',
    isError: homeRouteTestState.balanceStatus === 'error',
    data: homeRouteTestState.balance,
    error:
      homeRouteTestState.balanceStatus === 'error'
        ? new Error('Unable to load balance. Try again.')
        : null,
    refetch() {
      homeRouteTestState.calls.push('retryBalance')
    },
  }),
}))

vi.mock('../features/verification/verification-flow-provider', () => ({
  useVerificationFlow: () => ({ applicant: homeRouteTestState.applicant }),
}))

vi.mock('./app-runtime', () => ({
  appRuntime: { privateBalanceGateway: { get: () => Promise.resolve() } },
}))

vi.mock('../features/home/home-session-skeleton', () => ({
  HomeSessionSkeleton: () => <div>Home cards loading</div>,
}))

vi.mock('../features/home/home-screen', () => ({
  HomeScreen(props: {
    onSignOut(): void
    plans: readonly unknown[]
    cards: readonly unknown[]
    cardsError?: string
    onRetryCards?: () => void
    paymentPlansError?: string
    settlePlan?: () => unknown
    startPlan?: () => unknown
    setCardFrozen?: (cardId: string, frozen: boolean) => unknown
    renameCard?: (cardId: string, name: string) => unknown
    changeCardPin?: (cardId: string, pin: string) => unknown
    getCardDetails?: (cardId: string, expiration: string) => unknown
  }) {
    const { onSignOut } = props
    homeRouteTestState.homeProps = props
    homeRouteTestState.onSignOut = onSignOut
    return null
  },
}))

import { HomeRoute } from './home-route'

test('passes the applicant surname and title from detail to home', () => {
  renderToStaticMarkup(<HomeRoute />)

  expect(homeRouteTestState.homeProps).toMatchObject({
    cardholderLastName: 'Morgan',
    cardholderTitle: 'Ms',
  })
})

test('resets home data and replaces the route after backend sign-out succeeds', async () => {
  homeRouteTestState.authenticated = false
  homeRouteTestState.calls = []
  homeRouteTestState.signOutResult = true
  homeRouteTestState.onSignOut = null

  renderToStaticMarkup(<HomeRoute />)
  if (homeRouteTestState.onSignOut === null) {
    throw new Error('Home sign-out intent was not captured')
  }
  const signOut = homeRouteTestState.onSignOut as () => Promise<void>
  await signOut()

  expect(homeRouteTestState.calls).toEqual([
    'signOut',
    'resetSession',
    'resetTransactions',
    'resetCards',
    'replace:/',
  ])
})

test('keeps home state and route when backend sign-out fails', async () => {
  homeRouteTestState.calls = []
  homeRouteTestState.signOutResult = false
  homeRouteTestState.onSignOut = null

  renderToStaticMarkup(<HomeRoute />)
  if (homeRouteTestState.onSignOut === null) {
    throw new Error('Home sign-out intent was not captured')
  }
  const signOut = homeRouteTestState.onSignOut as () => Promise<void>
  await signOut()

  expect(homeRouteTestState.calls).toEqual(['signOut'])
})

test('keeps the stable home skeleton visible while cards load', () => {
  homeRouteTestState.cardsStatus = 'loading'
  homeRouteTestState.homeProps = null

  const html = renderToStaticMarkup(<HomeRoute />)

  expect(html).toContain('Home cards loading')
  expect(homeRouteTestState.homeProps).toBeNull()
  homeRouteTestState.cardsStatus = 'ready'
})

test('keeps the shared home skeleton visible while the balance loads', () => {
  homeRouteTestState.cardsStatus = 'ready'
  homeRouteTestState.balanceStatus = 'loading'
  homeRouteTestState.authenticated = true
  homeRouteTestState.homeProps = null

  const html = renderToStaticMarkup(<HomeRoute />)

  expect(html).toContain('Home cards loading')
  expect(homeRouteTestState.homeProps).toBeNull()
  homeRouteTestState.balanceStatus = 'ready'
})

test('passes the loaded private balance and safe retry state to home', () => {
  homeRouteTestState.cardsStatus = 'ready'
  homeRouteTestState.balanceStatus = 'ready'
  homeRouteTestState.authenticated = true
  homeRouteTestState.homeProps = null

  renderToStaticMarkup(<HomeRoute />)
  let props = homeRouteTestState.homeProps as {
    balance?: unknown
    balanceError?: string
    onRetryBalance?: () => void
  }
  expect(props.balance).toEqual(homeRouteTestState.balance)
  expect(props.balanceError).toBeUndefined()

  homeRouteTestState.balanceStatus = 'error'
  renderToStaticMarkup(<HomeRoute />)
  props = homeRouteTestState.homeProps as typeof props
  expect(props.balance).toBeUndefined()
  expect(props.balanceError).toBe('Unable to load balance. Try again.')
  props.onRetryBalance?.()
  expect(homeRouteTestState.calls).toContain('retryBalance')

  homeRouteTestState.balanceStatus = 'ready'
})

test('passes loaded cards and safe retry state to home', () => {
  homeRouteTestState.cardsStatus = 'ready'
  homeRouteTestState.cardsError = null
  homeRouteTestState.homeProps = null

  renderToStaticMarkup(<HomeRoute />)
  let props = homeRouteTestState.homeProps as {
    cards: readonly unknown[]
    cardsError?: string
    onRetryCards?: () => void
  }
  expect(props.cards).toEqual(homeRouteTestState.cards)
  expect(props.cardsError).toBeUndefined()

  homeRouteTestState.cardsStatus = 'error'
  homeRouteTestState.cardsError = 'Unable to load cards. Try again.'
  renderToStaticMarkup(<HomeRoute />)
  props = homeRouteTestState.homeProps as typeof props
  expect(props.cards).toEqual([])
  expect(props.cardsError).toBe('Unable to load cards. Try again.')
  props.onRetryCards?.()
  expect(homeRouteTestState.calls).toContain('retryCards')

  homeRouteTestState.cardsStatus = 'ready'
  homeRouteTestState.cardsError = null
})

test('does not invent a card when the provider has no card', () => {
  const previousCards = homeRouteTestState.cards
  const previousSelectedCard = homeRouteTestState.selectedCard
  const previousAuthenticated = homeRouteTestState.authenticated
  homeRouteTestState.cardsStatus = 'ready'
  homeRouteTestState.cards = []
  homeRouteTestState.selectedCard = null
  homeRouteTestState.authenticated = true
  homeRouteTestState.homeProps = null
  homeRouteTestState.transactionsInput = null

  try {
    renderToStaticMarkup(<HomeRoute />)

    const props = homeRouteTestState.homeProps as {
      cards: readonly unknown[]
      selectedCardId: string | null
    }
    expect(props.cards).toEqual([])
    expect(props.selectedCardId).toBeNull()
    expect(homeRouteTestState.transactionsInput).toEqual({
      enabled: true,
      pageSize: 5,
    })
  } finally {
    homeRouteTestState.cards = previousCards
    homeRouteTestState.selectedCard = previousSelectedCard
    homeRouteTestState.authenticated = previousAuthenticated
  }
})

test('loads the private transaction feed only for an authenticated session', () => {
  homeRouteTestState.cardsStatus = 'ready'
  homeRouteTestState.authenticated = false
  homeRouteTestState.transactionsStatus = 'loading'
  homeRouteTestState.homeProps = null

  renderToStaticMarkup(<HomeRoute />)
  expect(homeRouteTestState.transactionsInput).toEqual({
    enabled: false,
    pageSize: 5,
  })

  homeRouteTestState.authenticated = true
  homeRouteTestState.transactionsStatus = 'ready'
  homeRouteTestState.transactions = [{ id: 'backend-transaction' }]
  renderToStaticMarkup(<HomeRoute />)
  const props = homeRouteTestState.homeProps as {
    transactions: readonly unknown[]
    transactionsLoading: boolean
    selectedCardId: string | null
    onSelectCard(cardId: string): void
  }
  expect(props.transactions).toEqual(homeRouteTestState.transactions)
  expect(props.transactionsLoading).toBe(false)
  expect(props.selectedCardId).toBe('card-17')
  props.onSelectCard('card-18')
  expect(homeRouteTestState.calls).toContain('selectCard:card-18')
})

test('connects the existing card controls to provider-backed operations', async () => {
  homeRouteTestState.cardsStatus = 'ready'
  homeRouteTestState.calls = []
  homeRouteTestState.homeProps = null

  renderToStaticMarkup(<HomeRoute />)
  const props = homeRouteTestState.homeProps as {
    issueVirtualCard(name: string): Promise<unknown>
    setCardFrozen(cardId: string, frozen: boolean): Promise<unknown>
    changeCardPin(cardId: string, pin: string): Promise<unknown>
    getCardDetails(cardId: string, expiration: string): Promise<unknown>
  }

  await props.issueVirtualCard('Travel')
  await props.setCardFrozen('card-17', true)
  await props.changeCardPin('card-17', '4826')
  await props.getCardDetails('card-17', '08/29')

  expect(homeRouteTestState.calls).toEqual([
    'issueVirtual:Travel',
    'setFrozen:card-17:true',
    'changePin:card-17:4826',
    'getDetails:card-17:08/29',
  ])
})

test('only exposes the plan-start action to an authenticated home route', () => {
  homeRouteTestState.authenticated = false
  homeRouteTestState.paymentPlansStatus = 'ready'
  homeRouteTestState.paymentPlansLoadError = null
  homeRouteTestState.homeProps = null

  renderToStaticMarkup(<HomeRoute />)
  const unauthenticatedProps = homeRouteTestState.homeProps as {
    plans: readonly unknown[]
    settlePlan?: () => unknown
    startPlan?: () => unknown
  }
  expect(unauthenticatedProps.plans).toEqual(['active-plan'])
  expect(unauthenticatedProps.settlePlan).toBeUndefined()
  expect(unauthenticatedProps.startPlan).toBeUndefined()

  homeRouteTestState.authenticated = true
  renderToStaticMarkup(<HomeRoute />)
  const authenticatedProps = homeRouteTestState.homeProps as {
    settlePlan?: () => unknown
    startPlan?: () => unknown
  }
  expect(authenticatedProps.settlePlan).toBeTypeOf('function')
  expect(authenticatedProps.startPlan).toBeTypeOf('function')

  homeRouteTestState.paymentPlansStatus = 'loading'
  renderToStaticMarkup(<HomeRoute />)
  const loadingProps = homeRouteTestState.homeProps as {
    settlePlan?: () => unknown
    startPlan?: () => unknown
  }
  expect(loadingProps.settlePlan).toBeUndefined()
  expect(loadingProps.startPlan).toBeUndefined()
})

test('passes the safe initial payment-plan load failure to home', () => {
  homeRouteTestState.authenticated = true
  homeRouteTestState.paymentPlansStatus = 'load-failed'
  homeRouteTestState.paymentPlansLoadError = 'Unable to load payment plans. Try again.'

  renderToStaticMarkup(<HomeRoute />)
  const props = homeRouteTestState.homeProps as {
    paymentPlansError?: string
    settlePlan?: () => unknown
    startPlan?: () => unknown
  }

  expect(props.paymentPlansError).toBe('Unable to load payment plans. Try again.')
  expect(props.settlePlan).toBeUndefined()
  expect(props.startPlan).toBeUndefined()
})
