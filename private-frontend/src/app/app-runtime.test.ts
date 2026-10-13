import { beforeEach, expect, test, vi } from 'vitest'
import { getIsolationScope } from '@sentry/react'

import type { AuthSessionStatus } from '../features/auth/api/browser-auth-session-store'
import { DEPOSITS_QUERY_KEY } from '../features/payment/deposits-query'
import { EUR_DEBT_QUERY_KEY } from '../features/payment/eur-debt-query'
import { CURRENT_USER_QUERY_KEY } from '../features/auth/current-user-query'
import { AUTHENTICATOR_SETUP_QUERY_KEY } from '../features/auth/authenticator-query'
import { CARDS_QUERY_KEY } from '../features/home/cards-query'
import { TRANSACTIONS_QUERY_KEY } from '../features/home/transactions-query'
import { PRIVATE_BALANCE_QUERY_KEY } from '../features/home/private-balance-query'
import { AGREEMENTS_QUERY_KEY } from '../features/onboarding/onboarding-flow-provider'
import { APPLICANT_QUERY_KEY } from '../features/verification/applicant-query'
import { SUMSUB_TOKEN_QUERY_KEY } from '../features/verification/sumsub-token-query'

const runtimeTestState = vi.hoisted(() => ({
  status: 'unknown' as AuthSessionStatus,
  listeners: new Set<() => void>(),
  verificationClearCalls: 0,
}))

vi.mock('../shared/api/app-env', () => ({
  appEnv: { mode: 'staging', apiBaseUrl: 'https://back.example.test' },
}))

vi.mock('../features/auth/api/browser-auth-session-store', () => ({
  browserAuthSessionStore: {
    readStatus: () => runtimeTestState.status,
    requireTwoFactor(requirement: 'totp_setup_required' | 'totp_required') {
      runtimeTestState.status = requirement
      runtimeTestState.listeners.forEach((listener) => listener())
    },
    markAuthenticated() {
      runtimeTestState.status = 'authenticated'
      runtimeTestState.listeners.forEach((listener) => listener())
    },
    clear() {
      runtimeTestState.status = 'anonymous'
      runtimeTestState.listeners.forEach((listener) => listener())
    },
    subscribe(listener: () => void) {
      runtimeTestState.listeners.add(listener)
      return () => runtimeTestState.listeners.delete(listener)
    },
  },
}))

vi.mock('../features/verification/verification-session-store', () => ({
  browserVerificationSessionStore: {
    isSubmitted: () => true,
    markSubmitted() {},
    clearSubmitted() {},
    markAttemptFailed() {},
    consumeAttemptFailure: () => false,
    clear() {
      runtimeTestState.verificationClearCalls += 1
    },
  },
}))

import { appRuntime } from './app-runtime'

const identityQueryKeys = [
  CURRENT_USER_QUERY_KEY,
  AUTHENTICATOR_SETUP_QUERY_KEY,
  DEPOSITS_QUERY_KEY,
  EUR_DEBT_QUERY_KEY,
  APPLICANT_QUERY_KEY,
  CARDS_QUERY_KEY,
  TRANSACTIONS_QUERY_KEY,
  AGREEMENTS_QUERY_KEY,
  SUMSUB_TOKEN_QUERY_KEY,
  PRIVATE_BALANCE_QUERY_KEY,
] as const

beforeEach(() => {
  appRuntime.queryClient.clear()
  runtimeTestState.status = 'unknown'
  runtimeTestState.verificationClearCalls = 0
})

test('loads transactions from the private backend endpoint', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )

  try {
    await appRuntime.transactionsGateway.list({
      page: 1,
      pageSize: 20,
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    const request = fetch.mock.calls[0]?.[0]
    expect(request).toBeInstanceOf(Request)
    if (!(request instanceof Request)) throw new Error('Transaction request was not captured')
    expect(request.url).toBe(
      'https://back.example.test/api/v1/cards/private/transactions/?page=1&page_size=20',
    )
  } finally {
    fetch.mockRestore()
  }
})

test.each([
  ['wise-wolves.x.place', 'ww'],
  ['private-wise-wolves.stage.kube-main.x.place', 'ww'],
  ['x.place', 'xplace'],
  ['private-frontend.stage.kube-main.x.place', 'xplace'],
])('sends the registration partner for %s when verifying WhatsApp OTP', async (hostname, partner) => {
  vi.stubGlobal('window', { location: { hostname } })
  let request: Request | undefined
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (!(input instanceof Request)) throw new Error('Auth request was not captured')
    if (input.url.endsWith('/whatsapp/verify/')) request = input.clone()
    const body = input.url.endsWith('/csrf/')
      ? { csrf_token: 'csrf-token' }
      : { is_new: true, is_private: true, totp_setup_required: true, totp_required: false }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  try {
    await expect(appRuntime.authGateway.verifyOtp({
      challengeId: 'challenge-1',
      code: '123456',
    })).resolves.toEqual({
      ok: true,
      data: { isNew: true, isPrivate: true, twoFactorRequirement: 'totp_setup_required' },
    })

    if (!(request instanceof Request)) throw new Error('Verification request was not captured')
    expect(request.url).toBe('https://back.example.test/api/v1/users/web/auth/whatsapp/verify/')
    expect(request.method).toBe('POST')
    expect(request.credentials).toBe('include')
    expect(request.headers.get('X-CSRFToken')).toBe('csrf-token')
    await expect(request.json()).resolves.toEqual({
      challenge_id: 'challenge-1',
      otp: '123456',
      partner,
    })
  } finally {
    fetch.mockRestore()
    vi.unstubAllGlobals()
  }
})

test('loads the private balance from the v1 backend endpoint', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        available_to_spend: '9500.22',
        spent_this_period: '499.88',
        due_this_period: '499.88',
        due_date: '2026-09-05',
        overdue: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  )

  try {
    await appRuntime.privateBalanceGateway.get()

    const request = fetch.mock.calls[0]?.[0]
    expect(request).toBeInstanceOf(Request)
    if (!(request instanceof Request)) throw new Error('Balance request was not captured')
    expect(request.url).toBe(
      'https://back.example.test/api/v1/cards/private/balance/',
    )
  } finally {
    fetch.mockRestore()
  }
})

test('clears identity caches when a verified cookie session is adopted', () => {
  for (const queryKey of identityQueryKeys) {
    appRuntime.queryClient.setQueryData(queryKey, { owner: 'previous-session' })
  }
  const capturedGeneration = appRuntime.sessionGeneration.read()

  appRuntime.authSessionStore.markAuthenticated()

  expect(appRuntime.authSessionStore.readStatus()).toBe('authenticated')
  expect(appRuntime.sessionGeneration.read()).toBe(capturedGeneration + 1)
  for (const queryKey of identityQueryKeys) {
    expect(appRuntime.queryClient.getQueryData(queryKey)).toBeUndefined()
  }
  expect(runtimeTestState.verificationClearCalls).toBe(1)
})

test('clears identity caches when a cookie session becomes anonymous', () => {
  runtimeTestState.status = 'authenticated'
  for (const queryKey of identityQueryKeys) {
    appRuntime.queryClient.setQueryData(queryKey, { owner: 'current-session' })
  }
  const capturedGeneration = appRuntime.sessionGeneration.read()

  appRuntime.clearSession()

  expect(appRuntime.authSessionStore.readStatus()).toBe('anonymous')
  expect(appRuntime.sessionGeneration.read()).toBe(capturedGeneration + 1)
  for (const queryKey of identityQueryKeys) {
    expect(appRuntime.queryClient.getQueryData(queryKey)).toBeUndefined()
  }
})

test('clears account data and pending authenticator secrets when 2FA is required', () => {
  runtimeTestState.status = 'authenticated'
  for (const queryKey of identityQueryKeys) appRuntime.queryClient.setQueryData(queryKey, { owner: 'previous-session' })
  const generation = appRuntime.sessionGeneration.read()

  appRuntime.authSessionStore.requireTwoFactor('totp_required')

  expect(appRuntime.authSessionStore.readStatus()).toBe('totp_required')
  expect(appRuntime.sessionGeneration.read()).toBe(generation + 1)
  for (const queryKey of identityQueryKeys) expect(appRuntime.queryClient.getQueryData(queryKey)).toBeUndefined()
})

test('updates Sentry from the current user and clears identity on logout', () => {
  appRuntime.queryClient.setQueryData(CURRENT_USER_QUERY_KEY, {
    id: 42, username: null, email: 'user@example.com', avatar: null,
  })
  expect(getIsolationScope().getUser()).toEqual({ id: '42', email: 'user@example.com' })

  appRuntime.queryClient.setQueryData(CURRENT_USER_QUERY_KEY, {
    id: 43, username: null, email: null, avatar: null,
  })
  expect(getIsolationScope().getUser()).toEqual({ id: '43' })

  runtimeTestState.status = 'authenticated'
  appRuntime.clearSession()
  expect(getIsolationScope().getUser()).toEqual({})

  appRuntime.queryClient.setQueryData(CURRENT_USER_QUERY_KEY, {
    id: 42, username: null, email: 'user@example.com', avatar: null,
  })
  expect(getIsolationScope().getUser()).toEqual({})
})


test('loads deposit instructions with an authenticated GET and never creates accounts', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  try {
    await expect(appRuntime.depositsGateway.list()).resolves.toEqual({ ok: true, data: { bank: [], crypto: [] } })
    expect(fetch).toHaveBeenCalledTimes(1)
    const request = fetch.mock.calls[0]?.[0]
    if (!(request instanceof Request)) throw new Error('Deposit request was not captured')
    expect(request.url).toBe('https://back.example.test/api/v1/transfers/deposits/')
    expect(request.method).toBe('GET')
    expect(request.credentials).toBe('include')
  } finally {
    fetch.mockRestore()
  }
})
