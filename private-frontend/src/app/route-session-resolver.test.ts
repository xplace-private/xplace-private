import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, test, vi } from 'vitest'

import type {
  AuthSessionStatus,
  AuthSessionStore,
} from '../features/auth/api/browser-auth-session-store'
import type { CurrentUser } from '../features/auth/api/current-user-gateway'
import { CURRENT_USER_QUERY_KEY } from '../features/auth/current-user-query'
import { APPLICANT_QUERY_KEY } from '../features/verification/applicant-query'
import type { Applicant } from '../features/verification/model/applicant'
import type { PrivateBalance } from '../features/home/api/private-balance-gateway'
import { privateBalanceQueryOptions } from '../features/home/private-balance-query'
import type { AppRuntime } from './app-runtime'
import {
  resolveRouteSession,
  type RouteSessionDecision,
} from './route-session-resolver'
import { createSessionGeneration } from './session-generation'

const currentUser: CurrentUser = {
  id: 7,
  username: null,
  email: null,
  avatar: null,
}
const replacementUser: CurrentUser = {
  id: 8,
  username: 'sam.lee',
  email: null,
  avatar: null,
}
const pendingApplicant: Applicant = {
  id: 41,
  gender: null,
  sumsubId: 'sumsub-41',
  status: 'pending',
  adminReviewStatus: 'not_required',
  rainApproved: false,
  rainStatus: 'pending',
}
const approvedApplicant: Applicant = {
  ...pendingApplicant,
  status: 'approved',
  adminReviewStatus: 'approved',
  rainApproved: true,
  rainStatus: 'approved',
}
const privateBalance: PrivateBalance = {
  availableToSpendCents: 950022,
  spentThisPeriodCents: 49988,
  dueThisPeriodCents: 49988,
  dueDate: '2026-09-05',
  overdue: [],
}

interface Deferred<Value> {
  promise: Promise<Value>
  resolve(value: Value): void
}

function deferred<Value>(): Deferred<Value> {
  let resolvePromise: ((value: Value) => void) | undefined
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value) {
      if (resolvePromise === undefined) throw new Error('Missing resolver')
      resolvePromise(value)
    },
  }
}

function unexpectedGatewayCall(): Promise<never> {
  return Promise.reject(new Error('Unexpected gateway call'))
}

function createResolverRuntime({
  status,
  user = currentUser,
  applicant = pendingApplicant,
  balance = privateBalance,
}: {
  status: AuthSessionStatus
  user?: CurrentUser | Promise<CurrentUser>
  applicant?: Applicant | null | Promise<Applicant | null>
  balance?: PrivateBalance | Promise<PrivateBalance>
}): AppRuntime {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const sessionGeneration = createSessionGeneration()
  const listeners = new Set<() => void>()
  let currentStatus = status
  const publish = (nextStatus: AuthSessionStatus) => {
    if (nextStatus !== currentStatus) {
      sessionGeneration.advance()
      queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      queryClient.removeQueries({ queryKey: APPLICANT_QUERY_KEY })
    }
    currentStatus = nextStatus
    listeners.forEach((listener) => listener())
  }
  const authSessionStore: AuthSessionStore = {
    readStatus: () => currentStatus,
    markAuthenticated: () => publish('authenticated'),
    requireTwoFactor: publish,
    clear: () => publish('anonymous'),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  return {
    queryClient,
    sessionGeneration,
    authSessionStore,
    verificationSessionStore: {
      isSubmitted: () => false,
      markSubmitted() {},
      clearSubmitted() {},
      markAttemptFailed() {},
      consumeAttemptFailure: () => false,
      clear() {},
    },
    authGateway: {
      requestCode: unexpectedGatewayCall,
      verifyOtp: unexpectedGatewayCall,
      signOut: () => Promise.resolve(),
    },
    authenticatorGateway: { getSetup: unexpectedGatewayCall, verifyCode: unexpectedGatewayCall },
    currentUserGateway: {
      async get() {
        return { ok: true, data: await user }
      },
    },
    applicantGateway: {
      async get() {
        return { ok: true, data: await applicant }
      },
    },
    physicalCardGateway: { options: async () => ({ countries: [], price: null }), latest: async () => null, save: async () => { throw new Error('unused') }, pay: async () => { throw new Error('unused') } },
    cardsGateway: {
      activatePhysical: unexpectedGatewayCall,
      list: unexpectedGatewayCall,
      issueVirtual: unexpectedGatewayCall,
      rename: unexpectedGatewayCall,
      setFrozen: unexpectedGatewayCall,
      changePin: unexpectedGatewayCall,
      getDetails: unexpectedGatewayCall,
    },
    transactionsGateway: {
      list: unexpectedGatewayCall,
    },
    eurDebtGateway: { get: unexpectedGatewayCall },
    depositsGateway: { list: async () => ({ ok: true, data: { bank: [], crypto: [] } }) },
    privateBalanceGateway: {
      async get() {
        return { ok: true, data: await balance }
      },
    },
    occupationGateway: { list: unexpectedGatewayCall },
    onboardingGateway: {
      listAgreements: unexpectedGatewayCall,
      submitApplicant: unexpectedGatewayCall,
    },
    sumsubTokenGateway: { get: unexpectedGatewayCall },
    clearSession: () => authSessionStore.clear(),
  }
}

describe('resolveRouteSession', () => {
  test.each(['totp_setup_required', 'totp_required'] as const)('redirects a restored %s cookie to 2FA before applicant loading', async (requirement) => {
    const runtime = createResolverRuntime({ status: 'unknown' })
    runtime.currentUserGateway.get = vi.fn(async () => ({ ok: false as const, code: requirement, message: '2FA required' }))
    runtime.applicantGateway.get = vi.fn()

    await expect(resolveRouteSession(runtime, '/verification')).resolves.toEqual({ kind: 'redirect', to: '/authenticator' })
    expect(runtime.authSessionStore.readStatus()).toBe(requirement)
    expect(runtime.currentUserGateway.get).toHaveBeenCalledOnce()
    expect(runtime.applicantGateway.get).not.toHaveBeenCalled()
    await expect(resolveRouteSession(runtime, '/authenticator')).resolves.toEqual({
      kind: 'allow', access: { status: 'two-factor-required', requirement },
    })
    expect(runtime.currentUserGateway.get).toHaveBeenCalledOnce()
  })

  test.each(['/', '/home', '/payment', '/onboarding', '/verification', '/transactions'])('keeps a pending 2FA session away from %s', async (pathname) => {
    const runtime = createResolverRuntime({ status: 'totp_required' })
    runtime.currentUserGateway.get = vi.fn()
    runtime.applicantGateway.get = vi.fn()
    runtime.privateBalanceGateway.get = vi.fn()
    await expect(resolveRouteSession(runtime, pathname)).resolves.toEqual({ kind: 'redirect', to: '/authenticator' })
    expect(runtime.currentUserGateway.get).not.toHaveBeenCalled()
    expect(runtime.applicantGateway.get).not.toHaveBeenCalled()
    expect(runtime.privateBalanceGateway.get).not.toHaveBeenCalled()
  })

  test.each([
    ['/home', { kind: 'redirect', to: '/' }],
    ['/', { kind: 'allow', access: { status: 'anonymous' } }],
  ] as const)('resolves anonymous cookie access for %s', async (pathname, expected) => {
    const runtime = createResolverRuntime({ status: 'anonymous' })
    await expect(resolveRouteSession(runtime, pathname)).resolves.toEqual(expected)
  })

  test('checks an unknown cookie and routes the authenticated user', async () => {
    const runtime = createResolverRuntime({
      status: 'unknown',
      applicant: approvedApplicant,
    })

    await expect(resolveRouteSession(runtime, '/')).resolves.toEqual({
      kind: 'redirect',
      to: '/home',
    })
  })

  test('allows an authenticated session on its durable route', async () => {
    const runtime = createResolverRuntime({ status: 'authenticated' })

    await expect(resolveRouteSession(runtime, '/verification')).resolves.toEqual({
      kind: 'allow',
      access: {
        status: 'authenticated',
        user: currentUser,
        applicant: pendingApplicant,
      },
    })
  })

  test('starts the home balance request in parallel with the current user request', async () => {
    const user = deferred<CurrentUser>()
    const balance = deferred<PrivateBalance>()
    const runtime = createResolverRuntime({
      status: 'authenticated',
      user: user.promise,
      balance: balance.promise,
    })
    const resolution = resolveRouteSession(runtime, '/home')

    await Promise.resolve()
    expect(runtime.queryClient.getQueryState(['home', 'private-balance'])?.fetchStatus).toBe('fetching')

    user.resolve(currentUser)
    await Promise.resolve()
    expect(runtime.queryClient.getQueryState(['home', 'private-balance'])?.fetchStatus).toBe('fetching')

    balance.resolve(privateBalance)
    await expect(resolution).resolves.toEqual({
      kind: 'redirect',
      to: '/verification',
    })
  })

  test('starts the payment balance request in parallel with the current user request', async () => {
    const user = deferred<CurrentUser>()
    const balance = deferred<PrivateBalance>()
    const runtime = createResolverRuntime({
      status: 'authenticated',
      user: user.promise,
      balance: balance.promise,
    })
    const resolution = resolveRouteSession(runtime, '/payment')

    await Promise.resolve()
    expect(runtime.queryClient.getQueryState(['home', 'private-balance'])?.fetchStatus).toBe('fetching')

    user.resolve(currentUser)
    balance.resolve(privateBalance)
    await resolution
  })

  test('reuses the cached balance when navigating from Home to payment', async () => {
    const runtime = createResolverRuntime({
      status: 'authenticated',
      applicant: approvedApplicant,
    })
    let requests = 0
    runtime.privateBalanceGateway = {
      async get() {
        requests += 1
        return { ok: true, data: privateBalance }
      },
    }
    runtime.queryClient.setQueryData(['home', 'private-balance'], privateBalance)

    await resolveRouteSession(runtime, '/payment')
    await Promise.resolve()

    expect(requests).toBe(0)
  })

  test('does not refetch a cold balance when the Home observer mounts', async () => {
    const runtime = createResolverRuntime({
      status: 'authenticated',
      applicant: approvedApplicant,
    })
    let requests = 0
    runtime.privateBalanceGateway = {
      async get() {
        requests += 1
        return { ok: true, data: privateBalance }
      },
    }

    await resolveRouteSession(runtime, '/home')
    const observer = new QueryObserver(
      runtime.queryClient,
      privateBalanceQueryOptions(runtime.privateBalanceGateway),
    )
    const unsubscribe = observer.subscribe(() => undefined)
    await new Promise((resolve) => setTimeout(resolve, 0))
    unsubscribe()

    expect(requests).toBe(1)
  })

  test('returns cached home balance immediately and publishes the background refresh', async () => {
    const cachedBalance = {
      ...privateBalance,
      availableToSpendCents: 10000,
    }
    const refreshedBalance = {
      ...privateBalance,
      availableToSpendCents: 25000,
    }
    const balance = deferred<PrivateBalance>()
    const runtime = createResolverRuntime({
      status: 'authenticated',
      applicant: approvedApplicant,
    })
    let requests = 0
    let cancellations = 0
    runtime.privateBalanceGateway = {
      async get(signal) {
        requests += 1
        signal?.addEventListener('abort', () => {
          cancellations += 1
        })
        return { ok: true, data: await balance.promise }
      },
    }
    runtime.queryClient.setQueryData(
      ['home', 'private-balance'],
      cachedBalance,
    )
    let decision: RouteSessionDecision | undefined
    const resolution = resolveRouteSession(runtime, '/home').then((result) => {
      decision = result
      return result
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    const decisionBeforeRefresh = decision
    const balanceBeforeRefresh = runtime.queryClient.getQueryData([
      'home',
      'private-balance',
    ])
    const observer = new QueryObserver(
      runtime.queryClient,
      privateBalanceQueryOptions(runtime.privateBalanceGateway),
    )
    const unsubscribe = observer.subscribe(() => undefined)
    await new Promise((resolve) => setTimeout(resolve, 0))
    unsubscribe()
    const unsubscribeAfterRemount = observer.subscribe(() => undefined)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const requestsBeforeRefresh = requests
    const cancellationsBeforeRefresh = cancellations
    balance.resolve(refreshedBalance)
    await resolution
    await vi.waitFor(() => {
      expect(
        runtime.queryClient.getQueryData(['home', 'private-balance']),
      ).toEqual(refreshedBalance)
    })
    unsubscribeAfterRemount()

    expect(decisionBeforeRefresh).toEqual({
      kind: 'allow',
      access: {
        status: 'authenticated',
        user: currentUser,
        applicant: approvedApplicant,
      },
    })
    expect(balanceBeforeRefresh).toEqual(cachedBalance)
    expect(requestsBeforeRefresh).toBe(1)
    expect(cancellationsBeforeRefresh).toBe(0)
  })

  test('returns recovery access when cookie-session restoration fails', async () => {
    const runtime = createResolverRuntime({ status: 'unknown' })
    runtime.currentUserGateway = {
      get: () =>
        Promise.resolve({
          ok: false,
          code: 'current-user-failed',
          message: 'Private upstream detail',
        }),
    }

    await expect(resolveRouteSession(runtime, '/home')).resolves.toEqual({
      kind: 'allow',
      access: {
        status: 'recovery-error',
        message: 'Unable to restore session. Try again.',
      },
    })
  })

  test('redirects when an authenticated 401 makes the session anonymous', async () => {
    const runtime = createResolverRuntime({ status: 'unknown' })
    runtime.currentUserGateway = {
      get() {
        runtime.clearSession()
        return Promise.reject(new Error('Unauthorized'))
      },
    }

    await expect(resolveRouteSession(runtime, '/home')).resolves.toEqual({
      kind: 'redirect',
      to: '/',
    })
  })

  test('restarts after current-user data resolves for an obsolete session', async () => {
    const staleUser = deferred<CurrentUser>()
    const runtime = createResolverRuntime({
      status: 'unknown',
      user: staleUser.promise,
    })
    const resolution = resolveRouteSession(runtime, '/verification')

    runtime.currentUserGateway = {
      get: () => Promise.resolve({ ok: true, data: replacementUser }),
    }
    runtime.authSessionStore.markAuthenticated()
    staleUser.resolve(currentUser)

    await expect(resolution).resolves.toEqual({
      kind: 'allow',
      access: {
        status: 'authenticated',
        user: replacementUser,
        applicant: pendingApplicant,
      },
    })
  })

  test('does not retain applicant data resolved after logout', async () => {
    const staleApplicant = deferred<Applicant | null>()
    const runtime = createResolverRuntime({
      status: 'authenticated',
      applicant: staleApplicant.promise,
    })
    const resolution = resolveRouteSession(runtime, '/home')

    await Promise.resolve()
    runtime.clearSession()
    staleApplicant.resolve(approvedApplicant)

    await expect(resolution).resolves.toEqual({ kind: 'redirect', to: '/' })
    expect(runtime.queryClient.getQueryData(APPLICANT_QUERY_KEY)).toBeUndefined()
  })
})
