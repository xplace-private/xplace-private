import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider,
  type RouteComponent,
} from '@tanstack/react-router'
import { act, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

import type { AuthSessionStore } from '../features/auth/api/browser-auth-session-store'
import type { AuthSessionStatus } from '../features/auth/api/browser-auth-session-store'
import type { CurrentUser } from '../features/auth/api/current-user-gateway'
import type { Applicant } from '../features/verification/model/applicant'
import { useAuthFlow } from '../features/auth/auth-flow-provider'
import { AuthScreen } from '../features/auth/auth-screen'
import { createHttpPrivateBalanceGateway } from '../features/home/api/http-private-balance-gateway'
import { HomeScreen } from '../features/home/home-screen'
import { usePrivateBalance } from '../features/home/private-balance-query'
import { createApiClient } from '../shared/api/api-client'
import { appRuntime, type AppRuntime } from './app-runtime'
import { returnToHome } from './navigation'
import { createSessionGeneration } from './session-generation'
import { observeSessionRouteAccess } from './session-route-observer'

const lifecycleCounters = vi.hoisted(() => ({
  authMounts: 0,
  pendingMounts: 0,
  pendingUnmounts: 0,
  providerMounts: 0,
  codeMounts: 0,
  codeUnmounts: 0,
  phoneMounts: 0,
  recoveryMounts: 0,
  recoveryRetry: null as null | (() => Promise<boolean>),
  errorBoundaryMounts: 0,
  protectedLeaves: {
    '/home': { mounts: 0, unmounts: 0 },
    '/onboarding': { mounts: 0, unmounts: 0 },
    '/payment': { mounts: 0, unmounts: 0 },
    '/transactions': { mounts: 0, unmounts: 0 },
    '/verification': { mounts: 0, unmounts: 0 },
    '/verification/sumsub': { mounts: 0, unmounts: 0 },
  },
  useRealRoot: false,
}))

vi.mock('../shared/api/app-env', () => ({
  appEnv: { mode: 'test', apiBaseUrl: 'https://back.example.test' },
}))

vi.mock('../shared/ui/private-page-shell', async () => {
  const { createElement, Fragment } = await import('react')

  return {
    PrivatePageShell: ({ children }: { children: ReactNode }) =>
      createElement(Fragment, null, children),
  }
})

vi.mock('../shared/ui/app-toaster', () => ({ AppToaster: () => null }))

vi.mock('../features/auth/components/session-recovery', async () => {
  const { useEffect } = await import('react')

  return {
    SessionRecovery(props: { onRetry(): Promise<boolean> }) {
      useEffect(() => {
        lifecycleCounters.recoveryMounts += 1
      }, [])
      lifecycleCounters.recoveryRetry = props.onRetry
      return null
    },
  }
})

vi.mock('./route-boundaries', async () => {
  const { useEffect } = await import('react')

  return {
    RouteError() {
      useEffect(() => {
        lifecycleCounters.errorBoundaryMounts += 1
      }, [])
      return null
    },
    RouteNotFound: () => null,
  }
})

vi.mock('../features/auth/components/phone-step', async () => {
  const { useEffect } = await import('react')

  return {
    PhoneStep() {
      useEffect(() => {
        lifecycleCounters.phoneMounts += 1
      }, [])
      return null
    },
  }
})

vi.mock('../features/auth/components/code-step', async () => {
  const { useEffect } = await import('react')

  return {
    CodeStep() {
      useEffect(() => {
        lifecycleCounters.codeMounts += 1
        return () => {
          lifecycleCounters.codeUnmounts += 1
        }
      }, [])
      return null
    },
  }
})

vi.mock('../features/auth/auth-flow-provider', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../features/auth/auth-flow-provider')>()
  const { createElement, useEffect } = await import('react')
  const RealAuthFlowProvider = actual.AuthFlowProvider

  function TrackedAuthFlowProvider(
    props: Parameters<typeof RealAuthFlowProvider>[0],
  ) {
    useEffect(() => {
      lifecycleCounters.providerMounts += 1
    }, [])
    return createElement(RealAuthFlowProvider, props)
  }

  return { ...actual, AuthFlowProvider: TrackedAuthFlowProvider }
})

vi.mock('./root-route', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./root-route')>()
  const { createElement } = await import('react')
  const { Outlet } = await import('@tanstack/react-router')

  return {
    RootRoute: (props: Parameters<typeof actual.RootRoute>[0]) =>
      lifecycleCounters.useRealRoot
        ? createElement(actual.RootRoute, props)
        : createElement(Outlet),
  }
})

vi.mock('./session-route-pending', async () => {
  const { createElement, useEffect } = await import('react')

  function PendingProbe() {
    useEffect(() => {
      lifecycleCounters.pendingMounts += 1
      return () => {
        lifecycleCounters.pendingUnmounts += 1
      }
    }, [])
    return null
  }

  return { SessionRoutePending: () => createElement(PendingProbe) }
})

import { Route as RootFileRoute } from './routes/__root'

const savedSessionStatus: AuthSessionStatus = 'authenticated'
const otpRequestResult = {
  challengeId: 'challenge-1',
  expiresInSeconds: 300,
  resendAfterSeconds: 60,
}
const otpVerificationResult = { isNew: true, isPrivate: true, twoFactorRequirement: null }
const currentUser: CurrentUser = {
  id: 7,
  username: 'alex.morgan',
  email: 'alex@example.com',
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
      if (resolvePromise === undefined) {
        throw new Error('Deferred promise was not initialized')
      }
      resolvePromise(value)
    },
  }
}

function unexpectedGatewayCall(): Promise<never> {
  return Promise.reject(new Error('Unexpected gateway call'))
}

function createRuntime({
  currentUserRequest,
  applicantRequest,
  requestCounts,
  initialStatus = savedSessionStatus,
  authGateway,
  currentUserGateway,
  applicantGateway,
}: {
  currentUserRequest?: Promise<CurrentUser>
  applicantRequest?: Promise<Applicant | null>
  requestCounts: { currentUser: number; applicant: number }
  initialStatus?: AuthSessionStatus
  authGateway?: AppRuntime['authGateway']
  currentUserGateway?: AppRuntime['currentUserGateway']
  applicantGateway?: AppRuntime['applicantGateway']
}): AppRuntime {
  const listeners = new Set<() => void>()
  let status = initialStatus
  const sessionGeneration = createSessionGeneration()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  function clearIdentityQueries() {
    void queryClient.cancelQueries({ queryKey: ['auth', 'current-user'] })
    queryClient.removeQueries({ queryKey: ['auth', 'current-user'] })
    void queryClient.cancelQueries({ queryKey: ['verification', 'applicant'] })
    queryClient.removeQueries({ queryKey: ['verification', 'applicant'] })
  }

  const authSessionStore: AuthSessionStore = {
    readStatus: () => status,
    requireTwoFactor(requirement) {
      sessionGeneration.advance()
      clearIdentityQueries()
      status = requirement
      listeners.forEach((listener) => listener())
    },
    markAuthenticated() {
      if (status !== 'authenticated') {
        sessionGeneration.advance()
        clearIdentityQueries()
      }
      status = 'authenticated'
      listeners.forEach((listener) => listener())
    },
    clear() {
      sessionGeneration.advance()
      queryClient.clear()
      status = 'anonymous'
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  return {
    queryClient,
    authSessionStore,
    sessionGeneration,
    verificationSessionStore: {
      isSubmitted: () => false,
      markSubmitted() {},
      clearSubmitted() {},
      markAttemptFailed() {},
      consumeAttemptFailure: () => false,
      clear() {},
    },
    authGateway: authGateway ?? {
      requestCode: unexpectedGatewayCall,
      verifyOtp: unexpectedGatewayCall,
      signOut: () => Promise.resolve(),
    },
    authenticatorGateway: { getSetup: unexpectedGatewayCall, verifyCode: unexpectedGatewayCall },
    currentUserGateway: currentUserGateway ?? {
      async get() {
        requestCounts.currentUser += 1
        return {
          ok: true,
          data: await (currentUserRequest ?? Promise.resolve(currentUser)),
        }
      },
    },
    applicantGateway: applicantGateway ?? {
      async get() {
        requestCounts.applicant += 1
        return {
          ok: true,
          data: await (applicantRequest ?? Promise.resolve(pendingApplicant)),
        }
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
      get: unexpectedGatewayCall,
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

function AuthProbe() {
  useEffect(() => {
    lifecycleCounters.authMounts += 1
  }, [])
  return null
}

const protectedPaths = [
  '/home',
  '/onboarding',
  '/payment',
  '/transactions',
  '/verification',
  '/verification/sumsub',
] as const

type ProtectedPath = (typeof protectedPaths)[number]

function resetRouteLifecycleCounters() {
  lifecycleCounters.authMounts = 0
  lifecycleCounters.recoveryMounts = 0
  lifecycleCounters.recoveryRetry = null
  lifecycleCounters.errorBoundaryMounts = 0
  for (const pathname of protectedPaths) {
    lifecycleCounters.protectedLeaves[pathname].mounts = 0
    lifecycleCounters.protectedLeaves[pathname].unmounts = 0
  }
}

function resetOtpLifecycleCounters() {
  resetRouteLifecycleCounters()
  lifecycleCounters.providerMounts = 0
  lifecycleCounters.codeMounts = 0
  lifecycleCounters.codeUnmounts = 0
  lifecycleCounters.phoneMounts = 0
  lifecycleCounters.pendingMounts = 0
  lifecycleCounters.pendingUnmounts = 0
  capturedAuth = null
}

function trackedProtectedLeaf(pathname: ProtectedPath) {
  return function ProtectedLeafProbe() {
    useEffect(() => {
      lifecycleCounters.protectedLeaves[pathname].mounts += 1
      return () => {
        lifecycleCounters.protectedLeaves[pathname].unmounts += 1
      }
    }, [])
    return null
  }
}

function createLifecycleRouter(
  runtime: AppRuntime,
  initialPathname: string,
  indexComponent: RouteComponent = AuthProbe,
  homeComponent: RouteComponent = trackedProtectedLeaf('/home'),
) {
  const indexRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/',
    component: indexComponent,
  })
  const homeRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/home',
    component: homeComponent,
  })
  const onboardingRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/onboarding',
    component: trackedProtectedLeaf('/onboarding'),
  })
  const paymentRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/payment',
    component: trackedProtectedLeaf('/payment'),
  })
  const transactionsRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/transactions',
    component: trackedProtectedLeaf('/transactions'),
  })
  const verificationRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/verification',
    component: trackedProtectedLeaf('/verification'),
  })
  const sumsubRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/verification/sumsub',
    component: trackedProtectedLeaf('/verification/sumsub'),
  })

  return createRouter({
    routeTree: RootFileRoute.addChildren([
      indexRoute,
      homeRoute,
      onboardingRoute,
      paymentRoute,
      transactionsRoute,
      verificationRoute,
      sumsubRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPathname] }),
    context: runtime,
    isServer: false,
    origin: 'http://localhost',
  })
}

type AuthFlowValue = ReturnType<typeof useAuthFlow>
let capturedAuth: AuthFlowValue | null = null

function SessionAuthRoute() {
  const auth = useAuthFlow()

  useEffect(() => {
    capturedAuth = auth
  }, [auth])

  return <AuthScreen />
}

function getCapturedAuth(): AuthFlowValue {
  if (capturedAuth === null) {
    throw new Error('Auth flow was not captured')
  }
  return capturedAuth
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
    appendChild(child: Element) {
      return child
    },
    insertBefore(child: Element) {
      return child
    },
    removeChild(child: Element) {
      return child
    },
  } as unknown as Element
}

async function flushRouter() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function waitForCondition(condition: () => boolean, message: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) return
    await flushRouter()
  }
  throw new Error(message)
}

async function mountLoadedLifecycleRouter({
  runtime,
  initialPathname,
  observeSession = false,
  useRealRoot = false,
  indexComponent,
  homeComponent,
}: {
  runtime: AppRuntime
  initialPathname: string
  observeSession?: boolean
  useRealRoot?: boolean
  indexComponent?: RouteComponent
  homeComponent?: RouteComponent
}) {
  const originalRuntime = { ...appRuntime }
  if (useRealRoot) {
    Object.assign(appRuntime, runtime)
  }
  lifecycleCounters.useRealRoot = useRealRoot

  const router = createLifecycleRouter(
    runtime,
    initialPathname,
    indexComponent,
    homeComponent,
  )
  const stopObserving = observeSession
    ? observeSessionRouteAccess(runtime.authSessionStore, router)
    : () => undefined
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { HTMLIFrameElement: new () => object }
    document?: {
      visibilityState: DocumentVisibilityState
      addEventListener(): void
      removeEventListener(): void
    }
    scrollTo?: () => void
  }
  const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
  const previousWindow = browserGlobal.window
  const previousDocument = browserGlobal.document
  const previousScrollTo = browserGlobal.scrollTo
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  browserGlobal.document = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
  }
  browserGlobal.scrollTo = () => undefined
  let reactRoot: Root | null = createRoot(createEmptyReactContainer())

  await router.load()
  await act(async () => {
    reactRoot?.render(<RouterProvider router={router} />)
  })
  await flushRouter()

  return {
    router,
    async cleanup() {
      stopObserving()
      if (reactRoot !== null) {
        act(() => reactRoot?.unmount())
        reactRoot = null
      }
      runtime.queryClient.clear()
      if (useRealRoot) {
        Object.assign(appRuntime, originalRuntime)
      }
      lifecycleCounters.useRealRoot = false
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
      }
      if (previousWindow === undefined) delete browserGlobal.window
      else browserGlobal.window = previousWindow
      if (previousDocument === undefined) delete browserGlobal.document
      else browserGlobal.document = previousDocument
      if (previousScrollTo === undefined) delete browserGlobal.scrollTo
      else browserGlobal.scrollTo = previousScrollTo
    },
  }
}

function expectOnlyDurableLeafMounted(pathname: ProtectedPath) {
  for (const protectedPath of protectedPaths) {
    expect(lifecycleCounters.protectedLeaves[protectedPath]).toEqual({
      mounts: protectedPath === pathname ? 1 : 0,
      unmounts: 0,
    })
  }
}

function expectNoProtectedLeafMounted() {
  for (const pathname of protectedPaths) {
    expect(lifecycleCounters.protectedLeaves[pathname]).toEqual({
      mounts: 0,
      unmounts: 0,
    })
  }
}

async function startOtpVerification(): Promise<{
  verification: Promise<boolean>
}> {
  act(() => getCapturedAuth().setPhone('554570290'))
  await act(async () => {
    await getCapturedAuth().requestCode()
  })
  act(() => getCapturedAuth().setCode('123456'))
  lifecycleCounters.phoneMounts = 0

  const verification = getCapturedAuth().verifyCode()
  await flushRouter()
  return { verification }
}

test.each([
  ['/payment', 'back'],
  ['/transactions', 'back'],
  ['/payment', 'browser'],
  ['/transactions', 'browser'],
  ['/payment', 'direct'],
  ['/transactions', 'direct'],
] as const)('refreshes the visible home balance after %s (%s)', async (pathname, navigation) => {
  const runtime = createRuntime({
    requestCounts: { currentUser: 0, applicant: 0 },
    applicantRequest: Promise.resolve({
      ...pendingApplicant,
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
  })
  const response = {
    available_to_spend: '100.00',
    spent_this_period: '50.00',
    due_this_period: '50.00',
    due_date: null,
    overdue: [],
  }
  const refresh = deferred<typeof response>()
  const request = vi.fn()
    .mockResolvedValueOnce(response)
    .mockReturnValue(refresh.promise)
  runtime.privateBalanceGateway = createHttpPrivateBalanceGateway({ request })
  let homeHtml = ''

  function BalanceProbe() {
    const balance = usePrivateBalance(runtime.privateBalanceGateway, true)
    useEffect(() => {
      homeHtml = renderToStaticMarkup(<HomeScreen balance={balance.data} />)
    }, [balance.data])
    return null
  }

  const mounted = await mountLoadedLifecycleRouter({
    runtime,
    initialPathname: navigation === 'direct' ? pathname : '/home',
    homeComponent: () => (
      <QueryClientProvider client={runtime.queryClient}>
        <BalanceProbe />
      </QueryClientProvider>
    ),
  })

  try {
    if (navigation !== 'direct') {
      expect(homeHtml).toContain('USD 100.00')
      expect(homeHtml).toContain('USD 50.00')
      await act(async () => mounted.router.history.push(pathname))
      await waitForCondition(() => mounted.router.state.status === 'idle', 'Child route did not settle')
    } else if (pathname === '/transactions') {
      // Transactions does not load balance, so seed the previous home snapshot.
      await runtime.privateBalanceGateway.get()
      runtime.queryClient.setQueryData(['home', 'private-balance'], {
        availableToSpendCents: 10000,
        spentThisPeriodCents: 5000,
        dueThisPeriodCents: 5000,
        dueDate: null,
        overdue: [],
      })
    }
    expect(request).toHaveBeenCalledTimes(1)

    await act(async () => {
      if (navigation === 'browser') mounted.router.history.back()
      else returnToHome(mounted.router.history)
    })
    await waitForCondition(
      () => mounted.router.state.location.pathname === '/home' && mounted.router.state.status === 'idle',
      'Return to home did not settle',
    )
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenLastCalledWith('cards/private/balance/', {
      authenticated: true,
      signal: undefined,
    })
    expect(homeHtml).toContain('USD 100.00')
    expect(homeHtml).toContain('USD 50.00')

    expect(homeHtml).toContain('Pay now')
    await act(async () => refresh.resolve({
      ...response,
      available_to_spend: '250.00',
      spent_this_period: '25.00',
      due_this_period: '0.00',
    }))
    await waitForCondition(() => homeHtml.includes('USD 250.00'), 'Refreshed balance did not render')
    expect(homeHtml).toContain('USD 0.00')
    expect(homeHtml).not.toContain('USD 25.00')
    expect(homeHtml).not.toContain('USD 100.00')
    expect(homeHtml).not.toContain('USD 50.00')
    expect(homeHtml).not.toContain('Pay now')
    expect(request).toHaveBeenCalledTimes(2)
  } finally {
    await mounted.cleanup()
  }
})

test.each(protectedPaths)(
  'redirects an anonymous direct link to %s before any protected leaf mounts',
  async (initialPathname) => {
    resetRouteLifecycleCounters()
    const requestCounts = { currentUser: 0, applicant: 0 }
    const runtime = createRuntime({
      requestCounts,
      initialStatus: 'anonymous',
    })
    const mounted = await mountLoadedLifecycleRouter({
      runtime,
      initialPathname,
    })

    try {
      expect(mounted.router.state.location.pathname).toBe('/')
      expect(mounted.router.history.length).toBe(1)
      expect(mounted.router.history.canGoBack()).toBe(false)
      expectNoProtectedLeafMounted()
      expect(lifecycleCounters.authMounts).toBe(1)
      expect(requestCounts).toEqual({ currentUser: 0, applicant: 0 })
    } finally {
      await mounted.cleanup()
    }
  },
)

test.each([
  ['absent applicant', '/home', null, '/onboarding'],
  [
    'missing Sumsub identifier',
    '/verification',
    { ...pendingApplicant, sumsubId: null },
    '/onboarding',
  ],
  ['pending applicant', '/home', pendingApplicant, '/verification'],
  [
    'Rain-approved applicant',
    '/verification',
    {
      ...pendingApplicant,
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    },
    '/home',
  ],
  [
    'Sumsub-eligible applicant',
    '/verification/sumsub',
    { ...pendingApplicant, status: 'not_started' },
    '/verification/sumsub',
  ],
] satisfies ReadonlyArray<
  readonly [string, ProtectedPath, Applicant | null, ProtectedPath]
>)(
  'commits only the durable leaf for a stored session with %s',
  async (_case, initialPathname, applicant, durablePathname) => {
    resetRouteLifecycleCounters()
    const requestCounts = { currentUser: 0, applicant: 0 }
    const runtime = createRuntime({
      currentUserRequest: Promise.resolve(currentUser),
      applicantRequest: Promise.resolve(applicant),
      requestCounts,
    })
    const mounted = await mountLoadedLifecycleRouter({
      runtime,
      initialPathname,
    })

    try {
      expect(mounted.router.state.location.pathname).toBe(durablePathname)
      expectOnlyDurableLeafMounted(durablePathname)
      expect(lifecycleCounters.authMounts).toBe(0)
      expect(requestCounts).toEqual({ currentUser: 1, applicant: 1 })
    } finally {
      await mounted.cleanup()
    }
  },
)

test('renders session recovery for a non-401 current-user failure without mounting a protected leaf', async () => {
  resetRouteLifecycleCounters()
  const requestCounts = { currentUser: 0, applicant: 0 }
  let currentUserFails = true
  const runtime = createRuntime({
    requestCounts,
    currentUserGateway: {
      get() {
        requestCounts.currentUser += 1
        return currentUserFails
          ? Promise.resolve({
              ok: false as const,
              code: 'current-user-failed',
              message: 'Internal details must not reach the UI',
            })
          : Promise.resolve({ ok: true as const, data: currentUser })
      },
    },
  })
  const mounted = await mountLoadedLifecycleRouter({
    runtime,
    initialPathname: '/home',
    useRealRoot: true,
  })

  try {
    await waitForCondition(
      () => lifecycleCounters.recoveryMounts === 1,
      'Session recovery did not mount',
    )

    expect(mounted.router.state.location.pathname).toBe('/home')
    expect(lifecycleCounters.recoveryMounts).toBe(1)
    expectNoProtectedLeafMounted()
    expect(requestCounts).toEqual({ currentUser: 1, applicant: 0 })

    currentUserFails = false
    const retry = lifecycleCounters.recoveryRetry
    if (retry === null) throw new Error('Session recovery retry was not captured')
    await act(async () => {
      await expect(retry()).resolves.toBe(true)
    })
    await waitForCondition(
      () => mounted.router.state.location.pathname === '/verification',
      'Recovered session did not reconcile to /verification',
    )

    expectOnlyDurableLeafMounted('/verification')
    expect(lifecycleCounters.protectedLeaves['/home'].mounts).toBe(0)
    expect(requestCounts).toEqual({ currentUser: 2, applicant: 1 })
  } finally {
    await mounted.cleanup()
  }
})

test('renders the root error boundary for an uncached applicant failure without mounting a protected leaf', async () => {
  resetRouteLifecycleCounters()
  const requestCounts = { currentUser: 0, applicant: 0 }
  const runtime = createRuntime({
    requestCounts,
    applicantGateway: {
      get() {
        requestCounts.applicant += 1
        return Promise.resolve({
          ok: false,
          code: 'applicant-failed',
          message: 'Unable to load applicant. Try again.',
        })
      },
    },
  })
  const mounted = await mountLoadedLifecycleRouter({
    runtime,
    initialPathname: '/home',
  })

  try {
    await waitForCondition(
      () => lifecycleCounters.errorBoundaryMounts === 1,
      'Root error boundary did not mount',
    )

    expect(mounted.router.state.location.pathname).toBe('/home')
    expect(lifecycleCounters.errorBoundaryMounts).toBe(1)
    expectNoProtectedLeafMounted()
    expect(requestCounts).toEqual({ currentUser: 1, applicant: 1 })
  } finally {
    await mounted.cleanup()
  }
})

test('session logout invalidates mounted protected access, unmounts it, and replaces to auth', async () => {
  resetRouteLifecycleCounters()
  const requestCounts = { currentUser: 0, applicant: 0 }
  const runtime = createRuntime({
    requestCounts,
    applicantRequest: Promise.resolve({
      ...pendingApplicant,
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
  })
  const mounted = await mountLoadedLifecycleRouter({
    runtime,
    initialPathname: '/home',
    observeSession: true,
  })

  try {
    expectOnlyDurableLeafMounted('/home')

    act(() => runtime.authSessionStore.clear())
    await waitForCondition(
      () => mounted.router.state.location.pathname === '/',
      'Router did not reconcile session logout to /',
    )

    expect(lifecycleCounters.protectedLeaves['/home']).toEqual({
      mounts: 1,
      unmounts: 1,
    })
    expect(lifecycleCounters.authMounts).toBe(1)
    expect(runtime.queryClient.getQueryCache().getAll()).toHaveLength(0)
  } finally {
    await mounted.cleanup()
  }
})

test('an authenticated 401 clears the mounted protected session and commits auth through Router invalidation', async () => {
  resetRouteLifecycleCounters()
  const requestCounts = { currentUser: 0, applicant: 0 }
  const runtime = createRuntime({
    requestCounts,
    applicantRequest: Promise.resolve({
      ...pendingApplicant,
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
  })
  const mounted = await mountLoadedLifecycleRouter({
    runtime,
    initialPathname: '/home',
    observeSession: true,
  })
  const authenticatedClient = createApiClient({
    baseUrl: 'https://back.example.test/api/v1',
    onUnauthorized: runtime.clearSession,
    fetch: async () =>
      new Response('{"detail":"Unauthorized"}', { status: 401 }),
  })

  try {
    expectOnlyDurableLeafMounted('/home')

    await act(async () => {
      await expect(
        authenticatedClient.request('users/me/', { authenticated: true }),
      ).rejects.toMatchObject({ status: 401 })
    })
    await waitForCondition(
      () => mounted.router.state.location.pathname === '/',
      'Router did not reconcile the authenticated 401 to /',
    )

    expect(runtime.authSessionStore.readStatus()).toBe('anonymous')
    expect(lifecycleCounters.protectedLeaves['/home']).toEqual({
      mounts: 1,
      unmounts: 1,
    })
    expect(lifecycleCounters.authMounts).toBe(1)
    expect(runtime.queryClient.getQueryCache().getAll()).toHaveLength(0)
  } finally {
    await mounted.cleanup()
  }
})

test('does not flash root pending during a fast cold-session resolution', async () => {
  lifecycleCounters.authMounts = 0
  lifecycleCounters.pendingMounts = 0
  lifecycleCounters.pendingUnmounts = 0
  const currentUserRequest = deferred<CurrentUser>()
  const applicantRequest = deferred<Applicant | null>()
  const requestCounts = { currentUser: 0, applicant: 0 }
  const runtime = createRuntime({
    currentUserRequest: currentUserRequest.promise,
    applicantRequest: applicantRequest.promise,
    requestCounts,
  })
  const indexRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/',
    component: AuthProbe,
  })
  const verificationRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/verification',
    component: () => null,
  })
  const router = createRouter({
    routeTree: RootFileRoute.addChildren([indexRoute, verificationRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: runtime,
    isServer: false,
    origin: 'http://localhost',
  })
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { HTMLIFrameElement: new () => object }
    scrollTo?: () => void
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  browserGlobal.scrollTo = () => undefined
  let reactRoot: Root | null = createRoot(createEmptyReactContainer())
  const loadPromise = router.load()

  try {
    await act(async () => {
      reactRoot?.render(<RouterProvider router={router} />)
    })
    await flushRouter()

    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.pendingUnmounts).toBe(0)
    expect(lifecycleCounters.authMounts).toBe(0)
    expect(requestCounts).toEqual({ currentUser: 1, applicant: 0 })

    currentUserRequest.resolve(currentUser)
    await waitForCondition(
      () => requestCounts.applicant === 1,
      'Applicant request did not start',
    )

    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.pendingUnmounts).toBe(0)
    expect(lifecycleCounters.authMounts).toBe(0)

    applicantRequest.resolve(pendingApplicant)
    await act(async () => {
      await loadPromise
    })
    await waitForCondition(
      () => router.state.location.pathname === '/verification',
      'Router did not reach /verification',
    )

    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.pendingUnmounts).toBe(0)
    expect(lifecycleCounters.authMounts).toBe(0)
  } finally {
    currentUserRequest.resolve(currentUser)
    applicantRequest.resolve(pendingApplicant)
    await loadPromise.catch(() => undefined)
    if (reactRoot !== null) {
      act(() => reactRoot?.unmount())
      reactRoot = null
    }
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
    delete browserGlobal.window
    delete browserGlobal.scrollTo
  }
})

test('keeps one code-screen instance through OTP session resolution and one final replacement', async () => {
  lifecycleCounters.providerMounts = 0
  lifecycleCounters.codeMounts = 0
  lifecycleCounters.codeUnmounts = 0
  lifecycleCounters.phoneMounts = 0
  lifecycleCounters.pendingMounts = 0
  lifecycleCounters.pendingUnmounts = 0
  lifecycleCounters.useRealRoot = true
  capturedAuth = null
  const currentUserRequest = deferred<CurrentUser>()
  const applicantRequest = deferred<Applicant | null>()
  const requestCounts = { currentUser: 0, applicant: 0 }
  const verifyOtp = vi.fn(() =>
    Promise.resolve({ ok: true as const, data: otpVerificationResult }),
  )
  const runtime = createRuntime({
    currentUserRequest: currentUserRequest.promise,
    applicantRequest: applicantRequest.promise,
    requestCounts,
    initialStatus: 'anonymous',
    authGateway: {
      requestCode: () =>
        Promise.resolve({ ok: true as const, data: otpRequestResult }),
      verifyOtp,
      signOut: () => Promise.resolve(),
    },
  })
  const originalRuntime = { ...appRuntime }
  Object.assign(appRuntime, runtime)
  const indexRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/',
    component: SessionAuthRoute,
  })
  const verificationRoute = createRoute({
    getParentRoute: () => RootFileRoute,
    path: '/verification',
    component: () => null,
  })
  const router = createRouter({
    routeTree: RootFileRoute.addChildren([indexRoute, verificationRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: runtime,
    isServer: false,
    origin: 'http://localhost',
  })
  const navigate = vi.spyOn(router, 'navigate')
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { HTMLIFrameElement: new () => object }
    document?: {
      visibilityState: DocumentVisibilityState
      addEventListener(): void
      removeEventListener(): void
    }
    scrollTo?: () => void
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  browserGlobal.document = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
  }
  browserGlobal.scrollTo = () => undefined
  let reactRoot: Root | null = createRoot(createEmptyReactContainer())
  let verification: Promise<boolean> | null = null

  try {
    await router.load()
    await act(async () => {
      reactRoot?.render(<RouterProvider router={router} />)
    })

    act(() => getCapturedAuth().setPhone('554570290'))
    await act(async () => {
      await getCapturedAuth().requestCode()
    })
    act(() => getCapturedAuth().setCode('123456'))
    lifecycleCounters.phoneMounts = 0

    verification = getCapturedAuth().verifyCode()
    await flushRouter()

    expect(getCapturedAuth().state).toMatchObject({
      submission: 'pending',
      submissionKind: 'verify-code',
    })
    expect(lifecycleCounters.codeMounts).toBe(1)
    expect(lifecycleCounters.codeUnmounts).toBe(0)
    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.phoneMounts).toBe(0)
    expect(lifecycleCounters.providerMounts).toBe(1)
    expect(requestCounts).toEqual({ currentUser: 1, applicant: 0 })

    currentUserRequest.resolve(currentUser)
    await waitForCondition(
      () => requestCounts.applicant === 1,
      'Applicant request did not start after OTP current-user resolution',
    )

    expect(getCapturedAuth().state.submission).toBe('pending')
    expect(lifecycleCounters.codeMounts).toBe(1)
    expect(lifecycleCounters.codeUnmounts).toBe(0)
    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.phoneMounts).toBe(0)

    applicantRequest.resolve(pendingApplicant)
    await act(async () => {
      await expect(verification).resolves.toBe(true)
    })
    await waitForCondition(
      () => router.state.location.pathname === '/verification',
      'Router did not reach /verification after OTP handoff',
    )

    expect(lifecycleCounters.codeMounts).toBe(1)
    expect(lifecycleCounters.codeUnmounts).toBe(1)
    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.pendingUnmounts).toBe(0)
    expect(lifecycleCounters.phoneMounts).toBe(0)
    expect(lifecycleCounters.providerMounts).toBe(1)
    expect(requestCounts).toEqual({ currentUser: 1, applicant: 1 })
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith({
      to: '/verification',
      replace: true,
    })
  } finally {
    currentUserRequest.resolve(currentUser)
    applicantRequest.resolve(pendingApplicant)
    await verification?.catch(() => undefined)
    await flushRouter()
    if (reactRoot !== null) {
      act(() => reactRoot?.unmount())
    }
    reactRoot = null
    Object.assign(appRuntime, originalRuntime)
    runtime.queryClient.clear()
    lifecycleCounters.useRealRoot = false
    capturedAuth = null
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
    delete browserGlobal.window
    delete browserGlobal.document
    delete browserGlobal.scrollTo
  }
})

test('keeps OTP recovery to one request until explicit Retry completes durable routing', async () => {
  resetOtpLifecycleCounters()
  const requestCounts = { currentUser: 0, applicant: 0 }
  const verifyOtp = vi.fn(() =>
    Promise.resolve({ ok: true as const, data: otpVerificationResult }),
  )
  let currentUserFails = true
  const runtime = createRuntime({
    requestCounts,
    initialStatus: 'anonymous',
    authGateway: {
      requestCode: () =>
        Promise.resolve({ ok: true as const, data: otpRequestResult }),
      verifyOtp,
      signOut: () => Promise.resolve(),
    },
    currentUserGateway: {
      get() {
        requestCounts.currentUser += 1
        return currentUserFails
          ? Promise.resolve({
              ok: false as const,
              code: 'current-user-failed',
              message: 'Internal details must not reach the UI',
            })
          : Promise.resolve({ ok: true as const, data: currentUser })
      },
    },
  })
  const mounted = await mountLoadedLifecycleRouter({
    runtime,
    initialPathname: '/',
    useRealRoot: true,
    indexComponent: SessionAuthRoute,
  })
  let verification: Promise<boolean> | null = null

  try {
    ;({ verification } = await startOtpVerification())
    await waitForCondition(
      () => lifecycleCounters.recoveryMounts === 1,
      'Post-OTP recovery did not mount',
    )
    await act(async () => {
      await expect(verification).resolves.toBe(false)
    })

    expect(requestCounts).toEqual({ currentUser: 1, applicant: 0 })
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(lifecycleCounters.codeMounts).toBe(1)
    expect(lifecycleCounters.codeUnmounts).toBe(1)
    expect(lifecycleCounters.phoneMounts).toBe(0)
    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.providerMounts).toBe(1)
    expectNoProtectedLeafMounted()

    currentUserFails = false
    const retry = lifecycleCounters.recoveryRetry
    if (retry === null) throw new Error('Post-OTP recovery retry was not captured')
    await act(async () => {
      await expect(retry()).resolves.toBe(true)
    })
    await waitForCondition(
      () => mounted.router.state.location.pathname === '/verification',
      'Post-OTP recovery did not reach /verification',
    )

    expect(requestCounts).toEqual({ currentUser: 2, applicant: 1 })
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.phoneMounts).toBe(0)
    expect(lifecycleCounters.providerMounts).toBe(1)
    expectOnlyDurableLeafMounted('/verification')
  } finally {
    await verification?.catch(() => undefined)
    await mounted.cleanup()
    capturedAuth = null
  }
})

test('keeps the code screen mounted when post-OTP current-user resolution clears a 401 session', async () => {
  resetOtpLifecycleCounters()
  const requestCounts = { currentUser: 0, applicant: 0 }
  const verifyOtp = vi.fn(() =>
    Promise.resolve({ ok: true as const, data: otpVerificationResult }),
  )
  const runtime = createRuntime({
    requestCounts,
    initialStatus: 'anonymous',
    authGateway: {
      requestCode: () =>
        Promise.resolve({ ok: true as const, data: otpRequestResult }),
      verifyOtp,
      signOut: () => Promise.resolve(),
    },
    currentUserGateway: {
      get() {
        requestCounts.currentUser += 1
        runtime.clearSession()
        return Promise.resolve({
          ok: false as const,
          code: 'current-user-failed',
          message: 'Internal details must not reach the UI',
        })
      },
    },
  })
  const mounted = await mountLoadedLifecycleRouter({
    runtime,
    initialPathname: '/',
    observeSession: true,
    useRealRoot: true,
    indexComponent: SessionAuthRoute,
  })
  let verification: Promise<boolean> | null = null

  try {
    ;({ verification } = await startOtpVerification())
    await act(async () => {
      await expect(verification).resolves.toBe(false)
    })
    await waitForCondition(
      () => getCapturedAuth().session.status === 'anonymous',
      'Post-OTP 401 did not become anonymous',
    )

    expect(mounted.router.state.location.pathname).toBe('/')
    expect(runtime.authSessionStore.readStatus()).toBe('anonymous')
    expect(requestCounts).toEqual({ currentUser: 1, applicant: 0 })
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(lifecycleCounters.codeMounts).toBe(1)
    expect(lifecycleCounters.codeUnmounts).toBe(0)
    expect(lifecycleCounters.phoneMounts).toBe(0)
    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.recoveryMounts).toBe(0)
    expect(lifecycleCounters.errorBoundaryMounts).toBe(0)
    expect(lifecycleCounters.providerMounts).toBe(1)
    expectNoProtectedLeafMounted()
  } finally {
    await verification?.catch(() => undefined)
    await mounted.cleanup()
    capturedAuth = null
  }
})

test('routes an uncached post-OTP applicant failure to the root error boundary', async () => {
  resetOtpLifecycleCounters()
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const requestCounts = { currentUser: 0, applicant: 0 }
  const verifyOtp = vi.fn(() =>
    Promise.resolve({ ok: true as const, data: otpVerificationResult }),
  )
  const runtime = createRuntime({
    requestCounts,
    initialStatus: 'anonymous',
    authGateway: {
      requestCode: () =>
        Promise.resolve({ ok: true as const, data: otpRequestResult }),
      verifyOtp,
      signOut: () => Promise.resolve(),
    },
    applicantGateway: {
      get() {
        requestCounts.applicant += 1
        return Promise.resolve({
          ok: false as const,
          code: 'applicant-failed',
          message: 'Internal details must not reach the UI',
        })
      },
    },
  })
  const mounted = await mountLoadedLifecycleRouter({
    runtime,
    initialPathname: '/',
    useRealRoot: true,
    indexComponent: SessionAuthRoute,
  })
  let verification: Promise<boolean> | null = null

  try {
    ;({ verification } = await startOtpVerification())
    await act(async () => {
      await expect(verification).resolves.toBe(false)
    })
    await waitForCondition(
      () => lifecycleCounters.errorBoundaryMounts === 1,
      'Post-OTP applicant failure did not reach the root error boundary',
    )

    expect(mounted.router.state.location.pathname).toBe('/')
    expect(requestCounts.currentUser).toBe(1)
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(lifecycleCounters.codeMounts).toBe(1)
    expect(lifecycleCounters.codeUnmounts).toBe(1)
    expect(lifecycleCounters.phoneMounts).toBe(0)
    expect(lifecycleCounters.pendingMounts).toBe(0)
    expect(lifecycleCounters.recoveryMounts).toBe(0)
    expect(lifecycleCounters.errorBoundaryMounts).toBe(1)
    expect(lifecycleCounters.providerMounts).toBe(1)
    expectNoProtectedLeafMounted()
  } finally {
    await verification?.catch(() => undefined)
    await mounted.cleanup()
    consoleError.mockRestore()
    capturedAuth = null
  }
})
