import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

import type { OccupationGateway } from './api/occupation-gateway'
import type { Agreement, OnboardingGateway } from './api/onboarding-gateway'
import { OnboardingFlowProvider, useOnboardingFlow } from './onboarding-flow-provider'

type OnboardingValue = ReturnType<typeof useOnboardingFlow>

let onboarding: OnboardingValue | null = null
let root: Root | null = null
let queryClient: QueryClient | null = null

const agreements: readonly Agreement[] = [
  {
    agreementType: 'e_sign_consent',
    agreementName: 'E-sign Consent',
    accepted: false,
    documentVersion: null,
    acceptedAt: null,
  },
  {
    agreementType: 'account_opening_privacy',
    agreementName: 'Account Opening Privacy Notice',
    accepted: false,
    documentVersion: null,
    acceptedAt: null,
  },
]

function OnboardingProbe() {
  const value = useOnboardingFlow()

  useEffect(() => {
    onboarding = value
  }, [value])

  return null
}

function getOnboarding(): OnboardingValue {
  if (onboarding === null) throw new Error('Onboarding value was not captured')
  return onboarding
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

function mountProvider(
  occupationGateway: OccupationGateway,
  onboardingGateway: Partial<OnboardingGateway> = {},
) {
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { event?: Event; HTMLIFrameElement: new () => object }
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  root = createRoot(createEmptyReactContainer())
  const gateway: OnboardingGateway = {
    listAgreements: () => Promise.resolve({ ok: true, data: agreements }),
    submitApplicant: () => Promise.resolve({ ok: true }),
    ...onboardingGateway,
  }

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <OnboardingFlowProvider
          gateway={gateway}
          occupationGateway={occupationGateway}
        >
          <OnboardingProbe />
        </OnboardingFlowProvider>
      </QueryClientProvider>,
    )
  })
}

async function waitForOccupationStatus(
  status: OnboardingValue['occupationLoadStatus'],
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getOnboarding().occupationLoadStatus === status) return

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }

  throw new Error(`Occupation list did not reach ${status}`)
}

async function waitForAgreementStatus(
  status: OnboardingValue['agreementLoadStatus'],
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getOnboarding().agreementLoadStatus === status) return

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }

  throw new Error(`Agreement list did not reach ${status}`)
}

async function advanceToFinalStep() {
  act(() => getOnboarding().setResidency('united-states'))
  await act(async () => { await getOnboarding().continueStep() })
  act(() => getOnboarding().setOccupation({ id: 11, name: 'Accountant' }))
  await act(async () => { await getOnboarding().continueStep() })
  act(() => getOnboarding().setYearlyIncome('USD 50,000 – 100,000'))
  await act(async () => { await getOnboarding().continueStep() })
  act(() => getOnboarding().setMonthlySpend('USD 1,000 – 5,000'))
  await act(async () => { await getOnboarding().continueStep() })
  act(() => getOnboarding().setAccountPurpose('Personal spending'))
  await act(async () => { await getOnboarding().continueStep() })
  await waitForAgreementStatus('success')
  act(() => getOnboarding().acceptAgreements())
}

afterEach(() => {
  if (root !== null) act(() => root?.unmount())
  queryClient?.clear()
  onboarding = null
  root = null
  queryClient = null

  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as { window?: unknown }
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
  delete browserGlobal.window
})

test('loads step 2 occupations and debounces search without clearing selection', async () => {
  const list = vi.fn((search: string) =>
    Promise.resolve({
      ok: true as const,
      data:
        search === ''
          ? [
              { id: 11, name: 'Accountant' },
              { id: 12, name: 'Actuary' },
            ]
          : [{ id: 11, name: 'Accountant' }],
    }),
  )
  mountProvider({ list })

  act(() => getOnboarding().setResidency('united-states'))
  await act(async () => {
    await getOnboarding().continueStep()
  })
  await waitForOccupationStatus('success')

  expect(list).toHaveBeenCalledTimes(1)
  expect(list.mock.calls[0]?.[0]).toBe('')
  expect(getOnboarding().occupations).toHaveLength(2)

  const selected = { id: 12, name: 'Actuary' }
  act(() => {
    getOnboarding().setOccupation(selected)
    getOnboarding().setOccupationQuery('  account  ')
  })

  expect(getOnboarding().state.occupation).toEqual(selected)
  expect(getOnboarding().occupationLoadStatus).toBe('loading')
  expect(list).toHaveBeenCalledTimes(1)

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 320))
  })
  await waitForOccupationStatus('success')

  expect(list).toHaveBeenCalledTimes(2)
  expect(list.mock.calls[1]?.[0]).toBe('account')
  expect(getOnboarding().occupations).toEqual([{ id: 11, name: 'Accountant' }])
  expect(getOnboarding().state.occupation).toEqual(selected)
})

test('loads the server-selected agreement set only on step 6', async () => {
  const listAgreements = vi.fn(() =>
    Promise.resolve({ ok: true as const, data: agreements }),
  )
  mountProvider(
    { list: () => Promise.resolve({ ok: true as const, data: [] }) },
    { listAgreements },
  )

  expect(listAgreements).toHaveBeenCalledTimes(0)
  await advanceToFinalStep()
  await waitForAgreementStatus('success')

  expect(listAgreements).toHaveBeenCalledTimes(1)
  expect(getOnboarding().agreements).toEqual(agreements)
})

test('keeps the first five steps in the local draft before submitting the applicant', async () => {
  const submitApplicant = vi.fn(() => Promise.resolve({ ok: true as const }))
  mountProvider(
    { list: () => Promise.resolve({ ok: true as const, data: [] }) },
    { submitApplicant },
  )

  act(() => getOnboarding().setResidency('united-states'))
  await act(async () => {
    await getOnboarding().continueStep()
  })
  expect(getOnboarding().state.step).toBe(2)
  expect(submitApplicant).toHaveBeenCalledTimes(0)

  act(() => getOnboarding().setOccupation({ id: 11, name: 'Accountant' }))
  await act(async () => {
    await getOnboarding().continueStep()
  })
  expect(getOnboarding().state.step).toBe(3)
  expect(submitApplicant).toHaveBeenCalledTimes(0)

  act(() => getOnboarding().setYearlyIncome('USD 50,000 – 100,000'))
  await act(async () => {
    await getOnboarding().continueStep()
  })
  expect(getOnboarding().state.step).toBe(4)
  expect(submitApplicant).toHaveBeenCalledTimes(0)

  act(() => getOnboarding().setMonthlySpend('USD 1,000 – 5,000'))
  await act(async () => {
    await getOnboarding().continueStep()
  })
  expect(getOnboarding().state.step).toBe(5)
  expect(submitApplicant).toHaveBeenCalledTimes(0)

  act(() => getOnboarding().setAccountPurpose('Personal spending'))
  await act(async () => {
    await getOnboarding().continueStep()
  })
  expect(getOnboarding().state.step).toBe(6)
  expect(submitApplicant).toHaveBeenCalledTimes(0)

  act(() => getOnboarding().acceptAgreements())
  await act(async () => {
    await getOnboarding().continueStep()
  })

  expect(submitApplicant).toHaveBeenCalledTimes(1)
  expect(submitApplicant).toHaveBeenCalledWith(
    {
      occupation: { id: 11, name: 'Accountant' },
      yearlyIncome: 'USD 50,000 – 100,000',
      monthlySpend: 'USD 1,000 – 5,000',
      accountPurpose: 'Personal spending',
    },
    agreements,
  )
})

test('keeps a failed applicant submission on step 6 with the generic error', async () => {
  const submitApplicant = vi.fn(() =>
    Promise.resolve({
      ok: false as const,
      code: 'backend-detail',
      message: 'backend detail',
    }),
  )
  mountProvider(
    { list: () => Promise.resolve({ ok: true as const, data: [] }) },
    { submitApplicant },
  )

  await advanceToFinalStep()

  await act(async () => {
    await getOnboarding().continueStep()
  })

  expect(getOnboarding().state.step).toBe(6)
  expect(getOnboarding().state.gatewayError).toBe(
    'Something went wrong. Please try again.',
  )
  expect(submitApplicant).toHaveBeenCalledTimes(1)
})

test('retries a failed final submission only after a second continue action', async () => {
  const submitApplicant = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false as const,
      code: 'applicant-submit-failed',
      message: 'Something went wrong. Please try again.',
    })
    .mockResolvedValueOnce({ ok: true as const })
  mountProvider(
    { list: () => Promise.resolve({ ok: true as const, data: [] }) },
    { submitApplicant },
  )

  await advanceToFinalStep()

  await act(async () => { await getOnboarding().continueStep() })
  expect(submitApplicant).toHaveBeenCalledTimes(1)
  expect(getOnboarding().state.step).toBe(6)

  await act(async () => { await getOnboarding().continueStep() })
  expect(submitApplicant).toHaveBeenCalledTimes(2)
  expect(getOnboarding().state.completed).toBe(true)
})

test('does not submit the applicant again after successful completion', async () => {
  const submitApplicant = vi.fn(() => Promise.resolve({ ok: true as const }))
  mountProvider(
    { list: () => Promise.resolve({ ok: true as const, data: [] }) },
    { submitApplicant },
  )

  await advanceToFinalStep()
  await act(async () => { await getOnboarding().continueStep() })
  await act(async () => { await getOnboarding().continueStep() })

  expect(getOnboarding().state.completed).toBe(true)
  expect(submitApplicant).toHaveBeenCalledTimes(1)
})

test('sends one final applicant POST when duplicate continue calls overlap', async () => {
  type SubmitResult = Awaited<ReturnType<OnboardingGateway['submitApplicant']>>
  const request: {
    resolve: ((result: SubmitResult) => void) | null
  } = { resolve: null }
  const submitApplicant = vi.fn(
    () =>
      new Promise<SubmitResult>((resolve) => {
        request.resolve = resolve
      }),
  )
  mountProvider(
    { list: () => Promise.resolve({ ok: true as const, data: [] }) },
    { submitApplicant },
  )
  await advanceToFinalStep()

  const attempts: {
    current: readonly [Promise<boolean>, Promise<boolean>] | null
  } = { current: null }
  act(() => {
    attempts.current = [
      getOnboarding().continueStep(),
      getOnboarding().continueStep(),
    ]
  })

  expect(submitApplicant).toHaveBeenCalledTimes(1)
  expect(getOnboarding().state.submission).toBe('pending')
  const resolveRequest = request.resolve
  const pendingAttempts = attempts.current
  if (resolveRequest === null || pendingAttempts === null) {
    throw new Error('Pending applicant submission was not captured')
  }
  await act(async () => {
    resolveRequest({ ok: true })
    await expect(Promise.all(pendingAttempts)).resolves.toEqual([true, false])
  })

  expect(submitApplicant).toHaveBeenCalledTimes(1)
  expect(getOnboarding().state.submission).toBe('idle')
  expect(getOnboarding().state.completed).toBe(true)
  expect(getOnboarding().state.gatewayError).toBeNull()
})
