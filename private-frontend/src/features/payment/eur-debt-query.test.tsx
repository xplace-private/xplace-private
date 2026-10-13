import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { EurDebtGateway } from './api/eur-debt-gateway'
import { createHttpEurDebtGateway } from './api/http-eur-debt-gateway'
import { createApiClient } from '../../shared/api/api-client'
import { EUR_DEBT_QUERY_KEY, useEurDebt } from './eur-debt-query'

// Query's interval scheduler must see a browser when its module initializes.
vi.hoisted(() => {
  Object.assign(globalThis, { window: { HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {} } })
})

let root: Root
let client: QueryClient
let current: ReturnType<typeof useEurDebt>

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const ownerDocument = {
    nodeType: 9, documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
    addEventListener() {}, removeEventListener() {},
  }
  root = createRoot({
    nodeType: 1, nodeName: 'DIV', tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument, addEventListener() {}, removeEventListener() {},
  } as unknown as Element)
})

afterEach(() => {
  act(() => root.unmount())
  client.clear()
  focusManager.setFocused(undefined)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount(gateway: EurDebtGateway) {
  function Probe() { current = useEurDebt(gateway); return null }
  await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>))
  await tick(1)
}

async function tick(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms))
}

const quote = { fxRate: '0.92590760', amountEurCents: 92593, amountUsdCents: 100000 }

test('requests the quote on entering Payment without waiting for deposit accounts', async () => {
  const get = vi.fn().mockResolvedValue({ ok: true, data: quote })
  await mount({ get })
  expect(get).toHaveBeenCalledTimes(1)
  expect(current.state).toEqual({ status: 'ready', quote })
})

test('keeps the loaded quote without refetching when returning to the browser tab', async () => {
  const get = vi.fn().mockResolvedValue({ ok: true, data: quote })
  await mount({ get })
  await act(async () => { focusManager.setFocused(false) })
  await act(async () => { focusManager.setFocused(true) })
  await tick(1)
  expect(get).toHaveBeenCalledTimes(1)
  expect(current.state).toEqual({ status: 'ready', quote })
})

test('keeps loading during ordinary HTTP retries and publishes the recovered quote', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValue(Response.json({ fx_rate: '0.92590760', amount_eur: '925.93', amount_usd: '1000.00' }))
  await mount(createHttpEurDebtGateway(createApiClient({ baseUrl: 'https://backend.example.test/api/v1', fetch })))
  expect(current.state).toEqual({ status: 'loading' })
  await tick(1000)
  expect(current.state).toEqual({ status: 'ready', quote })
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('does not display an old quote while refreshing or after the refresh fails', async () => {
  const get = vi.fn().mockResolvedValueOnce({ ok: true, data: quote })
    .mockResolvedValue({ ok: false, code: 'eur-debt-failed', message: 'Safe error' })
  await mount({ get })
  expect(current.state.status).toBe('ready')
  await act(async () => { await client.invalidateQueries({ queryKey: EUR_DEBT_QUERY_KEY }) })
  await tick(1)
  expect(current.state).toEqual({ status: 'error' })
})

test('cancels a hung quote request when the payment screen is left', async () => {
  const get = vi.fn<EurDebtGateway['get']>(() => new Promise<never>(() => {}))
  await mount({ get })
  expect(current.state).toEqual({ status: 'loading' })
  act(() => root.unmount())
  expect(get.mock.calls[0]?.[0]?.aborted).toBe(true)
})
