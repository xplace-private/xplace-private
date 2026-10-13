import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

import type { ApplicantGateway } from './api/applicant-gateway'
import type { SumsubTokenGateway } from './api/sumsub-token-gateway'
import { APPLICANT_QUERY_KEY } from './applicant-query'
import type { Applicant } from './model/applicant'
import { SUMSUB_TOKEN_QUERY_KEY } from './sumsub-token-query'
import {
  VerificationFlowProvider,
  useVerificationFlow,
} from './verification-flow-provider'
import type { VerificationSessionStore } from './verification-session-store'

type VerificationValue = ReturnType<typeof useVerificationFlow>

const applicant: Applicant = {
  id: 41,
  gender: null,
  sumsubId: null,
  status: 'not_started',
  adminReviewStatus: 'not_required',
  rainApproved: false,
  rainStatus: 'needsVerification',
}

let verification: VerificationValue | null = null
let root: Root | null = null
let queryClient: QueryClient | null = null
let observedApplicantStatuses: VerificationValue['applicantStatus'][] = []

function Probe() {
  const value = useVerificationFlow()
  observedApplicantStatuses.push(value.applicantStatus)
  useEffect(() => {
    verification = value
  }, [value])
  return null
}

function getVerification(): VerificationValue {
  if (verification === null) throw new Error('Verification value was not captured')
  return verification
}

function createEmptyReactContainer(): Element {
  const ownerDocument = {
    nodeType: 9,
    documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
    addEventListener() {},
    removeEventListener() {},
  }
  return {
    nodeType: 1,
    nodeName: 'DIV',
    tagName: 'DIV',
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Element
}

function createSessionStore(): VerificationSessionStore {
  let submitted = false
  let attemptFailed = false
  return {
    isSubmitted: () => submitted,
    markSubmitted() {
      submitted = true
    },
    clearSubmitted() {
      submitted = false
    },
    markAttemptFailed() {
      attemptFailed = true
    },
    consumeAttemptFailure() {
      const failed = attemptFailed
      attemptFailed = false
      return failed
    },
    clear() {
      submitted = false
      attemptFailed = false
    },
  }
}

function createApplicantGateway(
  get: ApplicantGateway['get'] = () => Promise.resolve({ ok: true, data: applicant }),
): ApplicantGateway {
  return { get }
}

function createTokenGateway(
  get: SumsubTokenGateway['get'] = () =>
    Promise.resolve({ ok: true, data: { token: '_act-token', userId: '41' } }),
): SumsubTokenGateway {
  return { get }
}

function mount({
  applicantGateway = createApplicantGateway(),
  tokenGateway = createTokenGateway(),
  sessionStore = createSessionStore(),
  enabled = false,
  cachedApplicant,
  sessionIdentity = 0,
  isSessionIdentityCurrent = () => true,
}: {
  applicantGateway?: ApplicantGateway
  tokenGateway?: SumsubTokenGateway
  sessionStore?: VerificationSessionStore
  enabled?: boolean
  cachedApplicant?: Applicant | null
  sessionIdentity?: number
  isSessionIdentityCurrent?: (identity: number) => boolean
} = {}) {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as unknown as { window?: unknown }).window = { HTMLIFrameElement: class {} }
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (cachedApplicant !== undefined) {
    queryClient.setQueryData(APPLICANT_QUERY_KEY, cachedApplicant)
  }
  root = createRoot(createEmptyReactContainer())

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <VerificationFlowProvider
          applicantGateway={applicantGateway}
          tokenGateway={tokenGateway}
          sessionStore={sessionStore}
          enabled={enabled}
          sessionActive={enabled}
          sessionIdentity={sessionIdentity}
          isSessionIdentityCurrent={isSessionIdentityCurrent}
        >
          <Probe />
        </VerificationFlowProvider>
      </QueryClientProvider>,
    )
  })

  return { applicantGateway, tokenGateway, sessionStore }
}

function rerender({
  applicantGateway,
  tokenGateway,
  sessionStore,
  enabled,
  sessionIdentity = 0,
  isSessionIdentityCurrent = () => true,
}: {
  applicantGateway: ApplicantGateway
  tokenGateway: SumsubTokenGateway
  sessionStore: VerificationSessionStore
  enabled: boolean
  sessionIdentity?: number
  isSessionIdentityCurrent?: (identity: number) => boolean
}) {
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <VerificationFlowProvider
          applicantGateway={applicantGateway}
          tokenGateway={tokenGateway}
          sessionStore={sessionStore}
          enabled={enabled}
          sessionActive={enabled}
          sessionIdentity={sessionIdentity}
          isSessionIdentityCurrent={isSessionIdentityCurrent}
        >
          <Probe />
        </VerificationFlowProvider>
      </QueryClientProvider>,
    )
  })
}

async function waitForApplicantStatus(status: VerificationValue['applicantStatus']) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getVerification().applicantStatus === status) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error(`Applicant did not reach ${status}`)
}

async function waitForApplicant(sumsubStatus: Applicant['status']) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getVerification().applicant?.status === sumsubStatus) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error(`Applicant did not update to ${sumsubStatus}`)
}

async function waitForToken(token: string | null) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((getVerification().token?.token ?? null) === token) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error(`Token did not update to ${token}`)
}

async function waitForTokenStatus(status: VerificationValue['tokenStatus']) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getVerification().tokenStatus === status) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error(`Token did not reach ${status}`)
}

afterEach(async () => {
  vi.unstubAllGlobals()
  if (root !== null) act(() => root?.unmount())
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  queryClient?.clear()
  verification = null
  root = null
  queryClient = null
  observedApplicantStatuses = []
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT
  delete (globalThis as unknown as { window?: unknown }).window
})

test('does not load the applicant for an anonymous session and begins when enabled', async () => {
  const get = vi.fn(() => Promise.resolve({ ok: true as const, data: applicant }))
  const state = mount({ applicantGateway: createApplicantGateway(get) })

  expect(get).not.toHaveBeenCalled()
  expect(getVerification().applicantStatus).toBe('disabled')

  rerender({ ...state, enabled: true })
  await waitForApplicantStatus('success')

  expect(get).toHaveBeenCalledTimes(1)
  expect(getVerification().applicant).toEqual(applicant)
})

test('immediately exposes a Router-hydrated applicant without another request', () => {
  const get = vi.fn<ApplicantGateway['get']>(() =>
    Promise.resolve({ ok: true, data: null }),
  )

  mount({
    enabled: true,
    applicantGateway: createApplicantGateway(get),
    cachedApplicant: applicant,
  })

  expect(observedApplicantStatuses[0]).toBe('success')
  expect(observedApplicantStatuses).not.toContain('loading')
  expect(getVerification().applicantStatus).toBe('success')
  expect(getVerification().applicant).toEqual(applicant)
  expect(get).not.toHaveBeenCalled()
})

test('immediately exposes a Router-hydrated absent applicant without another request', () => {
  const get = vi.fn<ApplicantGateway['get']>(() =>
    Promise.resolve({ ok: true, data: applicant }),
  )

  mount({
    enabled: true,
    applicantGateway: createApplicantGateway(get),
    cachedApplicant: null,
  })

  expect(observedApplicantStatuses[0]).toBe('success')
  expect(observedApplicantStatuses).not.toContain('loading')
  expect(getVerification().applicantStatus).toBe('success')
  expect(getVerification().applicant).toBeNull()
  expect(get).not.toHaveBeenCalled()
})

test('does not cancel or duplicate an in-flight applicant refetch', async () => {
  const refetchSignals: AbortSignal[] = []
  const resolveRefetches: Array<
    (value: { ok: true; data: Applicant }) => void
  > = []
  let call = 0
  const get = vi.fn<ApplicantGateway['get']>((signal) => {
    call += 1
    if (call === 1) return Promise.resolve({ ok: true, data: applicant })

    if (signal === undefined) throw new Error('Expected a refetch abort signal')
    refetchSignals.push(signal)
    return new Promise((resolve) => {
      resolveRefetches.push(resolve)
    })
  })
  mount({ enabled: true, applicantGateway: createApplicantGateway(get) })
  await waitForApplicantStatus('success')

  const firstRefetch = getVerification().refetchApplicant()
  await act(async () => Promise.resolve())
  const secondRefetch = getVerification().refetchApplicant()
  await act(async () => Promise.resolve())
  const callsBeforeSettlement = get.mock.calls.length
  const firstRequestWasAborted = refetchSignals[0]?.aborted

  await act(async () => {
    for (const resolve of resolveRefetches) {
      resolve({ ok: true, data: { ...applicant, status: 'pending' } })
    }
    await Promise.all([firstRefetch, secondRefetch])
  })

  expect(callsBeforeSettlement).toBe(2)
  expect(firstRequestWasAborted).toBe(false)
})

test('keeps the applicant refetch callback stable after query data changes', async () => {
  const get = vi
    .fn<ApplicantGateway['get']>()
    .mockResolvedValueOnce({ ok: true, data: applicant })
    .mockResolvedValueOnce({
      ok: true,
      data: { ...applicant, status: 'pending' },
    })
  mount({ enabled: true, applicantGateway: createApplicantGateway(get) })
  await waitForApplicantStatus('success')
  const refetchApplicant = getVerification().refetchApplicant

  await act(async () => refetchApplicant())
  await waitForApplicant('pending')

  expect(getVerification().refetchApplicant).toBe(refetchApplicant)
})

test('keeps cached applicant data usable after a background refetch fails', async () => {
  const get = vi
    .fn<ApplicantGateway['get']>()
    .mockResolvedValueOnce({
      ok: true,
      data: { ...applicant, status: 'pending' },
    })
    .mockResolvedValueOnce({
      ok: false,
      code: 'applicant-failed',
      message: 'Something went wrong. Please try again.',
    })
  mount({ enabled: true, applicantGateway: createApplicantGateway(get) })
  await waitForApplicantStatus('success')

  await act(async () => getVerification().refetchApplicant())
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

  expect(getVerification().applicantStatus).toBe('success')
  expect(getVerification().applicant).toEqual({
    ...applicant,
    status: 'pending',
  })
})

test('exposes an absent applicant as successful state', async () => {
  mount({ enabled: true, applicantGateway: createApplicantGateway(() => Promise.resolve({ ok: true, data: null })) })

  await waitForApplicantStatus('success')

  expect(getVerification().applicant).toBeNull()
})

test('reuses a successfully prepared token without another request', async () => {
  const get = vi.fn(() =>
    Promise.resolve({ ok: true as const, data: { token: '_act-token', userId: '41' } }),
  )
  mount({ tokenGateway: createTokenGateway(get) })

  await act(async () => {
    await getVerification().prepareToken()
    await getVerification().prepareToken()
  })
  await waitForToken('_act-token')

  expect(get).toHaveBeenCalledTimes(1)
  expect(getVerification().token).toEqual({ token: '_act-token', userId: '41' })
})

test('keeps token preparation stable while its request enters loading and error states', async () => {
  const requestResolver: {
    current:
      | ((value: {
        ok: false
        code: string
        message: string
      }) => void)
      | null
  } = { current: null }
  mount({
    tokenGateway: createTokenGateway(
      () =>
        new Promise((resolve) => {
          requestResolver.current = resolve
        }),
    ),
  })
  const prepareToken = getVerification().prepareToken

  const preparationHolder: { current: Promise<boolean> | null } = {
    current: null,
  }
  act(() => {
    preparationHolder.current = prepareToken()
  })
  await waitForTokenStatus('loading')

  expect(getVerification().prepareToken).toBe(prepareToken)
  const resolveRequest = requestResolver.current
  const preparation = preparationHolder.current
  if (resolveRequest === null) throw new Error('Token request resolver was not captured')
  if (preparation === null) throw new Error('Token preparation was not captured')
  await act(async () => {
    resolveRequest({
      ok: false,
      code: 'sumsub-token-failed',
      message: 'Something went wrong. Please try again.',
    })
    await expect(preparation).resolves.toBe(false)
  })
  await waitForTokenStatus('error')

  expect(getVerification().prepareToken).toBe(prepareToken)
})

test('refreshes the token even when a cached token exists', async () => {
  const get = vi
    .fn()
    .mockResolvedValueOnce({ ok: true as const, data: { token: '_act-token', userId: '41' } })
    .mockResolvedValueOnce({ ok: true as const, data: { token: '_next-token', userId: '41' } })
  mount({ tokenGateway: createTokenGateway(get) })
  await act(async () => {
    await getVerification().prepareToken()
  })
  await waitForToken('_act-token')

  let token = ''
  await act(async () => {
    token = await getVerification().refreshToken()
  })
  await waitForToken('_next-token')

  expect(get).toHaveBeenCalledTimes(2)
  expect(token).toBe('_next-token')
  expect(getVerification().token).toEqual({ token: '_next-token', userId: '41' })
})

test('clears the in-memory token', async () => {
  mount()
  await act(async () => {
    await getVerification().prepareToken()
  })
  await waitForToken('_act-token')

  act(() => getVerification().clearToken())

  await waitForToken(null)
})

test('does not restore a cleared token when an ignored refresh abort resolves', async () => {
  let resolveToken: ((value: { ok: true; data: { token: string; userId: string } }) => void) | null = null
  let refreshSignal: AbortSignal | undefined
  mount({
    tokenGateway: createTokenGateway(
      (signal) =>
        new Promise((resolve) => {
          refreshSignal = signal
          resolveToken = resolve
        }),
    ),
  })

  let refresh!: Promise<string>
  act(() => {
    refresh = getVerification().refreshToken()
  })
  act(() => getVerification().clearToken())

  expect(refreshSignal?.aborted).toBe(true)
  if (resolveToken === null) throw new Error('Refresh token resolver was not captured')
  await act(async () => {
    resolveToken!({ ok: true, data: { token: '_resurrected-token', userId: '41' } })
    await expect(refresh).rejects.toThrow('Something went wrong. Please try again.')
  })

  expect(queryClient?.getQueryData(['verification', 'sumsub-token'])).toBeUndefined()
})

test('does not publish or return a direct refresh resolved after identity replacement', async () => {
  let activeSessionIdentity = 1
  let resolveToken:
    | ((value: { ok: true; data: { token: string; userId: string } }) => void)
    | null = null
  mount({
    sessionIdentity: activeSessionIdentity,
    isSessionIdentityCurrent: (identity) =>
      identity === activeSessionIdentity,
    tokenGateway: createTokenGateway(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve
        }),
    ),
  })

  let refresh!: Promise<string>
  act(() => {
    refresh = getVerification().refreshToken()
  })
  activeSessionIdentity = 2

  if (resolveToken === null) throw new Error('Refresh token resolver was not captured')
  await act(async () => {
    resolveToken!({
      ok: true,
      data: { token: '_first-user-token', userId: 'first-user' },
    })
    await expect(refresh).rejects.toThrow(
      'Something went wrong. Please try again.',
    )
  })

  expect(queryClient?.getQueryData(SUMSUB_TOKEN_QUERY_KEY)).toBeUndefined()
})

test('does not restore a token when its refresh resolves after provider unmount', async () => {
  let resolveToken: ((value: { ok: true; data: { token: string; userId: string } }) => void) | null = null
  let refreshSignal: AbortSignal | undefined
  mount({
    tokenGateway: createTokenGateway(
      (signal) =>
        new Promise((resolve) => {
          refreshSignal = signal
          resolveToken = resolve
        }),
    ),
  })

  let refresh!: Promise<string>
  act(() => {
    refresh = getVerification().refreshToken()
    root?.unmount()
  })

  expect(refreshSignal?.aborted).toBe(true)
  if (resolveToken === null) throw new Error('Refresh token resolver was not captured')
  await act(async () => {
    resolveToken!({ ok: true, data: { token: '_unmounted-token', userId: '41' } })
    await expect(refresh).rejects.toThrow('Something went wrong. Please try again.')
  })

  expect(queryClient?.getQueryData(['verification', 'sumsub-token'])).toBeUndefined()
})

test('coalesces overlapping token refreshes without aborting either caller', async () => {
  const request: {
    resolve:
      | ((value: { ok: true; data: { token: string; userId: string } }) => void)
      | null
  } = { resolve: null }
  const signals: AbortSignal[] = []
  mount({
    tokenGateway: createTokenGateway(
      (signal) =>
        new Promise((resolve) => {
          if (signal !== undefined) signals.push(signal)
          request.resolve = resolve
        }),
    ),
  })

  let firstRefresh!: Promise<string>
  let secondRefresh!: Promise<string>
  act(() => {
    firstRefresh = getVerification().refreshToken()
    secondRefresh = getVerification().refreshToken()
  })

  expect(signals).toHaveLength(1)
  expect(signals[0]?.aborted).toBe(false)
  const resolveToken = request.resolve
  if (resolveToken === null) throw new Error('Refresh resolver was not captured')
  await act(async () => {
    resolveToken({ ok: true, data: { token: '_new-token', userId: '41' } })
    await expect(firstRefresh).resolves.toBe('_new-token')
    await expect(secondRefresh).resolves.toBe('_new-token')
  })

  expect(queryClient?.getQueryData(['verification', 'sumsub-token'])).toEqual({
    token: '_new-token',
    userId: '41',
  })
})

test('records submission in React state and current-tab storage before unmount', () => {
  const sessionStore = createSessionStore()
  mount({ sessionStore })

  act(() => getVerification().markSubmitted())

  expect(getVerification().submitted).toBe(true)
  expect(sessionStore.isSubmitted()).toBe(true)
})

test('clears mounted submission state when the session identity changes', () => {
  const sessionStore = createSessionStore()
  sessionStore.markSubmitted()
  const state = mount({
    enabled: true,
    sessionStore,
    sessionIdentity: 1,
  })

  expect(getVerification().submitted).toBe(true)

  rerender({
    ...state,
    enabled: true,
    sessionIdentity: 2,
  })

  expect(getVerification().submitted).toBe(false)
  expect(sessionStore.isSubmitted()).toBe(false)
})

test.each([
  ['Sumsub pending', { status: 'pending' as const }],
  ['Sumsub approved', { status: 'approved' as const }],
  ['Sumsub rejected', { status: 'rejected' as const }],
  ['Rain approval', { rainApproved: true }],
  ['terminal Rain rejection', { rainStatus: 'denied' as const }],
  ['locked Rain rejection', { rainStatus: 'locked' as const }],
  ['canceled Rain rejection', { rainStatus: 'canceled' as const }],
])('clears submitted state for durable %s', async (_description, overrides) => {
  const sessionStore = createSessionStore()
  sessionStore.markSubmitted()
  mount({
    enabled: true,
    sessionStore,
    applicantGateway: createApplicantGateway(() =>
      Promise.resolve({ ok: true, data: { ...applicant, ...overrides } }),
    ),
  })

  await waitForApplicantStatus('success')

  expect(getVerification().submitted).toBe(false)
  expect(sessionStore.isSubmitted()).toBe(false)
})

test.each([
  ['not-started Sumsub state', { status: 'not_started' as const }],
  ['temporary Sumsub rejection', { status: 'temporary_rejected' as const }],
])('keeps submitted state for stale %s', async (_description, overrides) => {
  const sessionStore = createSessionStore()
  sessionStore.markSubmitted()
  mount({
    enabled: true,
    sessionStore,
    applicantGateway: createApplicantGateway(() =>
      Promise.resolve({ ok: true, data: { ...applicant, ...overrides } }),
    ),
  })

  await waitForApplicantStatus('success')

  expect(getVerification().submitted).toBe(true)
  expect(sessionStore.isSubmitted()).toBe(true)
})

test('keeps state and storage cleared after durable applicant progress regresses', async () => {
  vi.stubGlobal('queueMicrotask', () => undefined)
  const sessionStore = createSessionStore()
  sessionStore.markSubmitted()
  mount({
    enabled: true,
    sessionStore,
    applicantGateway: createApplicantGateway(() =>
      Promise.resolve({ ok: true, data: { ...applicant, status: 'pending' } }),
    ),
  })

  await waitForApplicantStatus('success')
  expect(getVerification().submitted).toBe(false)
  expect(sessionStore.isSubmitted()).toBe(false)
  act(() => {
    queryClient?.setQueryData(APPLICANT_QUERY_KEY, applicant)
  })
  await waitForApplicant('not_started')

  expect(getVerification().submitted).toBe(false)
  expect(sessionStore.isSubmitted()).toBe(false)
})

test('does not overwrite a later submission after durable applicant progress', async () => {
  const queuedUpdates: VoidFunction[] = []
  vi.stubGlobal('queueMicrotask', (callback: VoidFunction) => {
    queuedUpdates.push(callback)
  })
  const sessionStore = createSessionStore()
  sessionStore.markSubmitted()
  mount({
    enabled: true,
    sessionStore,
    applicantGateway: createApplicantGateway(() =>
      Promise.resolve({ ok: true, data: { ...applicant, status: 'pending' } }),
    ),
  })

  await waitForApplicantStatus('success')
  act(() => getVerification().markSubmitted())

  expect(getVerification().submitted).toBe(true)
  expect(sessionStore.isSubmitted()).toBe(true)
  await act(async () => {
    for (const update of queuedUpdates) update()
  })
  expect(getVerification().submitted).toBe(true)
  expect(sessionStore.isSubmitted()).toBe(true)
})

test('keeps an attempt failure across sibling route changes and consumes it once', () => {
  const sessionStore = createSessionStore()
  const state = mount({ sessionStore })

  act(() => getVerification().markAttemptFailed())
  rerender({ ...state, enabled: true })

  expect(getVerification().consumeAttemptFailure()).toBe(true)
  expect(getVerification().consumeAttemptFailure()).toBe(false)
})
