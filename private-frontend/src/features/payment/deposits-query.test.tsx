import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { BankDeposit, CryptoDeposit, DepositChannels, DepositsGateway } from './api/deposits-gateway'
import { createHttpDepositsGateway } from './api/http-deposits-gateway'
import { useDeposits } from './deposits-query'
import { PaymentScreen } from './payment-screen'

// Query's interval scheduler must see a browser when its module initializes.
vi.hoisted(() => {
  Object.assign(globalThis, { window: { HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {} } })
})

const ready: BankDeposit = {
  id: 'ach', status: 'Approved', sourceCurrency: 'usd', acceptsThirdPartyDeposits: false,
  instructions: {
    paymentRail: 'ach', beneficiaryName: 'Account Holder',
    accountNumber: '00123456789', routingNumber: '021000021',
    bankName: null, bankAddress: null, beneficiaryAddress: null,
  },
}
let root: Root
let client: QueryClient
let current: ReturnType<typeof useDeposits>

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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount(gateway: DepositsGateway) {
  function Probe() { current = useDeposits(gateway); return null }
  await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>))
  await tick(1)
}

async function tick(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms))
}

const crypto: CryptoDeposit = {
  id: 'crypto', status: 'Approved',
  instructions: { address: '0xSANDBOX110000000DoNotSend0000000000', asset: 'USDC', network: 'ERC-20' },
}
const eur: BankDeposit = {
  ...ready, id: 'sepa', sourceCurrency: 'eur',
  instructions: {
    paymentRail: 'sepa', beneficiaryName: 'EUR Holder',
    iban: 'DE89370400440532013000', bic: null, reference: null,
    bankName: null, bankAddress: null, beneficiaryAddress: null,
  },
}
const empty: DepositChannels = { bank: [], crypto: [] }
const both: DepositChannels = { bank: [ready, eur], crypto: [crypto] }
const success = (data: DepositChannels) => ({ ok: true as const, data })

test('keeps EUR usable from the raw API response through a polling failure and later USD/USDC arrival', async () => {
  const rawEur = {
    id: 'sepa', provider: 'iron', status: 'Approved', source_currency: 'eur',
    target_currency: 'usdc', accepts_third_party_deposits: true,
    deposit_instructions: {
      payment_rail: 'sepa', beneficiary_name: 'EUR Holder', iban: 'DE89370400440532013000',
    },
  }
  const rawUsd = {
    ...rawEur, id: 'swift', source_currency: 'usd',
    deposit_instructions: {
      payment_rail: 'swift', beneficiary_name: 'USD Holder', account_number: '00001234',
    },
  }
  const rawCrypto = {
    ...rawEur, id: 'crypto', source_currency: 'usdc',
    deposit_instructions: { payment_rail: 'crypto', type: 'Ethereum', address: '0xAPI-wallet' },
  }
  const request = vi.fn()
    .mockResolvedValueOnce([rawEur])
    .mockRejectedValueOnce(new Error('Provider error must stay hidden'))
    .mockResolvedValue([rawCrypto, rawEur, rawUsd])
  const screen = () => renderToStaticMarkup(<PaymentScreen
    details={{ statement: { balance: 'USD 123.45', statementDate: '18 Oct' } }}
    bankDeposits={current.bank} eurDeposits={current.eur} cryptoDeposits={current.crypto} />)
  await mount(createHttpDepositsGateway({ request }))
  for (let step = 0; step < 2; step++) {
    expect(current.bank).toEqual({ status: 'loading', deposits: [] })
    expect(current.eur).toEqual({ status: 'ready', deposits: [{ ...eur, acceptsThirdPartyDeposits: true }] })
    expect(current.crypto).toEqual({ status: 'loading', details: null })
    const html = screen()
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*><span[^>]*>EUR<\/span><\/button>/)
    expect(html).toContain('EUR Holder')
    expect(html).toContain('DE89370400440532013000')
    expect(html).not.toContain('Provider error')
    expect(html).not.toContain('animate-pulse')
    await tick(5000)
  }
  expect(current.bank.status).toBe('ready')
  expect(current.eur.status).toBe('ready')
  expect(current.crypto.details?.address).toBe('0xAPI-wallet')
  const html = screen()
  expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*><span[^>]*>USD<\/span><\/button>/)
  expect(html).toContain('USD Holder')
  expect(html).toContain('00001234')
  expect(html).not.toContain('EUR Holder')
  await tick(180000)
  expect(request).toHaveBeenCalledTimes(3)
})

test.each(['usd', 'eur'] as const)('stops polling with crypto and ready %s without waiting for the other bank account', async (currency) => {
  const deposit = currency === 'usd' ? ready : eur
  const list = vi.fn().mockResolvedValue(success({ bank: [deposit], crypto: [crypto] }))
  await mount({ list })
  expect(current[currency === 'usd' ? 'bank' : 'eur']).toEqual({ status: 'ready', deposits: [deposit] })
  expect(current.crypto).toEqual({ status: 'ready', details: crypto.instructions })
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(1)
})

test('keeps polling with two bank accounts until crypto arrives or times out', async () => {
  const list = vi.fn().mockResolvedValue(success({ bank: [ready, eur], crypto: [] }))
  await mount({ list })
  await tick(5000)
  expect(current.crypto.status).toBe('loading')
  expect(list).toHaveBeenCalledTimes(2)
  await tick(120000)
  expect(current.eur).toEqual({ status: 'ready', deposits: [eur] })
  expect(current.bank.status).toBe('ready')
  expect(current.crypto.status).toBe('timed-out')
  const calls = list.mock.calls.length
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(calls)
})

test.each(['eur', 'crypto'] as const)('stops after the missing partner arrives when only %s was ready and USD never arrives', async (first) => {
  const list = vi.fn().mockResolvedValueOnce(success({
    bank: first === 'eur' ? [eur] : [], crypto: first === 'crypto' ? [crypto] : [],
  })).mockResolvedValue(success({ bank: [eur], crypto: [crypto] }))
  await mount({ list })
  expect(current[first].status).toBe('ready')
  expect(current[first === 'eur' ? 'crypto' : 'eur'].status).toBe('loading')
  await tick(5000)
  expect(current.eur).toEqual({ status: 'ready', deposits: [eur] })
  expect(current.crypto).toEqual({ status: 'ready', details: crypto.instructions })
  expect(current.bank.deposits).toEqual([])
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(2)
})

test('preserves ready EUR through errors while USD and crypto time out', async () => {
  const list = vi.fn().mockResolvedValueOnce(success({ bank: [eur], crypto: [] }))
    .mockResolvedValue({ ok: false, code: 'deposits-failed', message: 'Safe error' })
  await mount({ list })
  await tick(120000)
  expect(current.eur).toEqual({ status: 'ready', deposits: [eur] })
  expect(current.bank.status).toBe('timed-out')
  expect(current.crypto.status).toBe('timed-out')
})

test.each(['bank', 'crypto'] as const)('keeps polling when only %s is ready and stops when both arrive', async (first) => {
  const partial = { ...empty, [first]: both[first] }
  const list = vi.fn().mockResolvedValueOnce(success(partial)).mockResolvedValue(success(both))
  await mount({ list })
  expect(current[first].status).toBe('ready')
  expect(current[first === 'bank' ? 'crypto' : 'bank'].status).toBe('loading')
  await tick(4998)
  expect(list).toHaveBeenCalledTimes(1)
  await tick(2)
  expect(current.bank.status).toBe('ready')
  expect(current.crypto.status).toBe('ready')
  expect(current.crypto.details).toEqual(crypto.instructions)
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(2)
})

test('treats activated Bridge SWIFT and active Bridge crypto as ready', async () => {
  const swift: BankDeposit = {
    ...ready,
    status: 'activated',
    instructions: {
      paymentRail: 'swift', beneficiaryName: 'Igor Private', beneficiaryAddress: null,
      accountNumber: '8848841589', iban: null, bic: 'IRONUS33XXX',
      bankName: 'Iron Bank', bankAddress: null, reference: null,
    },
  }
  await mount({ list: async () => success({
    bank: [swift],
    crypto: [{ ...crypto, status: 'active' }],
  }) })

  expect(current.bank).toEqual({ status: 'ready', deposits: [swift] })
  expect(current.crypto).toEqual({ status: 'ready', details: crypto.instructions })
})

test.each(['bank', 'crypto'] as const)('preserves ready %s after the other method times out', async (available) => {
  const list = vi.fn().mockResolvedValue(success({ ...empty, [available]: both[available] }))
  await mount({ list })
  await tick(119998)
  expect(current[available === 'bank' ? 'crypto' : 'bank'].status).toBe('loading')
  await tick(1)
  expect(current[available].status).toBe('ready')
  expect(current[available === 'bank' ? 'crypto' : 'bank'].status).toBe('timed-out')
  if (available === 'bank') expect(current.bank.deposits).toEqual([ready])
  else expect(current.crypto.details).toEqual(crypto.instructions)
  const calls = list.mock.calls.length
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(calls)
})

test('aborts a hung request at two minutes and ignores its late response', async () => {
  let resolve!: (value: { ok: true; data: DepositChannels }) => void
  const list = vi.fn<DepositsGateway['list']>(() => new Promise((done) => { resolve = done }))
  await mount({ list })
  await tick(119998)
  expect(current.bank.status).toBe('loading')
  expect(current.crypto.status).toBe('loading')
  await tick(1)
  expect(list.mock.calls[0]?.[0]?.aborted).toBe(true)
  await act(async () => resolve(success(both)))
  await tick(180000)
  expect(current.bank).toEqual({ status: 'timed-out', deposits: [] })
  expect(current.crypto).toEqual({ status: 'timed-out', details: null })
  expect(list).toHaveBeenCalledTimes(1)
})

test('empty responses time out both methods', async () => {
  const list = vi.fn().mockResolvedValue(success(empty))
  await mount({ list })
  await tick(120000)
  expect(current.bank.status).toBe('timed-out')
  expect(current.crypto.status).toBe('timed-out')
  const calls = list.mock.calls.length
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(calls)
})

test.each([
  { ...ready, status: 'Authorized' },
  { ...ready, status: 'DepositAccountAdded' },
  { ...ready, instructions: null },
  { ...ready, instructions: { ...ready.instructions!, accountNumber: '' } },
])('keeps incomplete/unapproved bank instructions hidden', async (deposit) => {
  await mount({ list: async () => success({ bank: [deposit], crypto: [] }) })
  expect(current.bank).toEqual({ status: 'loading', deposits: [] })
})

test.each([
  { ...eur, status: 'Authorized' },
  { ...eur, status: 'DepositAccountAdded' },
  { ...eur, instructions: null },
  { ...eur, instructions: { ...eur.instructions!, beneficiaryName: '' } },
  { ...eur, instructions: { ...eur.instructions!, iban: ' ' } },
])('keeps incomplete/unapproved EUR instructions hidden', async (deposit) => {
  await mount({ list: async () => success({ bank: [ready, deposit], crypto: [crypto] }) })
  expect(current.eur).toEqual({ status: 'loading', deposits: [] })
  expect(current.bank.status).toBe('ready')
  expect(current.crypto.status).toBe('ready')
})

test.each([
  { ...crypto, status: 'Authorized' },
  { ...crypto, status: 'Rejected' },
  { ...crypto, instructions: null },
  { ...crypto, instructions: { ...crypto.instructions!, address: ' ' } },
])('never exposes incomplete/unapproved crypto addresses', async (deposit) => {
  await mount({ list: async () => success({ bank: [ready], crypto: [deposit] }) })
  expect(current.bank.status).toBe('ready')
  expect(current.crypto.details).toBeNull()
})

test.each(['compliance_hold', 'Rejected', 'Cancelled', 'unknown'])('does not expose %s bank accounts while continuing to wait for crypto', async (status) => {
  const list = vi.fn().mockResolvedValue(success({ bank: [{ ...ready, status }], crypto: [] }))
  await mount({ list })
  expect(current.bank).toEqual({ status: 'unavailable', deposits: [] })
  expect(current.crypto.status).toBe('loading')
  await tick(5000)
  expect(list).toHaveBeenCalledTimes(2)
})

test('keeps polling through an error and recovers automatically', async () => {
  const list = vi.fn().mockResolvedValueOnce({ ok: false, code: 'deposits-failed', message: 'Safe error' })
    .mockResolvedValue(success(both))
  await mount({ list })
  expect(current.bank.status).toBe('loading')
  expect(current.crypto.status).toBe('loading')
  await tick(5000)
  expect(current.bank.status).toBe('ready')
  expect(current.crypto.status).toBe('ready')
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(2)
})

test.each(['failure result', 'rejected request'])('includes %s in the original two-minute deadline', async (kind) => {
  const list = kind === 'failure result'
    ? vi.fn().mockResolvedValue({ ok: false, code: 'deposits-failed', message: 'Safe error' })
    : vi.fn().mockRejectedValue(new Error('Network unavailable'))
  await mount({ list })
  await tick(119998)
  expect(current.bank.status).toBe('loading')
  expect(current.crypto.status).toBe('loading')
  expect(list.mock.calls.length).toBeGreaterThan(1)
  await tick(1)
  expect(current.bank.status).toBe('timed-out')
  expect(current.crypto.status).toBe('timed-out')
  const calls = list.mock.calls.length
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(calls)
})

test.each(['bank', 'crypto'] as const)('preserves ready %s through errors while the other method times out', async (available) => {
  const list = vi.fn().mockResolvedValueOnce(success({ ...empty, [available]: both[available] }))
    .mockResolvedValue({ ok: false, code: 'deposits-failed', message: 'Safe error' })
  await mount({ list })
  await tick(5000)
  expect(current[available].status).toBe('ready')
  await tick(114999)
  expect(current[available].status).toBe('ready')
  expect(current[available === 'bank' ? 'crypto' : 'bank'].status).toBe('timed-out')
})

test('aborts the request and removes timers on leaving the page', async () => {
  const list = vi.fn<DepositsGateway['list']>(() => new Promise<never>(() => {}))
  await mount({ list })
  act(() => root.unmount())
  expect(list.mock.calls[0]?.[0]?.aborted).toBe(true)
  await tick(180000)
  expect(list).toHaveBeenCalledTimes(1)
})
