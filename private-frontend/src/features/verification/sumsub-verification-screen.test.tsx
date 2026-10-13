import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createReactDomTestContainer } from '../../shared/testing/react-dom-test-container'

interface CapturedSdkProps {
  accessToken: string
  onTokenExpired(): Promise<string>
  onSubmitted(): void
}

interface VerificationFlowDouble {
  applicant: null
  applicantStatus: 'success'
  applicantError: null
  refetchApplicant(): Promise<void>
  invalidateApplicant(): Promise<void>
  token: { token: string; userId: string } | null
  tokenStatus: 'idle' | 'loading' | 'success' | 'error'
  prepareToken(): Promise<boolean>
  refreshToken(): Promise<string>
  clearToken(): void
  submitted: boolean
  markSubmitted(): void
  markAttemptFailed(): void
  consumeAttemptFailure(): boolean
}

const screenTestState = vi.hoisted(() => ({
  flow: null as VerificationFlowDouble | null,
  sdkProps: null as CapturedSdkProps | null,
}))

vi.mock('./verification-flow-provider', () => ({
  useVerificationFlow: () => {
    if (screenTestState.flow === null) {
      throw new Error('Expected a verification flow test double')
    }
    return screenTestState.flow
  },
}))

vi.mock('./sumsub-web-sdk-view', () => ({
  SumsubWebSdkView: (props: CapturedSdkProps) => {
    screenTestState.sdkProps = props
    return null
  },
}))

import { SumsubVerificationScreen } from './sumsub-verification-screen'

let root: Root | null = null

function createFlow(
  overrides: Partial<VerificationFlowDouble> = {},
): VerificationFlowDouble {
  return {
    applicant: null,
    applicantStatus: 'success',
    applicantError: null,
    refetchApplicant: async () => undefined,
    invalidateApplicant: async () => undefined,
    token: { token: 'cached-token', userId: 'sumsub-user' },
    tokenStatus: 'success',
    prepareToken: async () => true,
    refreshToken: async () => 'refreshed-token',
    clearToken: () => undefined,
    submitted: false,
    markSubmitted: () => undefined,
    markAttemptFailed: () => undefined,
    consumeAttemptFailure: () => false,
    ...overrides,
  }
}

function getSdkProps(): CapturedSdkProps {
  if (screenTestState.sdkProps === null) {
    throw new Error('Expected the Sumsub SDK view props to be captured')
  }
  return screenTestState.sdkProps
}

async function mount(onExit: () => void) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('window', { HTMLIFrameElement: class {} })
  root = createRoot(createReactDomTestContainer())

  await act(async () => {
    root?.render(<SumsubVerificationScreen onExit={onExit} />)
  })
}

beforeEach(() => {
  screenTestState.flow = createFlow()
  screenTestState.sdkProps = null
})

afterEach(() => {
  if (root !== null) act(() => root?.unmount())
  root = null
  screenTestState.flow = null
  screenTestState.sdkProps = null
  vi.unstubAllGlobals()
})

describe('SumsubVerificationScreen', () => {
  test('renders the SDK immediately with the cached provider token', () => {
    renderToStaticMarkup(<SumsubVerificationScreen onExit={() => undefined} />)

    expect(getSdkProps().accessToken).toBe('cached-token')
  })

  test('prepares a missing token while rendering the shared loader', async () => {
    const prepareToken = vi.fn(async () => true)
    screenTestState.flow = createFlow({
      token: null,
      tokenStatus: 'idle',
      prepareToken,
    })

    const html = renderToStaticMarkup(
      <SumsubVerificationScreen onExit={() => undefined} />,
    )
    await mount(() => undefined)

    expect(html).toContain('Preparing verification')
    expect(html).toContain(
      'flex min-w-0 max-w-full flex-1 items-center justify-center',
    )
    expect(prepareToken).toHaveBeenCalledOnce()
    expect(screenTestState.sdkProps).toBeNull()
  })

  test('marks a failed token preparation before clearing and replacing the SDK route', async () => {
    const events: string[] = []
    screenTestState.flow = createFlow({
      token: null,
      tokenStatus: 'idle',
      prepareToken: async () => false,
      markAttemptFailed: () => events.push('attempt-failed'),
      clearToken: () => events.push('token-cleared'),
    })

    await mount(() => events.push('route-replaced'))

    expect(events).toEqual([
      'attempt-failed',
      'token-cleared',
      'route-replaced',
    ])
  })

  test('marks submission before clearing and replacing the SDK route', () => {
    const events: string[] = []
    screenTestState.flow = createFlow({
      markSubmitted: () => events.push('submitted'),
      clearToken: () => events.push('token-cleared'),
    })
    renderToStaticMarkup(
      <SumsubVerificationScreen onExit={() => events.push('route-replaced')} />,
    )

    getSdkProps().onSubmitted()

    expect(events).toEqual(['submitted', 'token-cleared', 'route-replaced'])
  })

  test('returns the refreshed token to the SDK expiration handler', async () => {
    screenTestState.flow = createFlow({
      refreshToken: async () => 'fresh-token',
    })
    renderToStaticMarkup(<SumsubVerificationScreen onExit={() => undefined} />)

    await expect(getSdkProps().onTokenExpired()).resolves.toBe('fresh-token')
  })

  test('sanitizes refresh failure after marking failure, clearing, and replacing', async () => {
    const events: string[] = []
    screenTestState.flow = createFlow({
      refreshToken: async () => {
        throw new Error('Sensitive provider failure')
      },
      markAttemptFailed: () => events.push('attempt-failed'),
      clearToken: () => events.push('token-cleared'),
    })
    renderToStaticMarkup(
      <SumsubVerificationScreen onExit={() => events.push('route-replaced')} />,
    )

    await expect(getSdkProps().onTokenExpired()).rejects.toEqual(
      new Error('Something went wrong. Please try again.'),
    )
    expect(events).toEqual([
      'attempt-failed',
      'token-cleared',
      'route-replaced',
    ])
  })

  test('keeps submission terminal when an in-flight refresh rejects after token cleanup', async () => {
    const events: string[] = []
    let rejectRefresh: (reason?: unknown) => void = () => {
      throw new Error('Refresh rejection was not captured')
    }
    screenTestState.flow = createFlow({
      refreshToken: () =>
        new Promise((_resolve, reject) => {
          rejectRefresh = reject
        }),
      markSubmitted: () => events.push('submitted'),
      markAttemptFailed: () => events.push('attempt-failed'),
      clearToken: () => events.push('token-cleared'),
    })
    renderToStaticMarkup(
      <SumsubVerificationScreen onExit={() => events.push('route-replaced')} />,
    )
    const sdk = getSdkProps()

    const refresh = sdk.onTokenExpired()
    const refreshFailure = expect(refresh).rejects.toEqual(
      new Error('Something went wrong. Please try again.'),
    )
    sdk.onSubmitted()
    rejectRefresh(new Error('Refresh aborted during token cleanup'))

    await refreshFailure
    expect(events).toEqual(['submitted', 'token-cleared', 'route-replaced'])
  })

  test('ignores duplicate submissions after the first terminal callback', () => {
    const events: string[] = []
    screenTestState.flow = createFlow({
      markSubmitted: () => events.push('submitted'),
      markAttemptFailed: () => events.push('attempt-failed'),
      clearToken: () => events.push('token-cleared'),
    })
    renderToStaticMarkup(
      <SumsubVerificationScreen onExit={() => events.push('route-replaced')} />,
    )
    const sdk = getSdkProps()

    sdk.onSubmitted()
    sdk.onSubmitted()

    expect(events).toEqual(['submitted', 'token-cleared', 'route-replaced'])
  })
})
