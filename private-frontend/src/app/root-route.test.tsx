vi.mock('../features/home/api/http-physical-card-gateway', async (importOriginal) => ({ ...await importOriginal<typeof import('../features/home/api/http-physical-card-gateway')>(), createHttpPhysicalCardGateway: () => ({ latest: async () => null }) }))
import {
  Component,
  act,
  type ElementType,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import type { QueryClient } from '@tanstack/react-query'
import { expect, test, vi } from 'vitest'

import type { AuthSessionStatus } from '../features/auth/api/browser-auth-session-store'
import type { useAuthFlow } from '../features/auth/auth-flow-provider'
import type { StartPaymentPlanInput } from '../features/home/model/payment-plan'
import type { usePaymentPlans } from '../features/home/payment-plans-provider'
import type { SubmitApplicantInput } from '../features/onboarding/api/onboarding-gateway'
import type { useOnboardingFlow } from '../features/onboarding/onboarding-flow-provider'
import type { Applicant } from '../features/verification/model/applicant'
import type { useVerificationFlow } from '../features/verification/verification-flow-provider'

interface CapturedSumsubSdkProps {
  accessToken: string
  expirationHandler(): Promise<string>
  config: { lang: string; theme: string }
  options: { addViewportTag: boolean; adaptIframeHeight: boolean }
  onMessage(type: string): void
  onError(): void
}

const rootTestState = vi.hoisted(() => ({
  auth: null as unknown,
  onboarding: null as unknown,
  verification: null as unknown,
  queryClient: null as QueryClient | null,
  paymentPlans: null as unknown,
  listCalls: 0,
  startCalls: 0,
  resolvePendingStart: null as (() => void) | null,
  sessionStatus: 'anonymous' as AuthSessionStatus,
  sessionListeners: new Set<() => void>(),
  currentUser: {
    id: 1,
    username: 'yury',
    email: 'yury@example.com',
    avatar: null,
  },
  currentUserResult: 'success' as 'success' | 'failure' | 'pending',
  resolvePendingCurrentUser: null as (() => void) | null,
  pathname: '/',
  pushes: [] as string[],
  replacements: [] as string[],
  routeListeners: new Set<() => void>(),
  integrationFlow: false,
  onboardingRouteComponent: null as ElementType | null,
  reactContainer: null as Element | null,
  applicantPosts: [] as SubmitApplicantInput[],
  sumsubTokenCalls: 0,
  sumsubSdkProps: null as CapturedSumsubSdkProps | null,
  outletRenders: 0,
  outletUnmounts: 0,
  skeletonRenders: 0,
  cardsEnabled: [] as boolean[],
  recovery: null as
    | null
    | { message: string; onRetry(): Promise<boolean>; onSignOut(): void },
  applicant: {
    id: 41,
    gender: null,
    sumsubId: 'sumsub-41',
    status: 'not_started',
    adminReviewStatus: 'not_required',
    rainApproved: false,
    rainStatus: 'pending',
  } as Applicant,
  applicantResult: 'success' as 'success' | 'absent' | 'failure' | 'pending',
  applicantCalls: 0,
  resolvePendingApplicant: null as (() => void) | null,
  sumsubTokenResult: 'success' as 'success' | 'pending',
  resolvePendingSumsubToken: null as (() => void) | null,
  rejectPendingSumsubToken: null as ((reason?: unknown) => void) | null,
  routeErrors: [] as Error[],
  sessionStorage: new Map<string, string>(),
  unauthorized: null as (() => void) | null,
}))

vi.mock('@sumsub/websdk-react', () => ({
  default: (props: CapturedSumsubSdkProps) => {
    rootTestState.sumsubSdkProps = props
    return null
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  const { Fragment, createElement, useEffect, useSyncExternalStore } =
    await import('react')
  const { useAuthFlow } = await import('../features/auth/auth-flow-provider')
  const { usePaymentPlans } = await import(
    '../features/home/payment-plans-provider'
  )
  const { SumsubVerificationScreen } = await import(
    '../features/verification/sumsub-verification-screen'
  )
  const { VerificationScreen } = await import(
    '../features/verification/verification-screen'
  )
  const {
    completeVerification,
    finishSumsubVerification,
    startSumsubVerification,
  } = await import('./navigation')

  function PaymentPlansProbe() {
    rootTestState.paymentPlans = usePaymentPlans()
    return null
  }

  const history = {
    back() {},
    canGoBack() {
      return false
    },
    push(path: string) {
      rootTestState.pushes.push(path)
      rootTestState.pathname = path
      if (rootTestState.integrationFlow) {
        rootTestState.routeListeners.forEach((listener) => listener())
      }
    },
    replace(path: string) {
      rootTestState.replacements.push(path)
      rootTestState.pathname = path
      if (rootTestState.integrationFlow) {
        rootTestState.routeListeners.forEach((listener) => listener())
      }
    },
  }
  const router = {
    history,
    invalidate: () => Promise.resolve(),
    navigate({ to, replace }: { to: string; replace?: boolean }) {
      if (replace === true) {
        history.replace(to)
      } else {
        history.push(to)
      }
      return Promise.resolve()
    },
  }

  function IntegrationRouteOutlet() {
    const { signOut } = useAuthFlow()

    if (
      rootTestState.pathname === '/onboarding' &&
      rootTestState.onboardingRouteComponent !== null
    ) {
      return createElement(rootTestState.onboardingRouteComponent)
    }
    if (rootTestState.pathname === '/verification') {
      return createElement(VerificationScreen, {
        onStartSdk: () => startSumsubVerification(history),
        onCompleted: () => completeVerification(history),
        onSignOut: signOut,
      })
    }
    if (rootTestState.pathname === '/verification/sumsub') {
      return createElement(SumsubVerificationScreen, {
        onExit: () => finishSumsubVerification(history),
      })
    }
    return null
  }

  return {
    ...actual,
    createFileRoute: () => (options: object) => ({ options }),
    useRouter: () => router,
    useRouterState<T>({
      select,
    }: {
      select(state: { location: { pathname: string } }): T
    }) {
      return useSyncExternalStore(
        (listener) => {
          rootTestState.routeListeners.add(listener)
          return () => rootTestState.routeListeners.delete(listener)
        },
        () => select({ location: { pathname: rootTestState.pathname } }),
      )
    },
    Outlet() {
      rootTestState.outletRenders += 1
      useEffect(
        () => () => {
          rootTestState.outletUnmounts += 1
        },
        [],
      )
      const auth = useAuthFlow()
      rootTestState.auth = auth
      return createElement(
        Fragment,
        null,
        createElement(PaymentPlansProbe),
        rootTestState.integrationFlow
          ? createElement(IntegrationRouteOutlet)
          : null,
      )
    },
  }
})

vi.mock('../shared/ui/private-page-shell', async () => {
  const { Fragment, createElement } = await import('react')
  const { useQueryClient } = await import('@tanstack/react-query')
  const { useAuthFlow } = await import('../features/auth/auth-flow-provider')
  const { usePaymentPlans } = await import(
    '../features/home/payment-plans-provider'
  )
  const { useOnboardingFlow } = await import(
    '../features/onboarding/onboarding-flow-provider'
  )
  const { useVerificationFlow } = await import(
    '../features/verification/verification-flow-provider'
  )

  function PaymentPlansProbe() {
    rootTestState.auth = useAuthFlow()
    rootTestState.paymentPlans = usePaymentPlans()
    rootTestState.queryClient = useQueryClient()
    rootTestState.onboarding = useOnboardingFlow()
    rootTestState.verification = useVerificationFlow()
    return null
  }

  return {
    PrivatePageShell({ children }: { children: ReactNode }) {
      return createElement(
        Fragment,
        null,
        createElement(PaymentPlansProbe),
        children,
      )
    },
  }
})

vi.mock('../shared/ui/app-toaster', () => ({ AppToaster: () => null }))

vi.mock('../features/home/home-session-skeleton', () => ({
  HomeSessionSkeleton() {
    rootTestState.skeletonRenders += 1
    return null
  },
}))

vi.mock('../features/home/cards-provider', async () => {
  const { Fragment, createElement } = await import('react')
  return {
    useCards: () => ({ refreshPhysical: async () => true }),
    CardsProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
      rootTestState.cardsEnabled.push(enabled)
      return createElement(Fragment, null, children)
    },
  }
})

vi.mock('../features/home/api/http-cards-gateway', () => ({
  createHttpCardsGateway: () => ({ list: () => Promise.resolve({ ok: true, data: [] }) }),
}))

vi.mock('../features/onboarding/api/http-occupation-gateway', () => ({
  createHttpOccupationGateway: () => ({
    list: () =>
      Promise.resolve({
        ok: true as const,
        data: [{ id: 11, name: 'Accountant' }],
      }),
  }),
}))

vi.mock('../features/onboarding/api/http-onboarding-gateway', () => ({
  createHttpOnboardingGateway: () => ({
    listAgreements: () =>
      Promise.resolve({
        ok: true as const,
        data: [
          {
            agreementType: 'e_sign_consent',
            agreementName: 'E-sign Consent',
            accepted: false,
            documentVersion: null,
            acceptedAt: null,
          },
        ],
      }),
    submitApplicant: (input: SubmitApplicantInput) => {
      rootTestState.applicantPosts.push(input)
      return Promise.resolve({ ok: true as const })
    },
  }),
}))

vi.mock('../features/verification/api/http-applicant-gateway', () => ({
  createHttpApplicantGateway: () => ({
    get: () => {
      rootTestState.applicantCalls += 1
      if (rootTestState.applicantResult === 'pending') {
        return new Promise((resolve) => {
          rootTestState.resolvePendingApplicant = () =>
            resolve({ ok: true as const, data: rootTestState.applicant })
        })
      }
      if (rootTestState.applicantResult === 'absent') {
        return Promise.resolve({ ok: true as const, data: null })
      }
      if (rootTestState.applicantResult === 'failure') {
        return Promise.resolve({
          ok: false as const,
          code: 'applicant-failed' as const,
          message: 'Unable to load applicant. Try again.',
        })
      }
      return Promise.resolve({ ok: true as const, data: rootTestState.applicant })
    },
  }),
}))

vi.mock('../features/verification/api/http-sumsub-token-gateway', () => ({
  createHttpSumsubTokenGateway: () => ({
    get: () => {
      rootTestState.sumsubTokenCalls += 1
      const result = {
        ok: true as const,
        data: { token: 'sumsub-token', userId: 'sumsub-user' },
      }
      if (rootTestState.sumsubTokenResult === 'pending') {
        return new Promise<typeof result>((resolve, reject) => {
          rootTestState.resolvePendingSumsubToken = () => resolve(result)
          rootTestState.rejectPendingSumsubToken = reject
        })
      }
      return Promise.resolve(result)
    },
  }),
}))

vi.mock('../features/auth/components/session-recovery', () => ({
  SessionRecovery(props: {
    message: string
    onRetry(): Promise<boolean>
    onSignOut(): void
  }) {
    rootTestState.recovery = props
    return null
  },
}))

vi.mock('../shared/api/app-env', () => ({
  appEnv: { mode: 'test', apiBaseUrl: '/api' },
}))

vi.mock('../shared/api/api-client', () => ({
  createApiClient(options: { onUnauthorized?: () => void }) {
    rootTestState.unauthorized = options.onUnauthorized ?? null
    return { request: () => Promise.resolve({}) }
  },
}))

vi.mock('../features/auth/api/browser-auth-session-store', () => ({
  browserAuthSessionStore: {
    readStatus() {
      return rootTestState.sessionStatus
    },
    requireTwoFactor(requirement: 'totp_setup_required' | 'totp_required') {
      rootTestState.sessionStatus = requirement
      rootTestState.sessionListeners.forEach((listener) => listener())
    },
    markAuthenticated() {
      rootTestState.sessionStatus = 'authenticated'
      rootTestState.sessionListeners.forEach((listener) => listener())
    },
    clear() {
      rootTestState.sessionStatus = 'anonymous'
      rootTestState.sessionListeners.forEach((listener) => listener())
    },
    subscribe(listener: () => void) {
      rootTestState.sessionListeners.add(listener)
      return () => rootTestState.sessionListeners.delete(listener)
    },
  },
}))

vi.mock('../features/auth/api/http-current-user-gateway', () => ({
  createHttpCurrentUserGateway: () => ({
    get: () => {
      if (rootTestState.currentUserResult === 'pending') {
        return new Promise((resolve) => {
          rootTestState.resolvePendingCurrentUser = () =>
            resolve({ ok: true as const, data: rootTestState.currentUser })
        })
      }
      if (rootTestState.currentUserResult === 'failure') {
        return Promise.resolve({
          ok: false as const,
          code: 'current-user-failed',
          message: 'Unable to restore session. Try again.',
        })
      }
      return Promise.resolve({
        ok: true as const,
        data: rootTestState.currentUser,
      })
    },
  }),
}))

vi.mock('../features/auth/api/http-whatsapp-auth-gateway', () => ({
  createHttpWhatsAppAuthGateway: () => ({
    requestCode: () =>
      Promise.resolve({
        ok: true as const,
        data: {
          challengeId: 'challenge-1',
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
        },
      }),
    verifyOtp: () =>
      Promise.resolve({
        ok: true as const,
        data: { isNew: true, isPrivate: true, twoFactorRequirement: null },
      }),
    signOut: () => Promise.resolve(),
  }),
}))

vi.mock('../features/home/api/mock-payment-plans-gateway', () => ({
  mockPaymentPlansGateway: {
    list() {
      rootTestState.listCalls += 1
      return Promise.resolve({ ok: true, data: [] })
    },
    start(input: StartPaymentPlanInput) {
      rootTestState.startCalls += 1
      const result = {
        ok: true,
        data: {
          ...input,
          id: `plan-${input.transactionId}`,
          aprBasisPoints: 1800,
          feeCents: 25560,
          totalRepayableCents: 309560,
          monthlyPaymentCents: 51593,
          paidInstallments: 0,
          startedAt: '2026-08-19T00:00:00.000Z',
        },
      } as const

      if (rootTestState.startCalls === 1) {
        return Promise.resolve(result)
      }

      return new Promise<typeof result>((resolve) => {
        rootTestState.resolvePendingStart = () => resolve(result)
      })
    },
    settle() {
      return Promise.resolve({ ok: true })
    },
  },
}))

import { APPLICANT_QUERY_KEY } from '../features/verification/applicant-query'
import { SUMSUB_TOKEN_QUERY_KEY } from '../features/verification/sumsub-token-query'
import { RootRoute } from './root-route'
import { Route as OnboardingFileRoute } from './routes/onboarding'

type AuthValue = ReturnType<typeof useAuthFlow>
type OnboardingValue = ReturnType<typeof useOnboardingFlow>
type PaymentPlansValue = ReturnType<typeof usePaymentPlans>
type VerificationValue = ReturnType<typeof useVerificationFlow>

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    rootTestState.routeErrors.push(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function applicant(fields: Partial<Applicant> = {}): Applicant {
  return {
    id: 41,
    sumsubId: 'sumsub-41',
    status: 'not_started',
    adminReviewStatus: 'not_required',
    rainApproved: false,
    rainStatus: 'pending',
    ...fields,
    gender: fields.gender ?? null,
  }
}

interface TestEventListener {
  listener: EventListenerOrEventListenerObject
  capture: boolean
}

const testEventListeners = new WeakMap<
  Element,
  Map<string, TestEventListener[]>
>()
const testElementChildren = new WeakMap<Element, Element[]>()
const testElementAttributes = new WeakMap<Element, Map<string, string>>()

function createTestElement(ownerDocument: object, nodeName: string): Element {
  const children: Element[] = []
  const attributes = new Map<string, string>()
  const element = {
    nodeType: 1,
    nodeName: nodeName.toUpperCase(),
    tagName: nodeName.toUpperCase(),
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument,
    style: {},
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (listener === null) return
      const listeners = testEventListeners.get(element)
      if (listeners === undefined) return
      const entries = listeners.get(type) ?? []
      entries.push({
        listener,
        capture:
          typeof options === 'boolean' ? options : options?.capture === true,
      })
      listeners.set(type, entries)
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      if (listener === null) return
      const listeners = testEventListeners.get(element)
      const entries = listeners?.get(type)
      if (entries === undefined) return
      const capture =
        typeof options === 'boolean' ? options : options?.capture === true
      listeners?.set(
        type,
        entries.filter(
          (entry) => entry.listener !== listener || entry.capture !== capture,
        ),
      )
    },
    appendChild(child: Element) {
      children.push(child)
      return child
    },
    insertBefore(child: Element) {
      children.push(child)
      return child
    },
    removeChild(child: Element) {
      children.splice(children.indexOf(child), 1)
      return child
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value)
    },
    removeAttribute(name: string) {
      attributes.delete(name)
    },
  } as unknown as Element

  testEventListeners.set(element, new Map())
  testElementChildren.set(element, children)
  testElementAttributes.set(element, attributes)
  return element
}

function createEmptyReactContainer(): Element {
  const ownerDocument = {
    nodeType: 9,
    documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
    addEventListener() {},
    removeEventListener() {},
    createElement(nodeName: string) {
      return createTestElement(ownerDocument, nodeName)
    },
    createElementNS(_namespace: string, nodeName: string) {
      return createTestElement(ownerDocument, nodeName)
    },
  }

  return createTestElement(ownerDocument, 'div')
}

function getAuth(): AuthValue {
  if (rootTestState.auth === null) throw new Error('Auth value was not captured')
  return rootTestState.auth as AuthValue
}

function getPaymentPlans(): PaymentPlansValue {
  if (rootTestState.paymentPlans === null) {
    throw new Error('Payment plans value was not captured')
  }
  return rootTestState.paymentPlans as PaymentPlansValue
}

function getOnboarding(): OnboardingValue {
  if (rootTestState.onboarding === null) {
    throw new Error('Onboarding value was not captured')
  }
  return rootTestState.onboarding as OnboardingValue
}

function getQueryClient(): QueryClient {
  if (rootTestState.queryClient === null) {
    throw new Error('Query client was not captured')
  }
  return rootTestState.queryClient
}

function getVerification(): VerificationValue {
  if (rootTestState.verification === null) {
    throw new Error('Verification value was not captured')
  }
  return rootTestState.verification as VerificationValue
}

async function prepareOnboardingRouteComponent() {
  const Component = OnboardingFileRoute.options.component
  if (Component === undefined) {
    throw new Error('Onboarding route component was not defined')
  }

  await Component.preload?.()
  rootTestState.onboardingRouteComponent = Component
}

function getRenderedElements(): Element[] {
  const container = rootTestState.reactContainer
  if (container === null) {
    throw new Error('React test container was not captured')
  }

  const rendered: Element[] = []
  const visit = (element: Element) => {
    for (const child of testElementChildren.get(element) ?? []) {
      rendered.push(child)
      visit(child)
    }
  }
  visit(container)
  return rendered
}

function getRenderedText(element: Element): string {
  return (element.textContent ?? '') +
    (testElementChildren.get(element) ?? []).map(getRenderedText).join('')
}

function findRenderedElement(nodeName: string, text?: string): Element {
  const element = getRenderedElements().find(
    (candidate) =>
      candidate.nodeName === nodeName.toUpperCase() &&
      (text === undefined || getRenderedText(candidate).includes(text)),
  )
  if (element === undefined) {
    const textDescription = text === undefined ? '' : ` "${text}"`
    throw new Error(
      `Rendered ${nodeName}${textDescription} was not found`,
    )
  }
  return element
}

function hasRenderedText(text: string): boolean {
  return getRenderedElements().some(
    (element) => element.textContent?.includes(text) === true,
  )
}

function dispatchRenderedEvent(type: 'click' | 'submit', target: Element) {
  const container = rootTestState.reactContainer
  if (container === null) {
    throw new Error('React test container was not captured')
  }
  const listeners = testEventListeners.get(container)?.get(type)
  if (listeners === undefined) {
    throw new Error(`React ${type} listener was not found`)
  }

  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    composedPath: { value: () => [target, container] },
    currentTarget: { value: container },
    srcElement: { value: target },
    target: { value: target },
  })

  for (const { listener } of [...listeners].sort(
    (left, right) => Number(right.capture) - Number(left.capture),
  )) {
    if (typeof listener === 'function') {
      listener(event)
    } else {
      listener.handleEvent(event)
    }
  }
}

function submitRenderedOnboardingStep() {
  dispatchRenderedEvent('submit', findRenderedElement('form'))
}

function clickRenderedButton(text: string) {
  dispatchRenderedEvent('click', findRenderedElement('button', text))
}

async function authenticate() {
  act(() => getAuth().setPhone('554570290'))
  await act(async () => {
    await getAuth().requestCode()
  })
  act(() => getAuth().setCode('1'))
  await act(async () => {
    await getAuth().verifyCode()
  })
}

async function waitForSessionStatus(status: AuthValue['session']['status']) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (getAuth().session.status === status) return

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    })
  }

  throw new Error(`Session did not reach ${status}`)
}

async function waitForApplicant(expected: Applicant | null) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (getVerification().applicant === expected) return
    await flushRouteUpdates()
  }

  throw new Error('Applicant did not reach the expected state')
}

async function flushRouteUpdates() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

function prepareRouteGateTest({
  pathname,
  sessionStatus,
  currentUserResult,
  applicantResult = 'success',
  sumsubTokenResult = 'success',
  applicant = {
    id: 41,
    gender: null,
    sumsubId: 'sumsub-41',
    status: 'not_started',
    adminReviewStatus: 'not_required',
    rainApproved: false,
    rainStatus: 'pending',
  },
}: {
  pathname: string
  sessionStatus: AuthSessionStatus
  currentUserResult: 'success' | 'failure' | 'pending'
  applicantResult?: 'success' | 'absent' | 'failure' | 'pending'
  sumsubTokenResult?: 'success' | 'pending'
  applicant?: Applicant
}) {
  rootTestState.unauthorized?.()
  rootTestState.sessionListeners.clear()
  rootTestState.auth = null
  rootTestState.onboarding = null
  rootTestState.verification = null
  rootTestState.queryClient = null
  rootTestState.paymentPlans = null
  rootTestState.pathname = pathname
  rootTestState.pushes = []
  rootTestState.sessionStatus = sessionStatus
  rootTestState.currentUserResult = currentUserResult
  rootTestState.resolvePendingCurrentUser = null
  rootTestState.replacements = []
  rootTestState.routeListeners.clear()
  rootTestState.integrationFlow = false
  rootTestState.onboardingRouteComponent = null
  rootTestState.reactContainer = null
  rootTestState.outletRenders = 0
  rootTestState.outletUnmounts = 0
  rootTestState.skeletonRenders = 0
  rootTestState.cardsEnabled = []
  rootTestState.recovery = null
  rootTestState.listCalls = 0
  rootTestState.applicant = applicant
  rootTestState.applicantResult = applicantResult
  rootTestState.applicantCalls = 0
  rootTestState.applicantPosts = []
  rootTestState.resolvePendingApplicant = null
  rootTestState.sumsubTokenResult = sumsubTokenResult
  rootTestState.sumsubTokenCalls = 0
  rootTestState.resolvePendingSumsubToken = null
  rootTestState.rejectPendingSumsubToken = null
  rootTestState.sumsubSdkProps = null
  rootTestState.routeErrors = []
  rootTestState.sessionStorage = new Map()
}

async function mountRootRoute(): Promise<() => void> {
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { event?: Event; HTMLIFrameElement: new () => object }
    document?: {
      visibilityState: DocumentVisibilityState
      addEventListener(): void
      removeEventListener(): void
    }
    sessionStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  browserGlobal.document = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
  }
  browserGlobal.sessionStorage = {
    getItem(key) {
      return rootTestState.sessionStorage.get(key) ?? null
    },
    setItem(key, value) {
      rootTestState.sessionStorage.set(key, value)
    },
    removeItem(key) {
      rootTestState.sessionStorage.delete(key)
    },
  }
  const container = createEmptyReactContainer()
  rootTestState.reactContainer = container
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <RouteErrorBoundary>
        <RootRoute />
      </RouteErrorBoundary>,
    )
  })

  return () => {
    act(() => root.unmount())
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
    delete browserGlobal.window
    delete browserGlobal.document
    delete browserGlobal.sessionStorage
  }
}

test('loads a fresh payment-plan session only while authenticated', async () => {
  rootTestState.auth = null
  rootTestState.paymentPlans = null
  rootTestState.listCalls = 0
  rootTestState.startCalls = 0
  rootTestState.resolvePendingStart = null
  rootTestState.sessionStatus = 'anonymous'
  rootTestState.sessionListeners.clear()
  rootTestState.currentUserResult = 'success'
  rootTestState.pathname = '/'
  rootTestState.replacements = []

  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { event?: Event; HTMLIFrameElement: new () => object }
    document?: {
      addEventListener(): void
      removeEventListener(): void
    }
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  browserGlobal.document = {
    addEventListener() {},
    removeEventListener() {},
  }
  let root = createRoot(createEmptyReactContainer())

  try {
    await act(async () => {
      root.render(<RootRoute />)
    })

    expect(rootTestState.listCalls).toBe(0)
    expect(getPaymentPlans().state.plans).toEqual([])

    await authenticate()

    expect(rootTestState.sessionStatus).toBe('authenticated')
    expect(rootTestState.listCalls).toBe(1)
    expect(getPaymentPlans().state.plans).toEqual([])

    await act(async () => {
      await getPaymentPlans().startPlan({
        transactionId: 'emirates',
        merchant: 'Emirates Airlines',
        currency: 'USD',
        principalCents: 284000,
        termMonths: 6,
      })
    })
    expect(getPaymentPlans().state.plans).toHaveLength(1)

    const staleRequest = getPaymentPlans().startPlan({
      transactionId: 'hotel',
      merchant: 'The Ned',
      currency: 'USD',
      principalCents: 284000,
      termMonths: 6,
    })

    await act(async () => {
      await getAuth().signOut()
    })
    expect(rootTestState.sessionStatus).toBe('anonymous')
    expect(getPaymentPlans().state.plans).toEqual([])

    await authenticate()

    expect(rootTestState.sessionStatus).toBe('authenticated')
    expect(rootTestState.listCalls).toBe(2)
    expect(getPaymentPlans().state.plans).toEqual([])

    if (rootTestState.resolvePendingStart === null) {
      throw new Error('Pending start was not captured')
    }
    const resolvePendingStart = rootTestState.resolvePendingStart as () => void
    resolvePendingStart()
    await act(async () => {
      await staleRequest
    })
    expect(getPaymentPlans().state.plans).toEqual([])

    act(() => root.unmount())
    rootTestState.auth = null
    rootTestState.paymentPlans = null
    root = createRoot(createEmptyReactContainer())

    await act(async () => {
      root.render(<RootRoute />)
    })

    expect(getAuth().session.status).toBe('authenticated')
    expect(rootTestState.listCalls).toBe(3)
  } finally {
    act(() => root.unmount())
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
    delete browserGlobal.window
    delete browserGlobal.document
  }
})

test('clears prior current-user data before a new session restores', async () => {
  rootTestState.auth = null
  rootTestState.paymentPlans = null
  rootTestState.sessionListeners.clear()
  rootTestState.currentUserResult = 'success'
  rootTestState.pathname = '/home'
  rootTestState.replacements = []
  if (rootTestState.unauthorized === null) {
    throw new Error('Unauthorized callback was not captured')
  }
  rootTestState.unauthorized()
  rootTestState.currentUser = {
    id: 1,
    username: 'yury',
    email: 'yury@example.com',
    avatar: null,
  }

  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { event?: Event; HTMLIFrameElement: new () => object }
    document?: {
      addEventListener(): void
      removeEventListener(): void
    }
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  browserGlobal.document = {
    addEventListener() {},
    removeEventListener() {},
  }
  const root = createRoot(createEmptyReactContainer())

  try {
    await act(async () => {
      root.render(<RootRoute />)
    })
    await authenticate()
    expect(getAuth().session).toEqual({
      status: 'authenticated',
      user: rootTestState.currentUser,
      error: null,
    })

    act(() => {
      rootTestState.unauthorized!()
    })
    expect(rootTestState.sessionStatus).toBe('anonymous')
    expect(getAuth().session).toEqual({
      status: 'anonymous',
      user: null,
      error: null,
    })

    rootTestState.currentUser = {
      id: 2,
      username: 'new-user',
      email: 'new@example.com',
      avatar: null,
    }
    act(() => {
      rootTestState.sessionStatus = 'authenticated'
      rootTestState.sessionListeners.forEach((listener) => listener())
    })

    expect(getAuth().session).toEqual({
      status: 'checking',
      user: null,
      error: null,
    })
    await waitForSessionStatus('authenticated')
    expect(getAuth().session).toEqual({
      status: 'authenticated',
      user: rootTestState.currentUser,
      error: null,
    })
  } finally {
    act(() => root.unmount())
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
    delete browserGlobal.window
    delete browserGlobal.document
  }
})

test('loads cards on a direct transactions route only after the session authenticates', async () => {
  prepareRouteGateTest({
    pathname: '/transactions',
    sessionStatus: 'authenticated',
    currentUserResult: 'success',
    applicant: applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
  })
  const cleanup = await mountRootRoute()

  try {
    await waitForSessionStatus('authenticated')
    await flushRouteUpdates()
    expect(getAuth().session.status).toBe('authenticated')
    expect(rootTestState.cardsEnabled).toContain(true)
    expect(rootTestState.outletRenders).toBeGreaterThan(0)
  } finally {
    cleanup()
  }
})

test('keeps the auth outlet mounted after OTP applicant resolution until explicit handoff', async () => {
  prepareRouteGateTest({
    pathname: '/',
    sessionStatus: 'anonymous',
    currentUserResult: 'success',
    applicantResult: 'pending',
  })
  const cleanup = await mountRootRoute()

  try {
    act(() => getAuth().setPhone('554570290'))
    await act(async () => {
      await getAuth().requestCode()
    })
    act(() => getAuth().setCode('123456'))
    rootTestState.currentUserResult = 'pending'
    rootTestState.outletRenders = 0
    let verification: Promise<boolean> | undefined

    await act(async () => {
      verification = getAuth().verifyCode()
      await Promise.resolve()
      await Promise.resolve()
    })

    const pendingState = getAuth().state
    const pendingSession = getAuth().session
    const outletRendersWhileChecking = rootTestState.outletRenders
    const outletUnmountsWhileChecking = rootTestState.outletUnmounts
    const skeletonRendersWhileChecking = rootTestState.skeletonRenders
    const replacementsWhileChecking = [...rootTestState.replacements]

    if (rootTestState.resolvePendingCurrentUser === null || verification === undefined) {
      throw new Error('Pending current-user verification was not captured')
    }
    rootTestState.resolvePendingCurrentUser()
    await waitForSessionStatus('authenticated')

    const sessionAfterCurrentUser = getAuth().session
    const submissionWhileApplicantLoads = getAuth().state.submission
    const outletRendersWhileApplicantLoads = rootTestState.outletRenders
    const outletUnmountsWhileApplicantLoads = rootTestState.outletUnmounts
    const replacementsWhileApplicantLoads = [...rootTestState.replacements]

    if (rootTestState.resolvePendingApplicant === null) {
      throw new Error('Pending applicant lookup was not captured')
    }
    rootTestState.resolvePendingApplicant()
    await act(async () => {
      await verification
    })
    for (
      let attempt = 0;
      attempt < 10 && rootTestState.replacements.length === 0;
      attempt += 1
    ) {
      await flushRouteUpdates()
    }

    const replacementsAfterApplicant = [...rootTestState.replacements]
    const outletUnmountsAfterApplicant = rootTestState.outletUnmounts

    expect(pendingState).toMatchObject({
      submission: 'pending',
      submissionKind: 'verify-code',
    })
    expect(pendingSession.status).toBe('checking')
    expect(outletRendersWhileChecking).toBeGreaterThan(0)
    expect(outletUnmountsWhileChecking).toBe(0)
    expect(skeletonRendersWhileChecking).toBe(0)
    expect(replacementsWhileChecking).toEqual([])
    expect(sessionAfterCurrentUser.status).toBe('authenticated')
    expect(submissionWhileApplicantLoads).toBe('pending')
    expect(outletRendersWhileApplicantLoads).toBeGreaterThan(
      outletRendersWhileChecking,
    )
    expect(outletUnmountsWhileApplicantLoads).toBe(0)
    expect(replacementsWhileApplicantLoads).toEqual([])
    expect(replacementsAfterApplicant).toEqual(['/verification'])
    expect(outletUnmountsAfterApplicant).toBe(0)
    expect(rootTestState.pathname).toBe('/verification')
  } finally {
    cleanup()
  }
})

test('keeps the onboarding outlet mounted while a background applicant refresh updates cache', async () => {
  prepareRouteGateTest({
    pathname: '/onboarding',
    sessionStatus: 'authenticated',
    currentUserResult: 'success',
    applicantResult: 'absent',
  })
  const cleanup = await mountRootRoute()

  try {
    await waitForSessionStatus('authenticated')
    await flushRouteUpdates()
    const unmountsBeforeRefresh = rootTestState.outletUnmounts

    rootTestState.applicantResult = 'pending'
    let refresh: Promise<Applicant | null> | undefined
    act(() => {
      refresh = getVerification().invalidateApplicant()
    })
    await flushRouteUpdates()

    expect(rootTestState.applicantCalls).toBe(2)
    expect(rootTestState.outletUnmounts).toBe(unmountsBeforeRefresh)

    if (rootTestState.resolvePendingApplicant === null || refresh === undefined) {
      throw new Error('Pending applicant refresh was not captured')
    }
    rootTestState.resolvePendingApplicant()
    await act(async () => {
      await refresh
    })
    await flushRouteUpdates()

    expect(rootTestState.replacements).toEqual([])
    expect(rootTestState.pathname).toBe('/onboarding')
    expect(getVerification().applicant).toEqual(applicant())
  } finally {
    cleanup()
  }
})

test('keeps Account pending until Rain approves, then opens Home immediately', async () => {
  prepareRouteGateTest({
    pathname: '/verification',
    sessionStatus: 'authenticated',
    currentUserResult: 'success',
    applicant: applicant({ status: 'pending' }),
  })
  rootTestState.integrationFlow = true
  const cleanup = await mountRootRoute()
  let fakeTimersEnabled = false

  try {
    await waitForSessionStatus('authenticated')
    await flushRouteUpdates()
    expect(hasRenderedText('Checking your identity')).toBe(true)

    vi.useFakeTimers()
    fakeTimersEnabled = true
    rootTestState.applicant = applicant({
      status: 'approved',
      adminReviewStatus: 'pending',
    })
    await act(async () => {
      await getVerification().refetchApplicant()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(rootTestState.pathname).toBe('/verification')
    expect(hasRenderedText('Account pending')).toBe(true)

    rootTestState.applicant = applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainStatus: 'pending',
    })
    await act(async () => {
      await getVerification().refetchApplicant()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(rootTestState.pathname).toBe('/verification')
    expect(hasRenderedText('Account pending')).toBe(true)

    rootTestState.applicant = applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    })
    await act(async () => {
      await getVerification().refetchApplicant()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(rootTestState.pathname).toBe('/home')
    expect(rootTestState.replacements.at(-1)).toBe('/home')
  } finally {
    cleanup()
    if (fakeTimersEnabled) vi.useRealTimers()
  }
})

test('keeps the real applicant flow coherent through Rain-approved Home completion', async () => {
  prepareRouteGateTest({
    pathname: '/onboarding',
    sessionStatus: 'authenticated',
    currentUserResult: 'success',
    applicantResult: 'absent',
  })
  rootTestState.integrationFlow = true
  await prepareOnboardingRouteComponent()
  const cleanup = await mountRootRoute()
  let fakeTimersEnabled = false

  try {
    await waitForSessionStatus('authenticated')
    await flushRouteUpdates()

    expect(rootTestState.applicantCalls).toBe(1)
    expect(rootTestState.pathname).toBe('/onboarding')
    expect(rootTestState.applicantPosts).toHaveLength(0)

    act(() => getOnboarding().setResidency('united-states'))
    await act(async () => {
      await getOnboarding().continueStep()
    })
    expect(rootTestState.applicantPosts).toHaveLength(0)

    act(() =>
      getOnboarding().setOccupation({ id: 11, name: 'Accountant' }),
    )
    await act(async () => {
      await getOnboarding().continueStep()
    })
    expect(rootTestState.applicantPosts).toHaveLength(0)

    act(() => getOnboarding().setYearlyIncome('USD 50,000 – 100,000'))
    await act(async () => {
      await getOnboarding().continueStep()
    })
    expect(rootTestState.applicantPosts).toHaveLength(0)

    act(() => getOnboarding().setMonthlySpend('USD 1,000 – 5,000'))
    await act(async () => {
      await getOnboarding().continueStep()
    })
    expect(rootTestState.applicantPosts).toHaveLength(0)

    act(() => getOnboarding().setAccountPurpose('Personal spending'))
    await act(async () => {
      await getOnboarding().continueStep()
    })
    expect(rootTestState.applicantPosts).toHaveLength(0)

    rootTestState.applicantResult = 'success'
    rootTestState.applicant = applicant()
    act(() => getOnboarding().acceptAgreements())
    act(() => submitRenderedOnboardingStep())
    await flushRouteUpdates()
    expect(rootTestState.applicantPosts).toEqual([
      {
        occupation: { id: 11, name: 'Accountant' },
        yearlyIncome: 'USD 50,000 – 100,000',
        monthlySpend: 'USD 1,000 – 5,000',
        accountPurpose: 'Personal spending',
      },
    ])

    expect(rootTestState.applicantCalls).toBe(2)
    await waitForApplicant(rootTestState.applicant)
    expect(getVerification().applicant).toEqual(applicant())
    expect(rootTestState.pathname).toBe('/verification')

    await flushRouteUpdates()
    expect(rootTestState.sumsubTokenCalls).toBe(0)
    act(() => clickRenderedButton('Continue verification'))
    await flushRouteUpdates()

    expect(rootTestState.sumsubTokenCalls).toBe(1)
    expect(rootTestState.pushes).toEqual(['/verification/sumsub'])
    expect(rootTestState.pathname).toBe('/verification/sumsub')
    if (rootTestState.sumsubSdkProps === null) {
      throw new Error('Sumsub SDK props were not captured')
    }
    const sumsubSdkProps = rootTestState.sumsubSdkProps
    expect(sumsubSdkProps.accessToken).toBe('sumsub-token')

    vi.useFakeTimers()
    fakeTimersEnabled = true
    act(() => sumsubSdkProps.onMessage('idCheck.onApplicantSubmitted'))
    await act(async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await Promise.resolve()
      }
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(rootTestState.sessionStorage.get('xplace.verification.submitted')).toBe(
      'true',
    )
    expect(rootTestState.replacements.at(-1)).toBe('/verification')
    expect(rootTestState.pathname).toBe('/verification')
    expect(getVerification().applicant).toEqual(applicant())
    expect(hasRenderedText('Checking your identity')).toBe(true)
    expect(hasRenderedText('Account pending')).toBe(false)

    rootTestState.applicant = applicant({
      status: 'approved',
      adminReviewStatus: 'pending',
    })
    await act(async () => {
      await getVerification().refetchApplicant()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(getVerification().applicant).toEqual(
      applicant({ status: 'approved', adminReviewStatus: 'pending' }),
    )
    expect(hasRenderedText('Checking your identity')).toBe(false)
    expect(hasRenderedText('Account pending')).toBe(true)
    expect(rootTestState.sessionStorage.has('xplace.verification.submitted')).toBe(
      false,
    )

    rootTestState.applicant = applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainStatus: 'pending',
    })
    await act(async () => {
      await getVerification().refetchApplicant()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(getVerification().applicant).toEqual(
      applicant({
        status: 'approved',
        adminReviewStatus: 'approved',
        rainStatus: 'pending',
      }),
    )
    expect(hasRenderedText('Account pending')).toBe(true)
    expect(rootTestState.pathname).toBe('/verification')
    expect(rootTestState.replacements).not.toContain('/home')

    rootTestState.applicant = applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    })
    await act(async () => {
      await getVerification().refetchApplicant()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(rootTestState.pathname).toBe('/home')
    expect(rootTestState.replacements.at(-1)).toBe('/home')
  } finally {
    cleanup()
    if (fakeTimersEnabled) vi.useRealTimers()
  }
})

test.each([
  ['absent applicant', 'absent', applicant()],
  ['missing Sumsub identifier', 'success', applicant({ sumsubId: null })],
] as const)(
  'retries %s detail without creating the applicant again',
  async (_case, applicantResult, initialApplicant) => {
    prepareRouteGateTest({
      pathname: '/onboarding',
      sessionStatus: 'authenticated',
      currentUserResult: 'success',
      applicantResult,
      applicant: initialApplicant,
    })
    rootTestState.integrationFlow = true
    await prepareOnboardingRouteComponent()
    const cleanup = await mountRootRoute()

    try {
      await waitForSessionStatus('authenticated')
      await flushRouteUpdates()

      act(() => getOnboarding().setResidency('united-states'))
      await act(async () => getOnboarding().continueStep())
      act(() =>
        getOnboarding().setOccupation({ id: 11, name: 'Accountant' }),
      )
      await act(async () => getOnboarding().continueStep())
      act(() => getOnboarding().setYearlyIncome('USD 50,000 – 100,000'))
      await act(async () => getOnboarding().continueStep())
      act(() => getOnboarding().setMonthlySpend('USD 1,000 – 5,000'))
      await act(async () => getOnboarding().continueStep())
      act(() => getOnboarding().setAccountPurpose('Personal spending'))
      await act(async () => getOnboarding().continueStep())
      act(() => getOnboarding().acceptAgreements())

      act(() => submitRenderedOnboardingStep())
      await flushRouteUpdates()
      await flushRouteUpdates()

      expect(rootTestState.applicantPosts).toHaveLength(1)
      expect(rootTestState.applicantCalls).toBe(2)
      expect(rootTestState.pathname).toBe('/onboarding')
      expect(
        hasRenderedText('Something went wrong. Please try again.'),
      ).toBe(true)

      rootTestState.applicantResult = 'success'
      rootTestState.applicant = applicant()
      act(() => submitRenderedOnboardingStep())
      await flushRouteUpdates()
      await flushRouteUpdates()

      expect(rootTestState.applicantPosts).toHaveLength(1)
      expect(rootTestState.applicantCalls).toBe(3)
      expect(rootTestState.pathname).toBe('/verification')
    } finally {
      cleanup()
    }
  },
)

test('surfaces an applicant failure without replacing to onboarding', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  prepareRouteGateTest({
    pathname: '/home',
    sessionStatus: 'authenticated',
    currentUserResult: 'success',
    applicantResult: 'failure',
  })
  const cleanup = await mountRootRoute()

  try {
    await waitForSessionStatus('authenticated')
    await flushRouteUpdates()
    expect(rootTestState.routeErrors).toHaveLength(1)
    expect(rootTestState.routeErrors[0]?.message).toBe(
      'Unable to load applicant. Try again.',
    )
    expect(rootTestState.replacements).toEqual([])
  } finally {
    consoleError.mockRestore()
    cleanup()
  }
})

test.each(['manual logout', 'unauthorized response'] as const)(
  '%s prevents pending verification state from crossing into the next identity',
  async (cleanupKind) => {
    prepareRouteGateTest({
      pathname: '/verification',
      sessionStatus: 'authenticated',
      currentUserResult: 'success',
      sumsubTokenResult: 'pending',
    })
    rootTestState.currentUser = {
      id: 101,
      username: 'first-user',
      email: 'first@example.com',
      avatar: null,
    }
    rootTestState.sessionStorage.set('xplace.verification.attempt-error', 'true')
    rootTestState.sessionStorage.set('unrelated', 'keep-me')
    const cleanup = await mountRootRoute()

    try {
      await waitForSessionStatus('authenticated')
      await flushRouteUpdates()
      const queryClient = getQueryClient()
      act(() => getVerification().markSubmitted())
      const staleRefresh = getVerification().refreshToken().catch(() => undefined)
      queryClient.setQueryData(APPLICANT_QUERY_KEY, applicant())
      queryClient.setQueryData(SUMSUB_TOKEN_QUERY_KEY, {
        token: 'cached-token',
        userId: 'cached-user',
      })
      if (rootTestState.resolvePendingSumsubToken === null) {
        throw new Error('Pending Sumsub refresh was not captured')
      }
      const resolvePendingSumsubToken = rootTestState.resolvePendingSumsubToken

      if (cleanupKind === 'manual logout') {
        await act(async () => {
          await getAuth().signOut()
        })
      } else {
        act(() => {
        if (rootTestState.unauthorized === null) {
          throw new Error('Unauthorized callback was not captured')
        }
        rootTestState.unauthorized()
        })
      }

      expect(queryClient.getQueryData(APPLICANT_QUERY_KEY)).toBeUndefined()
      expect(queryClient.getQueryData(SUMSUB_TOKEN_QUERY_KEY)).toBeUndefined()
      expect(rootTestState.sessionStorage).toEqual(
        new Map([['unrelated', 'keep-me']]),
      )

      rootTestState.currentUser = {
        id: 202,
        username: 'next-user',
        email: 'next@example.com',
        avatar: null,
      }
      await authenticate()
      await waitForSessionStatus('authenticated')
      await flushRouteUpdates()
      expect(getAuth().session.user?.id).toBe(202)

      resolvePendingSumsubToken()
      await act(async () => {
        await staleRefresh
      })

      expect(queryClient.getQueryData(SUMSUB_TOKEN_QUERY_KEY)).toBeUndefined()
      expect(getVerification().submitted).toBe(false)
      expect(rootTestState.sessionStorage).toEqual(
        new Map([['unrelated', 'keep-me']]),
      )
    } finally {
      cleanup()
    }
  },
)

test.each(['manual logout', 'unauthorized response'] as const)(
  '%s prevents a late SDK refresh rejection from changing the next identity',
  async (cleanupKind) => {
    prepareRouteGateTest({
      pathname: '/verification',
      sessionStatus: 'authenticated',
      currentUserResult: 'success',
    })
    rootTestState.currentUser = {
      id: 101,
      username: 'first-user',
      email: 'first@example.com',
      avatar: null,
    }
    rootTestState.integrationFlow = true
    const cleanup = await mountRootRoute()

    try {
      await waitForSessionStatus('authenticated')
      await flushRouteUpdates()
      expect(rootTestState.sumsubTokenCalls).toBe(0)
      act(() => clickRenderedButton('Continue verification'))
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (rootTestState.sumsubSdkProps !== null) break
        await flushRouteUpdates()
      }
      const sdk = rootTestState.sumsubSdkProps
      if (sdk === null) throw new Error('Sumsub SDK props were not captured')

      rootTestState.sumsubTokenResult = 'pending'
      const staleRefresh = sdk.expirationHandler().then(
        () => new Error('Expected the stale refresh to reject'),
        (error: unknown) => error,
      )
      if (rootTestState.rejectPendingSumsubToken === null) {
        throw new Error('Pending Sumsub refresh rejection was not captured')
      }
      const rejectPendingSumsubToken = rootTestState.rejectPendingSumsubToken

      if (cleanupKind === 'manual logout') {
        await act(async () => {
          await getAuth().signOut()
        })
      } else {
        act(() => {
          if (rootTestState.unauthorized === null) {
            throw new Error('Unauthorized callback was not captured')
          }
          rootTestState.unauthorized()
        })
      }
      act(() => {
        rootTestState.pathname = '/'
        rootTestState.routeListeners.forEach((listener) => listener())
      })
      await flushRouteUpdates()

      const queryClient = getQueryClient()
      rootTestState.currentUser = {
        id: 202,
        username: 'next-user',
        email: 'next@example.com',
        avatar: null,
      }
      rootTestState.sumsubTokenResult = 'success'
      await authenticate()
      await waitForSessionStatus('authenticated')
      await flushRouteUpdates()
      queryClient.setQueryData(SUMSUB_TOKEN_QUERY_KEY, {
        token: 'next-identity-token',
        userId: 'next-user',
      })
      const replacementsBeforeLateRejection = [...rootTestState.replacements]

      rejectPendingSumsubToken(new Error('Sensitive provider failure'))
      const refreshError = await staleRefresh
      await flushRouteUpdates()

      expect(refreshError).toEqual(
        new Error('Something went wrong. Please try again.'),
      )
      expect(queryClient.getQueryData(SUMSUB_TOKEN_QUERY_KEY)).toEqual({
        token: 'next-identity-token',
        userId: 'next-user',
      })
      expect(rootTestState.sessionStorage.has('xplace.verification.attempt-error')).toBe(
        false,
      )
      expect(rootTestState.replacements).toEqual(replacementsBeforeLateRejection)
    } finally {
      cleanup()
    }
  },
)

test('renders the protected outlet for an authenticated Home session', async () => {
  prepareRouteGateTest({
    pathname: '/home',
    sessionStatus: 'authenticated',
    currentUserResult: 'success',
    applicant: applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
  })
  const cleanup = await mountRootRoute()

  try {
    await waitForSessionStatus('authenticated')
    await flushRouteUpdates()
    expect(rootTestState.outletRenders).toBeGreaterThan(0)
    expect(rootTestState.replacements).toEqual([])
    expect(rootTestState.listCalls).toBe(1)
  } finally {
    cleanup()
  }
})

test('renders session recovery controls in place without redirecting', async () => {
  prepareRouteGateTest({
    pathname: '/home',
    sessionStatus: 'authenticated',
    currentUserResult: 'failure',
  })
  const cleanup = await mountRootRoute()

  try {
    await waitForSessionStatus('recovery-error')
    expect(rootTestState.recovery?.message).toBe(
      'Unable to restore session. Try again.',
    )
    expect(rootTestState.replacements).toEqual([])
    expect(rootTestState.listCalls).toBe(0)
  } finally {
    cleanup()
  }
})
