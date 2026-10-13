import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

import { createReactDomTestContainer } from '../../shared/testing/react-dom-test-container'
import type { ApplicantGateway } from './api/applicant-gateway'
import type { SumsubTokenGateway } from './api/sumsub-token-gateway'
import { SUMSUB_TOKEN_QUERY_KEY } from './sumsub-token-query'
import { VerificationFlowProvider } from './verification-flow-provider'
import { createVerificationSessionStore } from './verification-session-store'

interface CapturedSdkProps {
  onTokenExpired(): Promise<string>
  onSubmitted(): void
}

const integrationTestState = vi.hoisted(() => ({
  sdkProps: null as CapturedSdkProps | null,
}))

vi.mock('../../shared/ui/loader', () => ({ Loader: () => null }))
vi.mock('./sumsub-web-sdk-view', () => ({
  SumsubWebSdkView: (props: CapturedSdkProps) => {
    integrationTestState.sdkProps = props
    return null
  },
}))

import { SumsubVerificationScreen } from './sumsub-verification-screen'

let root: Root | null = null
let queryClient: QueryClient | null = null

function createObservedStorage() {
  const values = new Map<string, string>()
  let attemptWrites = 0
  return {
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem(key: string, value: string) {
        if (key === 'xplace.verification.attempt-error') attemptWrites += 1
        values.set(key, value)
      },
    },
    attemptWrites: () => attemptWrites,
  }
}

async function flushEffects() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
}

function getSdkProps(): CapturedSdkProps {
  if (integrationTestState.sdkProps === null) {
    throw new Error('Expected Sumsub SDK props to be captured')
  }
  return integrationTestState.sdkProps
}

afterEach(async () => {
  if (root !== null) act(() => root?.unmount())
  queryClient?.clear()
  root = null
  queryClient = null
  integrationTestState.sdkProps = null
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  vi.unstubAllGlobals()
})

test('a failed preparation marks and exits once without retrying through provider rerenders', async () => {
  let tokenRequests = 0
  const tokenGateway: SumsubTokenGateway = {
    get: () => {
      tokenRequests += 1
      if (tokenRequests === 1) {
        return Promise.resolve({
          ok: false,
          code: 'sumsub-token-failed',
          message: 'Something went wrong. Please try again.',
        })
      }
      return new Promise(() => undefined)
    },
  }
  const applicantGateway: ApplicantGateway = {
    get: () => Promise.resolve({ ok: true, data: null }),
  }
  const observedStorage = createObservedStorage()
  const sessionStore = createVerificationSessionStore(
    () => observedStorage.storage,
  )
  let exits = 0
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('window', { HTMLIFrameElement: class {} })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient = client
  root = createRoot(createReactDomTestContainer())

  await act(async () => {
    root?.render(
      <QueryClientProvider client={client}>
        <VerificationFlowProvider
          applicantGateway={applicantGateway}
          tokenGateway={tokenGateway}
          sessionStore={sessionStore}
          enabled={false}
          sessionActive
          sessionIdentity={0}
          isSessionIdentityCurrent={() => true}
        >
          <SumsubVerificationScreen onExit={() => (exits += 1)} />
        </VerificationFlowProvider>
      </QueryClientProvider>,
    )
  })
  await flushEffects()

  expect(tokenRequests).toBe(1)
  expect(observedStorage.attemptWrites()).toBe(1)
  expect(exits).toBe(1)
  expect(sessionStore.consumeAttemptFailure()).toBe(true)
  expect(sessionStore.consumeAttemptFailure()).toBe(false)
})

test('submission remains terminal when real token cleanup aborts an in-flight refresh', async () => {
  const requests: Array<{
    signal: AbortSignal | undefined
    resolve(value: {
      ok: true
      data: { token: string; userId: string }
    }): void
  }> = []
  const tokenGateway: SumsubTokenGateway = {
    get: (signal) =>
      new Promise((resolve) => {
        requests.push({ signal, resolve })
      }),
  }
  const applicantGateway: ApplicantGateway = {
    get: () => Promise.resolve({ ok: true, data: null }),
  }
  const observedStorage = createObservedStorage()
  const sessionStore = createVerificationSessionStore(
    () => observedStorage.storage,
  )
  let exits = 0
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('window', { HTMLIFrameElement: class {} })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient = client
  client.setQueryData(SUMSUB_TOKEN_QUERY_KEY, {
    token: 'cached-token',
    userId: 'sumsub-user',
  })
  root = createRoot(createReactDomTestContainer())

  await act(async () => {
    root?.render(
      <QueryClientProvider client={client}>
        <VerificationFlowProvider
          applicantGateway={applicantGateway}
          tokenGateway={tokenGateway}
          sessionStore={sessionStore}
          enabled={false}
          sessionActive
          sessionIdentity={0}
          isSessionIdentityCurrent={() => true}
        >
          <SumsubVerificationScreen onExit={() => (exits += 1)} />
        </VerificationFlowProvider>
      </QueryClientProvider>,
    )
  })
  const sdk = getSdkProps()
  const refresh = sdk.onTokenExpired()

  act(() => sdk.onSubmitted())

  expect(sessionStore.isSubmitted()).toBe(true)
  expect(exits).toBe(1)
  expect(client.getQueryData(SUMSUB_TOKEN_QUERY_KEY)).toBeUndefined()
  expect(requests).toHaveLength(1)
  expect(requests[0]?.signal?.aborted).toBe(true)
  const refreshRequest = requests[0]
  if (refreshRequest === undefined) throw new Error('Refresh request was not captured')
  await act(async () => {
    refreshRequest.resolve({
      ok: true,
      data: { token: 'late-token', userId: 'sumsub-user' },
    })
    await expect(refresh).rejects.toEqual(
      new Error('Something went wrong. Please try again.'),
    )
  })

  expect(sessionStore.consumeAttemptFailure()).toBe(false)
  expect(observedStorage.attemptWrites()).toBe(0)
})

test('coalesces overlapping expiration callbacks into one live refresh', async () => {
  type TokenResult = Awaited<ReturnType<SumsubTokenGateway['get']>>
  const requests: Array<{
    signal: AbortSignal | undefined
    resolve(value: TokenResult): void
  }> = []
  const tokenGateway: SumsubTokenGateway = {
    get: (signal) =>
      new Promise((resolve) => {
        requests.push({ signal, resolve })
      }),
  }
  const applicantGateway: ApplicantGateway = {
    get: () => Promise.resolve({ ok: true, data: null }),
  }
  const observedStorage = createObservedStorage()
  const sessionStore = createVerificationSessionStore(
    () => observedStorage.storage,
  )
  let exits = 0
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('window', { HTMLIFrameElement: class {} })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient = client
  client.setQueryData(SUMSUB_TOKEN_QUERY_KEY, {
    token: 'cached-token',
    userId: 'sumsub-user',
  })
  root = createRoot(createReactDomTestContainer())

  await act(async () => {
    root?.render(
      <QueryClientProvider client={client}>
        <VerificationFlowProvider
          applicantGateway={applicantGateway}
          tokenGateway={tokenGateway}
          sessionStore={sessionStore}
          enabled={false}
          sessionActive
          sessionIdentity={0}
          isSessionIdentityCurrent={() => true}
        >
          <SumsubVerificationScreen onExit={() => (exits += 1)} />
        </VerificationFlowProvider>
      </QueryClientProvider>,
    )
  })
  const sdk = getSdkProps()

  const firstRefresh = sdk.onTokenExpired()
  const secondRefresh = sdk.onTokenExpired()

  expect(requests).toHaveLength(1)
  const request = requests[0]
  if (request === undefined) throw new Error('Refresh request was not captured')
  await act(async () => {
    request.resolve({
      ok: true,
      data: { token: 'fresh-token', userId: 'sumsub-user' },
    })
    await expect(firstRefresh).resolves.toBe('fresh-token')
    await expect(secondRefresh).resolves.toBe('fresh-token')
  })

  expect(request.signal?.aborted).toBe(false)
  expect(client.getQueryData(SUMSUB_TOKEN_QUERY_KEY)).toEqual({
    token: 'fresh-token',
    userId: 'sumsub-user',
  })
  expect(sessionStore.consumeAttemptFailure()).toBe(false)
  expect(observedStorage.attemptWrites()).toBe(0)
  expect(exits).toBe(0)
})

test('a refresh rejection after browser Back cannot affect the next route attempt', async () => {
  type TokenResult = Awaited<ReturnType<SumsubTokenGateway['get']>>
  const refreshRequest: {
    resolve: ((value: TokenResult) => void) | null
  } = { resolve: null }
  const tokenGateway: SumsubTokenGateway = {
    get: () =>
      new Promise((resolve) => {
        refreshRequest.resolve = resolve
      }),
  }
  const applicantGateway: ApplicantGateway = {
    get: () => Promise.resolve({ ok: true, data: null }),
  }
  const observedStorage = createObservedStorage()
  const sessionStore = createVerificationSessionStore(
    () => observedStorage.storage,
  )
  let exits = 0
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('window', { HTMLIFrameElement: class {} })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient = client
  client.setQueryData(SUMSUB_TOKEN_QUERY_KEY, {
    token: 'cached-token',
    userId: 'sumsub-user',
  })
  root = createRoot(createReactDomTestContainer())

  await act(async () => {
    root?.render(
      <QueryClientProvider client={client}>
        <VerificationFlowProvider
          applicantGateway={applicantGateway}
          tokenGateway={tokenGateway}
          sessionStore={sessionStore}
          enabled={false}
          sessionActive
          sessionIdentity={0}
          isSessionIdentityCurrent={() => true}
        >
          <SumsubVerificationScreen onExit={() => (exits += 1)} />
        </VerificationFlowProvider>
      </QueryClientProvider>,
    )
  })
  const refresh = getSdkProps().onTokenExpired()

  await act(async () => {
    root?.render(
      <QueryClientProvider client={client}>
        <VerificationFlowProvider
          applicantGateway={applicantGateway}
          tokenGateway={tokenGateway}
          sessionStore={sessionStore}
          enabled={false}
          sessionActive
          sessionIdentity={0}
          isSessionIdentityCurrent={() => true}
        >
          {null}
        </VerificationFlowProvider>
      </QueryClientProvider>,
    )
  })
  client.setQueryData(SUMSUB_TOKEN_QUERY_KEY, {
    token: 'next-route-token',
    userId: 'sumsub-user',
  })

  const resolve = refreshRequest.resolve
  if (resolve === null) throw new Error('Refresh resolver was not captured')
  await act(async () => {
    resolve({
      ok: false,
      code: 'sumsub-token-failed',
      message: 'Sensitive provider failure',
    })
    await expect(refresh).rejects.toEqual(
      new Error('Something went wrong. Please try again.'),
    )
  })

  expect(client.getQueryData(SUMSUB_TOKEN_QUERY_KEY)).toEqual({
    token: 'next-route-token',
    userId: 'sumsub-user',
  })
  expect(sessionStore.consumeAttemptFailure()).toBe(false)
  expect(observedStorage.attemptWrites()).toBe(0)
  expect(exits).toBe(0)
})
