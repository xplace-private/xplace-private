import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

import type { AuthGateway } from './api/auth-gateway'
import type {
  AuthSessionStatus,
  AuthSessionStore,
} from './api/browser-auth-session-store'
import type { CurrentUser, CurrentUserGateway } from './api/current-user-gateway'
import { AuthFlowProvider, useAuthFlow } from './auth-flow-provider'
import { CURRENT_USER_QUERY_KEY } from './current-user-query'

const authTestState = vi.hoisted(() => ({ signOutError: vi.fn() }))

vi.mock('sonner', () => ({
  toast: { error: authTestState.signOutError },
}))

type AuthValue = ReturnType<typeof useAuthFlow>

const currentUser: CurrentUser = {
  id: 42,
  username: 'yury',
  email: null,
  avatar: null,
}

let auth: AuthValue | null = null
let root: Root | null = null
let queryClient: QueryClient | null = null

function AuthProbe() {
  const value = useAuthFlow()
  useEffect(() => {
    auth = value
  }, [value])
  return null
}

function getAuth() {
  if (auth === null) throw new Error('Auth value was not captured')
  return auth
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

function createSessionStore(
  initialStatus: AuthSessionStatus,
): AuthSessionStore {
  let status = initialStatus
  const listeners = new Set<() => void>()
  const publish = (nextStatus: AuthSessionStatus) => {
    status = nextStatus
    listeners.forEach((listener) => listener())
  }
  return {
    readStatus: () => status,
    markAuthenticated: () => publish('authenticated'),
    requireTwoFactor: publish,
    clear: () => publish('anonymous'),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function createAuthGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    requestCode: () =>
      Promise.resolve({
        ok: true,
        data: {
          challengeId: 'challenge-1',
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
        },
      }),
    verifyOtp: () =>
      Promise.resolve({
        ok: true,
        data: { isNew: true, isPrivate: true, twoFactorRequirement: null },
      }),
    signOut: () => Promise.resolve(),
    ...overrides,
  }
}

function createCurrentUserGateway(
  get: CurrentUserGateway['get'] = () =>
    Promise.resolve({ ok: true, data: currentUser }),
): CurrentUserGateway {
  return { get }
}

function mountProvider({
  gateway = createAuthGateway(),
  currentUserGateway = createCurrentUserGateway(),
  sessionStore = createSessionStore('anonymous'),
  onSessionReady = () => Promise.resolve(),
}: {
  gateway?: AuthGateway
  currentUserGateway?: CurrentUserGateway
  sessionStore?: AuthSessionStore
  onSessionReady?: () => Promise<void>
} = {}) {
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { event?: Event; HTMLIFrameElement: new () => object }
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  root = createRoot(createEmptyReactContainer())

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <AuthFlowProvider
          gateway={gateway}
          currentUserGateway={currentUserGateway}
          sessionStore={sessionStore}
          onSessionReady={onSessionReady}
        >
          <AuthProbe />
        </AuthFlowProvider>
      </QueryClientProvider>,
    )
  })

  return { sessionStore }
}

async function waitForSessionStatus(status: AuthValue['session']['status']) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (getAuth().session.status === status) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }

  throw new Error(`Session did not reach ${status}`)
}

async function moveToCodeStep() {
  act(() => getAuth().setPhone('2133734253'))
  await act(async () => {
    await getAuth().requestCode()
  })
  act(() => getAuth().setCode('123456'))
}

afterEach(async () => {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  if (root !== null) act(() => root?.unmount())
  queryClient?.clear()
  auth = null
  root = null
  queryClient = null
  authTestState.signOutError.mockClear()
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as { window?: unknown }
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
  delete browserGlobal.window
})

test('checks an unknown cookie session through the current-user query', async () => {
  const get = vi.fn(() => Promise.resolve({ ok: true as const, data: currentUser }))
  mountProvider({
    currentUserGateway: createCurrentUserGateway(get),
    sessionStore: createSessionStore('unknown'),
  })

  expect(getAuth().session.status).toBe('checking')
  await waitForSessionStatus('authenticated')
  expect(getAuth().session).toEqual({
    status: 'authenticated',
    user: currentUser,
    error: null,
  })
  expect(get).toHaveBeenCalledOnce()
})

test('keeps an anonymous cookie session from loading the current user', () => {
  const get = vi.fn(() => Promise.resolve({ ok: true as const, data: currentUser }))
  mountProvider({ currentUserGateway: createCurrentUserGateway(get) })

  expect(getAuth().session.status).toBe('anonymous')
  expect(get).not.toHaveBeenCalled()
})

test('stores the WhatsApp challenge returned for the phone number', async () => {
  const requestCode = vi.fn(createAuthGateway().requestCode)
  mountProvider({ gateway: createAuthGateway({ requestCode }) })
  act(() => getAuth().setPhone('2133734253'))

  await act(async () => {
    await expect(getAuth().requestCode()).resolves.toBe(true)
  })

  expect(requestCode).toHaveBeenCalledWith({ phone: '+12133734253' })
  expect(getAuth().state).toMatchObject({
    step: 'code',
    challengeId: 'challenge-1',
    resendSeconds: 60,
  })
})

test('requests a WhatsApp challenge with the selected country code', async () => {
  const requestCode = vi.fn(createAuthGateway().requestCode)
  mountProvider({ gateway: createAuthGateway({ requestCode }) })
  act(() => {
    getAuth().setCountry({
      code: 'GB',
      flag: '🇬🇧',
      name: 'United Kingdom',
      phoneCode: '+44',
    })
    getAuth().setPhone('+44 20 7183 8750')
  })

  await act(async () => {
    await getAuth().requestCode()
  })

  expect(requestCode).toHaveBeenCalledWith({ phone: '+442071838750' })
})

test('adopts the cookie session before resolving the current user and route', async () => {
  const events: string[] = []
  const sessionStore = createSessionStore('anonymous')
  const markAuthenticated = sessionStore.markAuthenticated
  sessionStore.markAuthenticated = () => {
    events.push('session-adopted')
    markAuthenticated()
  }
  mountProvider({
    sessionStore,
    currentUserGateway: createCurrentUserGateway(async () => {
      events.push('current-user-resolved')
      return { ok: true, data: currentUser }
    }),
    onSessionReady: async () => {
      events.push('route-resolved')
    },
  })
  await moveToCodeStep()

  await act(async () => {
    await expect(getAuth().verifyCode()).resolves.toBe(true)
  })

  expect(events).toEqual([
    'session-adopted',
    'current-user-resolved',
    'route-resolved',
  ])
  expect(getAuth().session.status).toBe('authenticated')
})

test('verifies with the backend challenge instead of a user id', async () => {
  const verifyOtp = vi.fn(createAuthGateway().verifyOtp)
  mountProvider({ gateway: createAuthGateway({ verifyOtp }) })
  await moveToCodeStep()

  await act(async () => {
    await getAuth().verifyCode()
  })

  expect(verifyOtp).toHaveBeenCalledWith({
    challengeId: 'challenge-1',
    code: '123456',
  })
})

test.each(['totp_setup_required', 'totp_required'] as const)('goes directly to %s after registration or sign-in without loading account data', async (requirement) => {
  const get = vi.fn(async () => ({ ok: true as const, data: currentUser }))
  const onSessionReady = vi.fn(async () => undefined)
  const sessionStore = createSessionStore('anonymous')
  mountProvider({
    sessionStore, currentUserGateway: createCurrentUserGateway(get), onSessionReady,
    gateway: createAuthGateway({ verifyOtp: async () => ({ ok: true, data: { isNew: requirement === 'totp_setup_required', isPrivate: true, twoFactorRequirement: requirement } }) }),
  })
  await moveToCodeStep()
  await act(async () => { await expect(getAuth().verifyCode()).resolves.toBe(true) })

  expect(getAuth().session).toEqual({ status: 'two-factor-required', requirement, user: null, error: null })
  expect(get).not.toHaveBeenCalled()
  expect(onSessionReady).toHaveBeenCalledOnce()
})

test('resumes normal session routing after a confirmed authenticator code', async () => {
  const sessionStore = createSessionStore('totp_setup_required')
  const get = vi.fn(async () => ({ ok: true as const, data: currentUser }))
  const onSessionReady = vi.fn(async () => undefined)
  mountProvider({ sessionStore, currentUserGateway: createCurrentUserGateway(get), onSessionReady })
  expect(get).not.toHaveBeenCalled()

  await act(async () => { await getAuth().completeTwoFactor() })
  await waitForSessionStatus('authenticated')
  expect(getAuth().session.user).toEqual(currentUser)
  expect(sessionStore.readStatus()).toBe('authenticated')
  expect(onSessionReady).toHaveBeenCalledOnce()
})

test('replaces the challenge when a code is resent', async () => {
  let requestCount = 0
  const gateway = createAuthGateway({
    requestCode: () => {
      requestCount += 1
      return Promise.resolve({
        ok: true,
        data: {
          challengeId: `challenge-${requestCount}`,
          expiresInSeconds: 600,
          resendAfterSeconds: requestCount === 1 ? 1 : 45,
        },
      })
    },
  })
  mountProvider({ gateway })
  await moveToCodeStep()
  act(() => getAuth().tickResendCountdown())

  await act(async () => {
    await expect(getAuth().resendCode()).resolves.toBe(true)
  })

  expect(getAuth().state).toMatchObject({
    challengeId: 'challenge-2',
    resendSeconds: 45,
    code: '',
  })
})

test('prevents duplicate verification submissions', async () => {
  let finishVerification!: () => void
  const pending = new Promise<void>((resolve) => {
    finishVerification = resolve
  })
  const verifyOtp = vi.fn(async () => {
    await pending
    return {
      ok: true as const,
      data: { isNew: true, isPrivate: true, twoFactorRequirement: null },
    }
  })
  mountProvider({ gateway: createAuthGateway({ verifyOtp }) })
  await moveToCodeStep()

  const first = getAuth().verifyCode()
  await expect(getAuth().verifyCode()).resolves.toBe(false)
  expect(verifyOtp).toHaveBeenCalledOnce()
  finishVerification()
  await act(async () => {
    await first
  })
})

test('waits for backend logout before clearing local identity state', async () => {
  let finishSignOut!: () => void
  const signOut = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishSignOut = resolve
      }),
  )
  const sessionStore = createSessionStore('authenticated')
  mountProvider({ gateway: createAuthGateway({ signOut }), sessionStore })
  queryClient?.setQueryData(CURRENT_USER_QUERY_KEY, currentUser)
  act(() => getAuth().setPhone('554570290'))

  const result = getAuth().signOut()

  expect(signOut).toHaveBeenCalledOnce()
  expect(sessionStore.readStatus()).toBe('authenticated')
  expect(queryClient?.getQueryData(CURRENT_USER_QUERY_KEY)).toEqual(currentUser)

  finishSignOut()
  await act(async () => {
    await expect(result).resolves.toBe(true)
  })

  expect(sessionStore.readStatus()).toBe('anonymous')
  expect(queryClient?.getQueryData(CURRENT_USER_QUERY_KEY)).toBeUndefined()
  expect(getAuth().state).toMatchObject({ step: 'phone', phone: '' })
})

test('keeps the local session when backend logout fails', async () => {
  const sessionStore = createSessionStore('authenticated')
  mountProvider({
    gateway: createAuthGateway({
      signOut: () => Promise.reject(new Error('Network detail')),
    }),
    sessionStore,
  })
  queryClient?.setQueryData(CURRENT_USER_QUERY_KEY, currentUser)

  await act(async () => {
    await expect(getAuth().signOut()).resolves.toBe(false)
  })

  expect(sessionStore.readStatus()).toBe('authenticated')
  expect(queryClient?.getQueryData(CURRENT_USER_QUERY_KEY)).toEqual(currentUser)
  expect(authTestState.signOutError).toHaveBeenCalledWith(
    'Unable to sign out. Try again.',
  )
})
