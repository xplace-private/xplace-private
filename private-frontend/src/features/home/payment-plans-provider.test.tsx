import { act, useLayoutEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'

import type { GatewayResult } from '../../shared/api/gateway-result'
import type { PaymentPlansGateway } from './api/payment-plans-gateway'
import type { PaymentPlan, StartPaymentPlanInput } from './model/payment-plan'
import {
  PaymentPlansProvider,
  usePaymentPlans,
} from './payment-plans-provider'

const input: StartPaymentPlanInput = {
  transactionId: 'emirates',
  merchant: 'Emirates Airlines',
  currency: 'USD',
  principalCents: 284000,
  termMonths: 6,
}

const otherInput: StartPaymentPlanInput = {
  ...input,
  transactionId: 'hotel',
  merchant: 'The Ned',
}

const plan: PaymentPlan = {
  ...input,
  id: 'plan-emirates',
  aprBasisPoints: 1800,
  feeCents: 25560,
  totalRepayableCents: 309560,
  monthlyPaymentCents: 51593,
  paidInstallments: 0,
  startedAt: '2026-08-19T00:00:00.000Z',
}

function deferredResult<Result>() {
  let resolve!: (value: Result) => void
  const promise = new Promise<Result>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
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

const mountedRoots: ReturnType<typeof createRoot>[] = []

beforeEach(() => {
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { event?: Event; HTMLIFrameElement: new () => object }
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
})

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT
  delete (globalThis as unknown as { window?: unknown }).window
})

async function mountProvider(gateway: PaymentPlansGateway, enabled = true) {
  let value: ReturnType<typeof usePaymentPlans> | null = null

  function Probe({
    onLayout,
  }: {
    onLayout?: ((paymentPlans: ReturnType<typeof usePaymentPlans>) => void) | undefined
  }) {
    const paymentPlans = usePaymentPlans()
    value = paymentPlans
    const invokedLayoutRef = useRef<typeof onLayout>(undefined)

    useLayoutEffect(() => {
      if (onLayout === undefined || invokedLayoutRef.current === onLayout) return

      invokedLayoutRef.current = onLayout
      onLayout(paymentPlans)
    }, [onLayout, paymentPlans])

    return null
  }

  function CommitProbe({ onLayout }: { onLayout: () => void }) {
    const invokedRef = useRef(false)

    useLayoutEffect(() => {
      if (invokedRef.current) return

      invokedRef.current = true
      onLayout()
    }, [onLayout])

    return null
  }

  const root = createRoot(createEmptyReactContainer())
  mountedRoots.push(root)
  await act(async () => {
    root.render(
      <PaymentPlansProvider gateway={gateway} enabled={enabled}>
        <Probe />
      </PaymentPlansProvider>,
    )
  })

  return {
    get value(): ReturnType<typeof usePaymentPlans> {
      if (value === null) throw new Error('Provider value was not captured')
      return value
    },
    async render(
      nextGateway: PaymentPlansGateway,
      onLayout?: (paymentPlans: ReturnType<typeof usePaymentPlans>) => void,
      nextEnabled = true,
    ) {
      await act(async () => {
        root.render(
          <PaymentPlansProvider gateway={nextGateway} enabled={nextEnabled}>
            <Probe onLayout={onLayout} />
          </PaymentPlansProvider>,
        )
      })
    },
    async remove(onLayout: () => void) {
      await act(async () => {
        root.render(<CommitProbe onLayout={onLayout} />)
      })
    },
  }
}

test('blocks start and settle while the initial list request is pending', async () => {
  const pendingList = deferredResult<GatewayResult<readonly PaymentPlan[]>>()
  let startCalls = 0
  let settleCalls = 0
  const gateway: PaymentPlansGateway = {
    list: () => pendingList.promise,
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => {
      settleCalls += 1
      return Promise.resolve({ ok: true })
    },
  }
  const provider = await mountProvider(gateway)

  await expect(provider.value.startPlan(input)).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  await expect(provider.value.settlePlan(plan.id)).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(startCalls).toBe(0)
  expect(settleCalls).toBe(0)

  await act(async () => {
    pendingList.resolve({ ok: true, data: [] })
    await pendingList.promise
  })
  await expect(provider.value.startPlan(input)).resolves.toEqual({ ok: true, data: plan })
})

test('does not revive start and settle callbacks rendered during initial loading', async () => {
  const pendingList = deferredResult<GatewayResult<readonly PaymentPlan[]>>()
  let startCalls = 0
  let settleCalls = 0
  const gateway: PaymentPlansGateway = {
    list: () => pendingList.promise,
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => {
      settleCalls += 1
      return Promise.resolve({ ok: true })
    },
  }
  const provider = await mountProvider(gateway)
  const loadingStartPlan = provider.value.startPlan
  const loadingSettlePlan = provider.value.settlePlan

  await act(async () => {
    pendingList.resolve({ ok: true, data: [plan] })
    await pendingList.promise
  })

  let startResult: GatewayResult<PaymentPlan> | null = null
  let settleResult: GatewayResult | null = null
  await act(async () => {
    startResult = await loadingStartPlan(otherInput)
    settleResult = await loadingSettlePlan(plan.id)
  })
  expect(startResult).toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(settleResult).toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(startCalls).toBe(0)
  expect(settleCalls).toBe(0)
})

test('keeps mutations unavailable and exposes a safe initial load failure', async () => {
  let startCalls = 0
  const gateway: PaymentPlansGateway = {
    list: () =>
      Promise.resolve({
        ok: false,
        code: 'list-unavailable',
        message: 'Unable to load payment plans. Try again.',
      }),
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(gateway)

  expect(provider.value.state).toMatchObject({
    status: 'load-failed',
    plans: [],
    loadError: 'Unable to load payment plans. Try again.',
    mutationError: null,
  })
  await expect(provider.value.startPlan(input)).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(startCalls).toBe(0)
})

test('rejects a duplicate start when the initial response already owns the transaction', async () => {
  let startCalls = 0
  const gateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [plan] }),
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(gateway)

  await expect(provider.value.startPlan(input)).resolves.toEqual({
    ok: false,
    code: 'plan-already-active',
    message: 'This transaction already has a payment plan.',
  })
  expect(startCalls).toBe(0)
  expect(provider.value.state.plans).toEqual([plan])
})

test('blocks mutations until a replacement gateway list succeeds', async () => {
  const replacementList = deferredResult<GatewayResult<readonly PaymentPlan[]>>()
  let startCalls = 0
  let settleCalls = 0
  const firstGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [plan] }),
    start: () => Promise.resolve({ ok: true, data: plan }),
    settle: () => Promise.resolve({ ok: true }),
  }
  const replacementGateway: PaymentPlansGateway = {
    list: () => replacementList.promise,
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => {
      settleCalls += 1
      return Promise.resolve({ ok: true })
    },
  }
  const provider = await mountProvider(firstGateway)

  expect(provider.value.state).toMatchObject({ status: 'ready', plans: [plan] })
  await provider.render(replacementGateway)

  expect(provider.value.state.status).toBe('loading')
  await expect(provider.value.startPlan(input)).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  await expect(provider.value.settlePlan(plan.id)).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(startCalls).toBe(0)
  expect(settleCalls).toBe(0)

  await act(async () => {
    replacementList.resolve({ ok: true, data: [plan] })
    await replacementList.promise
  })
  expect(provider.value.state).toMatchObject({ status: 'ready', plans: [plan] })
})

test('does not revive start and settle callbacks rendered during replacement loading', async () => {
  const replacementList = deferredResult<GatewayResult<readonly PaymentPlan[]>>()
  let startCalls = 0
  let settleCalls = 0
  const firstGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => Promise.resolve({ ok: true, data: plan }),
    settle: () => Promise.resolve({ ok: true }),
  }
  const replacementGateway: PaymentPlansGateway = {
    list: () => replacementList.promise,
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => {
      settleCalls += 1
      return Promise.resolve({ ok: true })
    },
  }
  const provider = await mountProvider(firstGateway)

  await provider.render(replacementGateway)
  const loadingStartPlan = provider.value.startPlan
  const loadingSettlePlan = provider.value.settlePlan
  await act(async () => {
    replacementList.resolve({ ok: true, data: [plan] })
    await replacementList.promise
  })

  let startResult: GatewayResult<PaymentPlan> | null = null
  let settleResult: GatewayResult | null = null
  await act(async () => {
    startResult = await loadingStartPlan(otherInput)
    settleResult = await loadingSettlePlan(plan.id)
  })
  expect(startResult).toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(settleResult).toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(startCalls).toBe(0)
  expect(settleCalls).toBe(0)
})

test('blocks replacement-gateway mutations during commit before passive effects', async () => {
  const replacementList = deferredResult<GatewayResult<readonly PaymentPlan[]>>()
  let startCalls = 0
  let settleCalls = 0
  let layoutResults: Promise<readonly [GatewayResult<PaymentPlan>, GatewayResult]> | null =
    null
  const firstGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => Promise.resolve({ ok: true, data: plan }),
    settle: () => Promise.resolve({ ok: true }),
  }
  const replacementGateway: PaymentPlansGateway = {
    list: () => replacementList.promise,
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => {
      settleCalls += 1
      return Promise.resolve({ ok: true })
    },
  }
  const provider = await mountProvider(firstGateway)

  await provider.render(replacementGateway, (paymentPlans) => {
    layoutResults = Promise.all([
      paymentPlans.startPlan(input),
      paymentPlans.settlePlan(plan.id),
    ])
  })
  if (layoutResults === null) throw new Error('Layout mutations were not captured')

  await expect(layoutResults).resolves.toEqual([
    expect.objectContaining({ ok: false, code: 'plans-not-ready' }),
    expect.objectContaining({ ok: false, code: 'plans-not-ready' }),
  ])
  expect(startCalls).toBe(0)
  expect(settleCalls).toBe(0)
})

test('blocks a previous-gateway callback after replacement commit', async () => {
  const replacementList = deferredResult<GatewayResult<readonly PaymentPlan[]>>()
  let previousStartCalls = 0
  let layoutResult: Promise<GatewayResult<PaymentPlan>> | null = null
  const firstGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => {
      previousStartCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => Promise.resolve({ ok: true }),
  }
  const replacementGateway: PaymentPlansGateway = {
    list: () => replacementList.promise,
    start: () => Promise.resolve({ ok: true, data: plan }),
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(firstGateway)
  const previousStartPlan = provider.value.startPlan

  await provider.render(replacementGateway, () => {
    layoutResult = previousStartPlan(input)
  })
  if (layoutResult === null) throw new Error('Previous callback result was not captured')

  await expect(layoutResult).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(previousStartCalls).toBe(0)
})

test('does not revive a callback captured before the replacement list completes', async () => {
  const replacementList = deferredResult<GatewayResult<readonly PaymentPlan[]>>()
  let replacementStartCalls = 0
  let preListStartPlan: ReturnType<typeof usePaymentPlans>['startPlan'] | null = null
  const firstGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => Promise.resolve({ ok: true, data: plan }),
    settle: () => Promise.resolve({ ok: true }),
  }
  const replacementGateway: PaymentPlansGateway = {
    list: () => replacementList.promise,
    start: () => {
      replacementStartCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(firstGateway)

  await provider.render(replacementGateway, (paymentPlans) => {
    preListStartPlan = paymentPlans.startPlan
  })
  await act(async () => {
    replacementList.resolve({ ok: true, data: [] })
    await replacementList.promise
  })
  if (preListStartPlan === null) throw new Error('Pre-list callback was not captured')
  const capturedPreListStartPlan = preListStartPlan as ReturnType<
    typeof usePaymentPlans
  >['startPlan']

  await expect(capturedPreListStartPlan(input)).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(replacementStartCalls).toBe(0)
})

test('does not revive a callback across an enabled session cycle', async () => {
  let startCalls = 0
  const gateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(gateway)
  const firstSessionStartPlan = provider.value.startPlan

  await provider.render(gateway, undefined, false)
  await provider.render(gateway)

  await expect(firstSessionStartPlan(input)).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(startCalls).toBe(0)
})

test('does not revive an old callback when gateway identity cycles back', async () => {
  let firstGatewayStartCalls = 0
  const firstGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => {
      firstGatewayStartCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => Promise.resolve({ ok: true }),
  }
  const secondGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => Promise.resolve({ ok: true, data: plan }),
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(firstGateway)
  const originalStartPlan = provider.value.startPlan

  await provider.render(secondGateway)
  await provider.render(firstGateway)

  await expect(originalStartPlan(input)).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(firstGatewayStartCalls).toBe(0)
})

test('invalidates retained callbacks during provider removal commit', async () => {
  let startCalls = 0
  let removalResult: Promise<GatewayResult<PaymentPlan>> | null = null
  const gateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(gateway)
  const retainedStartPlan = provider.value.startPlan

  await provider.remove(() => {
    removalResult = retainedStartPlan(input)
  })
  if (removalResult === null) throw new Error('Removal callback was not captured')

  await expect(removalResult).resolves.toMatchObject({
    ok: false,
    code: 'plans-not-ready',
  })
  expect(startCalls).toBe(0)
})

test('uses current plans when an earlier callback checks for a duplicate start', async () => {
  let startCalls = 0
  const gateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => {
      startCalls += 1
      return Promise.resolve({ ok: true, data: plan })
    },
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(gateway)
  const prePlanStartPlan = provider.value.startPlan

  await act(async () => {
    await provider.value.startPlan(input)
  })
  await expect(prePlanStartPlan(input)).resolves.toEqual({
    ok: false,
    code: 'plan-already-active',
    message: 'This transaction already has a payment plan.',
  })
  expect(startCalls).toBe(1)
})

test('uses current plans when an earlier callback checks settlement existence', async () => {
  let settleCalls = 0
  const gateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [plan] }),
    start: () => Promise.resolve({ ok: true, data: plan }),
    settle: () => {
      settleCalls += 1
      return Promise.resolve({ ok: true })
    },
  }
  const provider = await mountProvider(gateway)
  const activePlanSettle = provider.value.settlePlan

  await act(async () => {
    await provider.value.settlePlan(plan.id)
  })
  await expect(activePlanSettle(plan.id)).resolves.toEqual({
    ok: false,
    code: 'plan-not-active',
    message: 'This payment plan is no longer active.',
  })
  expect(settleCalls).toBe(1)
})

test('returns user-safe typed results and blocks concurrent mutations', async () => {
  const pendingStart = deferredResult<GatewayResult<PaymentPlan>>()
  const gateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => pendingStart.promise,
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(gateway)

  const first = provider.value.startPlan(input)
  await expect(provider.value.settlePlan(plan.id)).resolves.toEqual({
    ok: false,
    code: 'request-pending',
    message: 'A payment plan update is already in progress.',
  })

  pendingStart.resolve({ ok: true, data: plan })
  await expect(first).resolves.toEqual({ ok: true, data: plan })
  await expect(provider.value.settlePlan(plan.id)).resolves.toEqual({ ok: true })
})

test('ignores an in-flight mutation completion after a session reset', async () => {
  const pendingStart = deferredResult<GatewayResult<PaymentPlan>>()
  const gateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => pendingStart.promise,
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(gateway)

  const staleRequest = provider.value.startPlan(input)
  act(() => provider.value.resetSession())
  pendingStart.resolve({ ok: true, data: plan })
  await act(async () => {
    await staleRequest
  })

  expect(provider.value.state).toMatchObject({ status: 'loading', plans: [] })
})

test('maps rejected gateway operations without exposing raw errors', async () => {
  const gateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => Promise.reject(new Error('database password leaked')),
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(gateway)

  await expect(provider.value.startPlan(input)).resolves.toEqual({
    ok: false,
    code: 'unexpected-error',
    message: 'Unable to update the plan. Try again.',
  })
})

test('invalidates an in-flight mutation when the gateway lifecycle changes', async () => {
  const pendingStart = deferredResult<GatewayResult<PaymentPlan>>()
  const firstGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => pendingStart.promise,
    settle: () => Promise.resolve({ ok: true }),
  }
  const replacementGateway: PaymentPlansGateway = {
    list: () => Promise.resolve({ ok: true, data: [] }),
    start: () => Promise.resolve({ ok: true, data: plan }),
    settle: () => Promise.resolve({ ok: true }),
  }
  const provider = await mountProvider(firstGateway)
  const providerValue = provider.value
  const staleRequest = providerValue.startPlan(input)

  await provider.render(replacementGateway)
  pendingStart.resolve({ ok: true, data: plan })
  await act(async () => {
    await staleRequest
  })

  expect(provider.value.state.plans).toEqual([])
})
