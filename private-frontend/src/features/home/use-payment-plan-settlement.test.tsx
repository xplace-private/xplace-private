import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { usePaymentPlanSettlement } from './use-payment-plan-settlement'

vi.mock('./payment-plan-notifications', () => ({
  showPaymentPlanSettledToast: vi.fn(),
}))

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

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
const browserGlobal = globalThis as unknown as {
  window?: {
    event?: Event
    HTMLIFrameElement: new () => object
  }
}

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
})

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
  delete browserGlobal.window
})

test('keeps confirmation open while settlement is pending and closes it after success', async () => {
  const pendingSettlement = deferredResult<GatewayResult>()
  let settlement: ReturnType<typeof usePaymentPlanSettlement> | null = null

  function Probe() {
    settlement = usePaymentPlanSettlement(() => pendingSettlement.promise)
    return null
  }

  function currentSettlement() {
    if (settlement === null) throw new Error('Settlement hook was not captured')
    return settlement
  }

  const root = createRoot(createEmptyReactContainer())
  act(() => root.render(<Probe />))

  act(() => currentSettlement().open('plan-emirates'))
  let request!: Promise<void>
  act(() => {
    request = currentSettlement().settle()
  })

  expect(currentSettlement().isSubmitting).toBe(true)
  act(() => currentSettlement().close())
  expect(currentSettlement().planId).toBe('plan-emirates')

  pendingSettlement.resolve({ ok: true })
  await act(async () => request)

  expect(currentSettlement().isSubmitting).toBe(false)
  expect(currentSettlement().planId).toBeNull()
  act(() => root.unmount())
})

test('keeps confirmation open with a safe gateway failure', async () => {
  let settlement: ReturnType<typeof usePaymentPlanSettlement> | null = null

  function Probe() {
    settlement = usePaymentPlanSettlement(() =>
      Promise.resolve({
        ok: false,
        code: 'settle-failed',
        message: 'Unable to settle this plan. Try again.',
      }),
    )
    return null
  }

  function currentSettlement() {
    if (settlement === null) throw new Error('Settlement hook was not captured')
    return settlement
  }

  const root = createRoot(createEmptyReactContainer())
  act(() => root.render(<Probe />))
  act(() => currentSettlement().open('plan-emirates'))
  await act(async () => {
    await currentSettlement().settle()
  })

  expect(currentSettlement().planId).toBe('plan-emirates')
  expect(currentSettlement().error).toBe(
    'Unable to settle this plan. Try again.',
  )
  act(() => root.unmount())
})
