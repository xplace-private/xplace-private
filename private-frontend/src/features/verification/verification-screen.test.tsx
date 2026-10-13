import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { Applicant } from './model/applicant'

interface ContinueViewProps {
  pending: boolean
  error: string | null
  onContinue(): void
  onSignOut(): void
}

interface VerificationFlowDouble {
  applicant: Applicant | null | undefined
  applicantStatus: 'disabled' | 'loading' | 'success' | 'error'
  applicantError: Error | null
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
  continueProps: null as ContinueViewProps | null,
  status: null as 'under-review' | 'account-pending' | 'rejected' | null,
  statusSignOut: null as (() => void) | null,
}))

vi.mock('./verification-flow-provider', () => ({
  useVerificationFlow: () => {
    if (screenTestState.flow === null) {
      throw new Error('Expected a verification flow test double')
    }
    return screenTestState.flow
  },
}))

vi.mock('./continue-verification-view', () => ({
  ContinueVerificationView: (props: ContinueViewProps) => {
    screenTestState.continueProps = props
    return null
  },
}))

vi.mock('./verification-status-view', () => ({
  VerificationStatusView: ({
    status,
    onSignOut,
  }: {
    status: 'under-review' | 'account-pending' | 'rejected'
    onSignOut(): void
  }) => {
    screenTestState.status = status
    screenTestState.statusSignOut = onSignOut
    return null
  },
}))

import { VerificationScreen } from './verification-screen'

const genericError = 'Something went wrong. Please try again.'
const baseApplicant: Applicant = {
  id: 41,
  gender: null,
  sumsubId: 'sumsub-41',
  status: 'not_started',
  adminReviewStatus: 'not_required',
  rainApproved: false,
  rainStatus: 'pending',
}

class VisibilityDocumentDouble {
  visibilityState: DocumentVisibilityState = 'visible'
  private listeners = new Set<EventListenerOrEventListenerObject>()

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ) {
    if (type === 'visibilitychange' && listener !== null) {
      this.listeners.add(listener)
    }
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ) {
    if (type === 'visibilitychange' && listener !== null) {
      this.listeners.delete(listener)
    }
  }

  changeVisibility(visibilityState: DocumentVisibilityState) {
    this.visibilityState = visibilityState
    const event = new Event('visibilitychange')
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }
}

let root: Root | null = null
let visibilityDocument: VisibilityDocumentDouble
let onStartSdk: () => void
let onCompleted: () => void
let onSignOut: () => void

function applicant(overrides: Partial<Applicant> = {}): Applicant {
  return { ...baseApplicant, ...overrides }
}

function createFlow(
  overrides: Partial<VerificationFlowDouble> = {},
): VerificationFlowDouble {
  return {
    applicant: applicant(),
    applicantStatus: 'success',
    applicantError: null,
    refetchApplicant: async () => undefined,
    invalidateApplicant: async () => undefined,
    token: null,
    tokenStatus: 'idle',
    prepareToken: async () => true,
    refreshToken: async () => 'fresh-token',
    clearToken: () => undefined,
    submitted: false,
    markSubmitted: () => undefined,
    markAttemptFailed: () => undefined,
    consumeAttemptFailure: () => false,
    ...overrides,
  }
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

async function mount({ strict = false }: { strict?: boolean } = {}) {
  root = createRoot(createEmptyReactContainer())
  const screen = (
    <VerificationScreen
      onStartSdk={onStartSdk}
      onCompleted={onCompleted}
      onSignOut={onSignOut}
    />
  )
  await act(async () => {
    root?.render(strict ? <StrictMode>{screen}</StrictMode> : screen)
  })
}

async function rerender() {
  await act(async () => {
    root?.render(
      <VerificationScreen
        onStartSdk={onStartSdk}
        onCompleted={onCompleted}
        onSignOut={onSignOut}
      />,
    )
  })
}

function getContinueProps(): ContinueViewProps {
  if (screenTestState.continueProps === null) {
    throw new Error('Expected Continue verification view props')
  }
  return screenTestState.continueProps
}

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as unknown as { window?: unknown }).window = {
    HTMLIFrameElement: class {},
  }
  visibilityDocument = new VisibilityDocumentDouble()
  vi.stubGlobal('document', visibilityDocument)
  onStartSdk = vi.fn()
  onCompleted = vi.fn()
  onSignOut = vi.fn()
  screenTestState.flow = createFlow()
  screenTestState.continueProps = null
  screenTestState.status = null
  screenTestState.statusSignOut = null
})

afterEach(() => {
  if (root !== null) act(() => root?.unmount())
  root = null
  screenTestState.flow = null
  screenTestState.continueProps = null
  screenTestState.status = null
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('VerificationScreen', () => {
  test('renders nothing while the initial applicant is absent', () => {
    screenTestState.flow = createFlow({
      applicant: undefined,
      applicantStatus: 'loading',
    })

    const html = renderToStaticMarkup(
      <VerificationScreen
        onStartSdk={onStartSdk}
        onCompleted={onCompleted}
        onSignOut={onSignOut}
      />,
    )

    expect(html).toBe('')
    expect(screenTestState.continueProps).toBeNull()
    expect(screenTestState.status).toBeNull()
  })

  test('throws the sanitized applicant error after loading ends in error', () => {
    const applicantError = new Error(genericError)
    screenTestState.flow = createFlow({
      applicant: undefined,
      applicantStatus: 'error',
      applicantError,
    })

    expect(() =>
      renderToStaticMarkup(
        <VerificationScreen
          onStartSdk={onStartSdk}
          onCompleted={onCompleted}
          onSignOut={onSignOut}
        />,
      ),
    ).toThrow(applicantError)
  })

  test('forwards sign-out intent from the Continue view', async () => {
    await mount()

    getContinueProps().onSignOut()

    expect(onSignOut).toHaveBeenCalledOnce()
  })

  test.each([
    ['under-review', { status: 'pending' }],
    ['account-pending', { status: 'approved', adminReviewStatus: 'approved' }],
    ['rejected', { status: 'rejected' }],
  ] as const)('forwards sign-out intent from %s', async (status, fields) => {
    screenTestState.flow = createFlow({ applicant: applicant(fields) })

    await mount()

    expect(screenTestState.status).toBe(status)
    if (screenTestState.statusSignOut === null) {
      throw new Error('Expected a status sign-out handler')
    }
    screenTestState.statusSignOut()

    expect(onSignOut).toHaveBeenCalledOnce()
  })

  test.each(['idle', 'loading'] as const)('keeps Continue active on entry with token state %s', async (tokenStatus) => {
    const prepareToken = vi.fn(async () => true)
    const refetchApplicant = vi.fn(async () => undefined)
    screenTestState.flow = createFlow({ prepareToken, refetchApplicant, tokenStatus })

    await mount()
    await act(async () => vi.advanceTimersByTimeAsync(9_000))

    expect(screenTestState.continueProps).not.toBeNull()
    expect(getContinueProps().pending).toBe(false)
    expect(prepareToken).not.toHaveBeenCalled()
    expect(refetchApplicant).not.toHaveBeenCalled()
  })

  test('renders Continue for temporary rejection', async () => {
    screenTestState.flow = createFlow({
      applicant: applicant({ status: 'temporary_rejected' }),
    })

    await mount()

    expect(screenTestState.continueProps).not.toBeNull()
    expect(screenTestState.status).toBeNull()
  })

  test('shows a generic alert for a token-query error', async () => {
    screenTestState.flow = createFlow({
      tokenStatus: 'error',
      prepareToken: async () => false,
    })

    await mount()

    expect(getContinueProps().error).toBe(genericError)
  })

  test('consumes one SDK attempt error and keeps its alert under Strict Mode', async () => {
    const consumeAttemptFailure = vi.fn(() => true)
    screenTestState.flow = createFlow({ consumeAttemptFailure })

    await mount({ strict: true })

    expect(consumeAttemptFailure).toHaveBeenCalledOnce()
    expect(getContinueProps().error).toBe(genericError)
  })

  test('retries token preparation and starts the SDK only after success', async () => {
    let resolveRetry: (prepared: boolean) => void = () => {
      throw new Error('Retry resolver was not captured')
    }
    const prepareToken = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRetry = resolve
          }),
      )
    screenTestState.flow = createFlow({ prepareToken })
    await mount()

    expect(prepareToken).not.toHaveBeenCalled()
    await act(async () => getContinueProps().onContinue())
    expect(getContinueProps().error).toBe(genericError)
    expect(getContinueProps().pending).toBe(false)
    expect(onStartSdk).not.toHaveBeenCalled()

    act(() => getContinueProps().onContinue())
    expect(getContinueProps().error).toBeNull()
    expect(getContinueProps().pending).toBe(true)
    expect(onStartSdk).not.toHaveBeenCalled()

    await act(async () => {
      resolveRetry(true)
      await Promise.resolve()
    })

    expect(prepareToken).toHaveBeenCalledTimes(2)
    expect(onStartSdk).toHaveBeenCalledOnce()
  })

  test.each([
    ['Under review', { status: 'pending' }],
    ['Rejected', { status: 'rejected' }],
    [
      'Completed',
      {
        status: 'approved',
        adminReviewStatus: 'approved',
        rainApproved: true,
        rainStatus: 'approved',
      },
    ],
  ] as const)(
    'does not start the SDK when token preparation resolves after entering %s',
    async (_label, fields) => {
      let resolvePreparation: (prepared: boolean) => void = () => {
        throw new Error('Preparation resolver was not captured')
      }
      const prepareToken = vi
        .fn<() => Promise<boolean>>()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolvePreparation = resolve
            }),
        )
      screenTestState.flow = createFlow({ prepareToken })
      await mount()

      act(() => getContinueProps().onContinue())
      screenTestState.flow = createFlow({
        applicant: applicant(fields),
        prepareToken,
      })
      await rerender()
      await act(async () => {
        resolvePreparation(true)
        await Promise.resolve()
      })

      expect(onStartSdk).not.toHaveBeenCalled()
    },
  )

  test('keeps stale not-started applicant data under review after local submission', async () => {
    const refetchApplicant = vi.fn(async () => undefined)
    screenTestState.flow = createFlow({ submitted: true, refetchApplicant })

    await mount()

    expect(screenTestState.status).toBe('under-review')
    expect(refetchApplicant).toHaveBeenCalledOnce()
  })

  test('renders pending Sumsub as under review', async () => {
    screenTestState.flow = createFlow({
      applicant: applicant({ status: 'pending' }),
    })

    await mount()

    expect(screenTestState.status).toBe('under-review')
  })

  test('keeps Sumsub and admin approvals with Rain pending on Account pending', async () => {
    const refetchApplicant = vi.fn(async () => undefined)
    screenTestState.flow = createFlow({
      applicant: applicant({
        status: 'approved',
        adminReviewStatus: 'approved',
        rainStatus: 'pending',
      }),
      refetchApplicant,
    })

    await mount()
    await act(async () => vi.advanceTimersByTimeAsync(3_000))

    expect(screenTestState.status).toBe('account-pending')
    expect(onCompleted).not.toHaveBeenCalled()
    expect(refetchApplicant).toHaveBeenCalledTimes(2)
  })

  test.each([
    'needsInformation',
    'needsVerification',
    'manualReview',
  ] as const)('keeps Rain %s on Account pending', async (rainStatus) => {
    screenTestState.flow = createFlow({
      applicant: applicant({
        status: 'approved',
        adminReviewStatus: 'approved',
        rainStatus,
      }),
    })

    await mount()

    expect(screenTestState.status).toBe('account-pending')
  })

  test.each([
    ['Sumsub rejected', { status: 'rejected' }],
    ['Admin declined', { adminReviewStatus: 'declined' }],
    ['Rain denied', { rainStatus: 'denied' }],
    ['Rain locked', { rainStatus: 'locked' }],
    ['Rain canceled', { rainStatus: 'canceled' }],
  ] as const)('renders %s as terminal rejection without polling', async (_label, fields) => {
    const refetchApplicant = vi.fn(async () => undefined)
    screenTestState.flow = createFlow({
      applicant: applicant(fields),
      refetchApplicant,
    })

    await mount()
    await act(async () => vi.advanceTimersByTimeAsync(9_000))

    expect(screenTestState.status).toBe('rejected')
    expect(refetchApplicant).not.toHaveBeenCalled()
  })

  test('stops polling and completes immediately when Rain approves', async () => {
    const refetchApplicant = vi.fn(async () => undefined)
    screenTestState.flow = createFlow({
      applicant: applicant({
        status: 'approved',
        adminReviewStatus: 'approved',
        rainStatus: 'pending',
      }),
      refetchApplicant,
    })
    await mount()
    expect(refetchApplicant).toHaveBeenCalledOnce()
    screenTestState.status = null

    screenTestState.flow = createFlow({
      applicant: applicant({
        status: 'approved',
        adminReviewStatus: 'approved',
        rainApproved: true,
        rainStatus: 'approved',
      }),
      refetchApplicant,
    })
    await rerender()

    expect(onCompleted).toHaveBeenCalledOnce()
    expect(screenTestState.status).toBeNull()

    await act(async () => vi.advanceTimersByTimeAsync(6_000))
    expect(onCompleted).toHaveBeenCalledOnce()
    expect(refetchApplicant).toHaveBeenCalledOnce()
  })

  test.each([
    ['Continue', applicant()],
    ['Rejected', applicant({ status: 'rejected' })],
  ] as const)(
    'completes immediately without Account pending when %s becomes verified',
    async (_label, initialApplicant) => {
      screenTestState.flow = createFlow({ applicant: initialApplicant })
      await mount()
      screenTestState.status = null

      screenTestState.flow = createFlow({
        applicant: applicant({
          status: 'approved',
          adminReviewStatus: 'approved',
          rainApproved: true,
          rainStatus: 'approved',
        }),
      })
      await rerender()

      expect(onCompleted).toHaveBeenCalledOnce()
      expect(screenTestState.status).toBeNull()
      expect(onCompleted).toHaveBeenCalledOnce()
    },
  )

  test('completes an initial verified mount once immediately under Strict Mode', async () => {
    screenTestState.flow = createFlow({
      applicant: applicant({
        status: 'approved',
        adminReviewStatus: 'approved',
        rainApproved: true,
        rainStatus: 'approved',
      }),
    })

    await mount({ strict: true })

    expect(onCompleted).toHaveBeenCalledOnce()
    expect(screenTestState.status).toBeNull()
    expect(onCompleted).toHaveBeenCalledOnce()
  })

  test('refetches immediately and every three visible seconds while under review', async () => {
    const refetchApplicant = vi.fn(async () => undefined)
    screenTestState.flow = createFlow({
      applicant: applicant({ status: 'pending' }),
      refetchApplicant,
    })

    await mount()
    expect(refetchApplicant).toHaveBeenCalledOnce()

    await act(async () => vi.advanceTimersByTimeAsync(2_999))
    expect(refetchApplicant).toHaveBeenCalledOnce()

    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(refetchApplicant).toHaveBeenCalledTimes(2)

    await act(async () => vi.advanceTimersByTimeAsync(6_000))
    expect(refetchApplicant).toHaveBeenCalledTimes(4)
  })

  test('pauses while hidden, then refetches immediately and resumes when visible', async () => {
    const refetchApplicant = vi.fn(async () => undefined)
    screenTestState.flow = createFlow({
      applicant: applicant({ status: 'pending' }),
      refetchApplicant,
    })
    await mount()
    expect(refetchApplicant).toHaveBeenCalledOnce()

    act(() => visibilityDocument.changeVisibility('hidden'))
    await act(async () => vi.advanceTimersByTimeAsync(6_000))
    expect(refetchApplicant).toHaveBeenCalledOnce()

    act(() => visibilityDocument.changeVisibility('visible'))
    expect(refetchApplicant).toHaveBeenCalledTimes(2)

    await act(async () => vi.advanceTimersByTimeAsync(3_000))
    expect(refetchApplicant).toHaveBeenCalledTimes(3)
  })

  test('clears applicant polling when unmounted', async () => {
    const refetchApplicant = vi.fn(async () => undefined)
    screenTestState.flow = createFlow({
      applicant: applicant({ status: 'pending' }),
      refetchApplicant,
    })
    await mount()

    act(() => root?.unmount())
    root = null
    await act(async () => vi.advanceTimersByTimeAsync(9_000))

    expect(refetchApplicant).toHaveBeenCalledOnce()
  })

})
