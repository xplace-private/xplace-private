import { afterEach, expect, test, vi } from 'vitest'

import { createApiClient } from '../../../shared/api/api-client'
import { createHttpEurDebtGateway } from './http-eur-debt-gateway'

// Worked example from the backend's private statement payment contract tests.
const quote = { fx_rate: '0.92590760', amount_eur: '925.93', amount_usd: '1000.00' }

afterEach(() => { vi.useRealTimers() })

test('uses the common GET retry budget for a temporary provider failure', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response('{}', { status: 503 }))
  const result = createHttpEurDebtGateway(createApiClient({ baseUrl: 'https://backend.example.test/api/v1', fetch })).get()
  await vi.runAllTimersAsync()
  expect(await result).toMatchObject({ ok: false, code: 'eur-debt-failed' })
  expect(fetch).toHaveBeenCalledTimes(11)
})

test('does not retry a missing EUR account, like other GET requests', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response('{}', { status: 400 }))
  expect(await createHttpEurDebtGateway(createApiClient({ baseUrl: 'https://backend.example.test/api/v1', fetch })).get())
    .toMatchObject({ ok: false, code: 'eur-debt-failed' })
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('loads the authenticated Iron quote and preserves the provider rounding and rate precision', async () => {
  const request = vi.fn().mockResolvedValue(quote)
  const signal = new AbortController().signal
  expect(await createHttpEurDebtGateway({ request }).get(signal)).toEqual({
    ok: true, data: { fxRate: '0.92590760', amountEurCents: 92593, amountUsdCents: 100000 },
  })
  expect(request).toHaveBeenCalledWith('cards/private/eur-debt/', {
    authenticated: true, signal,
  })
})

test('preserves zero debt with a live rate', async () => {
  expect(await createHttpEurDebtGateway({ request: async () => ({
    ...quote, amount_eur: '0.00', amount_usd: '0.00',
  }) }).get()).toMatchObject({ ok: true, data: { amountEurCents: 0, amountUsdCents: 0 } })
})

test.each([
  null, [], {},
  { ...quote, fx_rate: null }, { ...quote, fx_rate: 0.92590760 },
  { ...quote, fx_rate: '0.00000000' }, { ...quote, fx_rate: '-0.92590760' },
  { ...quote, fx_rate: 'Infinity' }, { ...quote, fx_rate: '1e8' },
  { ...quote, amount_eur: null }, { ...quote, amount_eur: 925.93 },
  { ...quote, amount_eur: '-925.93' }, { ...quote, amount_eur: '925.931' },
  { ...quote, amount_usd: undefined }, { ...quote, amount_usd: 'invalid' },
  { ...quote, amount_usd: '9999999999999999.00' },
])('rejects malformed quote data without inventing payment amounts: %j', async (body) => {
  expect(await createHttpEurDebtGateway({ request: async () => body }).get()).toMatchObject({
    ok: false, code: 'eur-debt-failed',
  })
})

test('keeps provider and network errors out of the result', async () => {
  const result = await createHttpEurDebtGateway({ request: async () => {
    throw new Error('private provider error')
  } }).get()
  expect(result).toMatchObject({ ok: false, code: 'eur-debt-failed' })
  expect(JSON.stringify(result)).not.toContain('private provider error')
})
