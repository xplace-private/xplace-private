import { expect, test, vi } from 'vitest'

import { createHttpDepositsGateway } from './http-deposits-gateway'

const ach = {
  id: 'onramp:ach', provider: 'iron', status: 'Approved',
  source_currency: 'usd', target_currency: 'usdc', accepts_third_party_deposits: false,
  deposit_instructions: {
    payment_rail: 'ach', beneficiary_name: 'Account Holder',
    account_number: '00123456789', routing_number: '021000021',
    beneficiary_address: null, bank_name: null, bank_address: null,
  },
}

const swift = {
  id: '01a07af3-24be-752e-94a9-a3cc28c75a67', provider: 'iron', status: 'Approved',
  source_currency: 'usd', target_currency: 'usdc', accepts_third_party_deposits: true,
  deposit_instructions: {
    payment_rail: 'swift', beneficiary_name: 'Igor Private',
    beneficiary_address: '100 Iron Way, Financial District, NY 10001',
    account_number: '8848841589', iban: null, bic: 'IRONUS33XXX',
    bank_name: 'Iron Bank', bank_address: '123 Financial Plaza, New York, NY 10004',
    reference: null,
  },
}

const sepa = {
  ...swift, id: 'onramp:sepa', source_currency: 'eur',
  deposit_instructions: {
    payment_rail: 'sepa', beneficiary_name: 'EUR Beneficiary',
    beneficiary_address: 'EUR Beneficiary Address',
    iban: 'DE89370400440532013000', bic: 'COBADEFFXXX',
    bank_name: 'EUR Bank', bank_address: 'EUR Bank Address', reference: 'EUR-REFERENCE',
  },
}

test('reads EUR SEPA alongside USD and crypto without dropping any requisites', async () => {
  const result = await createHttpDepositsGateway({ request: async () => [swift, sepa, crypto] }).list()
  expect(result).toMatchObject({ ok: true, data: {
    bank: [{ id: swift.id }, {
      id: sepa.id, sourceCurrency: 'eur', status: 'Approved', acceptsThirdPartyDeposits: true,
      instructions: {
        paymentRail: 'sepa', beneficiaryName: 'EUR Beneficiary',
        beneficiaryAddress: 'EUR Beneficiary Address',
        iban: 'DE89370400440532013000', bic: 'COBADEFFXXX',
        bankName: 'EUR Bank', bankAddress: 'EUR Bank Address', reference: 'EUR-REFERENCE',
      },
    }],
    crypto: [{ id: crypto.id }],
  } })
})

test('preserves nullable/pending EUR data and rejects malformed EUR without discarding USD', async () => {
  const result = await createHttpDepositsGateway({ request: async () => [
    swift,
    { ...sepa, deposit_instructions: { ...sepa.deposit_instructions, bic: null, reference: null,
      beneficiary_address: null, bank_name: null, bank_address: null } },
    { ...sepa, id: 'pending-eur', status: 'Authorized', deposit_instructions: null },
    { ...sepa, id: 'invalid-eur', deposit_instructions: { ...sepa.deposit_instructions, iban: 123 } },
  ] }).list()
  expect(result).toMatchObject({ ok: true, data: { bank: [
    { id: swift.id },
    { id: sepa.id, instructions: { bic: null, reference: null, beneficiaryAddress: null,
      bankName: null, bankAddress: null } },
    { id: 'pending-eur', status: 'Authorized', sourceCurrency: 'eur', instructions: null },
  ] } })
})

test('maps every Private SWIFT field without requiring ACH routing details', async () => {
  const result = await createHttpDepositsGateway({ request: async () => [swift] }).list()

  expect(result).toEqual({ ok: true, data: { bank: [{
    id: swift.id, status: 'Approved', sourceCurrency: 'usd', acceptsThirdPartyDeposits: true,
    instructions: {
      paymentRail: 'swift', beneficiaryName: 'Igor Private',
      beneficiaryAddress: '100 Iron Way, Financial District, NY 10001',
      accountNumber: '8848841589', iban: null,
      bic: 'IRONUS33XXX', bankName: 'Iron Bank',
      bankAddress: '123 Financial Plaza, New York, NY 10004', reference: null,
    },
  }], crypto: [] } })
})

test('keeps SWIFT details when source currency is missing', async () => {
  const result = await createHttpDepositsGateway({ request: async () => [{
    ...swift,
    source_currency: undefined,
    deposit_instructions: { payment_rail: 'swift' },
  }] }).list()

  expect(result).toMatchObject({ ok: true, data: { bank: [{
    sourceCurrency: null,
    instructions: {
      beneficiaryName: null,
      beneficiaryAddress: null,
      accountNumber: null,
      iban: null,
      bic: null,
      bankName: null,
      bankAddress: null,
      reference: null,
    },
  }] } })
})

test('GETs only private USD Iron ACH/Wire, preserving leading zeros and nullable data', async () => {
  const request = vi.fn().mockResolvedValue([
    ach,
    { ...ach, id: 'onramp:wire', deposit_instructions: { ...ach.deposit_instructions, payment_rail: 'wire' } },
    { ...ach, provider: 'bridge' },
    { ...ach, source_currency: 'eur' },
    { ...ach, target_currency: 'usdt' },
    { ...ach, deposit_instructions: { payment_rail: 'sepa' } },
  ])
  const signal = new AbortController().signal
  const result = await createHttpDepositsGateway({ request }).list(signal)
  expect(request).toHaveBeenCalledExactlyOnceWith('transfers/deposits/', {
    authenticated: true, retry: false, signal,
  })
  expect(result).toEqual({ ok: true, data: { bank: [
    {
      id: 'onramp:ach', status: 'Approved', sourceCurrency: 'usd', acceptsThirdPartyDeposits: false,
      instructions: {
        paymentRail: 'ach', beneficiaryName: 'Account Holder',
        accountNumber: '00123456789', routingNumber: '021000021',
        beneficiaryAddress: null, bankName: null, bankAddress: null,
      },
    },
    {
      id: 'onramp:wire', status: 'Approved', sourceCurrency: 'usd', acceptsThirdPartyDeposits: false,
      instructions: {
        paymentRail: 'wire', beneficiaryName: 'Account Holder',
        accountNumber: '00123456789', routingNumber: '021000021',
        beneficiaryAddress: null, bankName: null, bankAddress: null,
      },
    },
  ], crypto: [] } })
})

test.each([[], [{ ...ach, status: 'Authorized', deposit_instructions: null }]].map((body) => ({ body })))(
  'accepts empty lists and explicit pending channels without inventing requisites', async ({ body }) => {
    const result = await createHttpDepositsGateway({ request: async () => body }).list()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.bank.every((channel) => channel.instructions === null)).toBe(true)
  },
)

test.each([{ provider: 'bridge' }, { source_currency: 'eur' }])(
  'Wire with a different provider or currency does not displace private Iron/USD ACH (%j)', async (otherPair) => {
    const wire = {
      ...ach, ...otherPair, id: 'other:wire',
      deposit_instructions: { ...ach.deposit_instructions, payment_rail: 'wire' },
    }
    const result = await createHttpDepositsGateway({ request: async () => [wire, ach] }).list()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.bank.map((deposit) => deposit.id)).toEqual(['onramp:ach'])
  },
)

test.each([null, {}].map((body) => ({ body })))('rejects malformed responses with a safe error', async ({ body }) => {
  const result = await createHttpDepositsGateway({ request: async () => body }).list()
  expect(result).toMatchObject({ ok: false, code: 'deposits-failed' })
})

test.each([
  [null], [{ ...ach, id: null }], [{ ...ach, status: 1 }],
  [{ ...ach, accepts_third_party_deposits: undefined }],
  [{ ...ach, deposit_instructions: undefined }],
  [{ ...ach, deposit_instructions: { ...ach.deposit_instructions, account_number: 123 } }],
  [{ ...ach, deposit_instructions: { ...ach.deposit_instructions, bank_name: {} } }],
].map((body) => ({ body })))('keeps malformed rows out of payment instructions', async ({ body }) => {
  const result = await createHttpDepositsGateway({ request: async () => body }).list()
  expect(result).toEqual({ ok: true, data: { bank: [], crypto: [] } })
})

test('does not leak backend errors', async () => {
  const result = await createHttpDepositsGateway({ request: async () => { throw new Error('provider secret') } }).list()
  expect(result).toMatchObject({ ok: false, code: 'deposits-failed' })
  expect(JSON.stringify(result)).not.toContain('provider secret')
})

const crypto = {
  ...ach, id: 'crypto', source_currency: 'usdc',
  deposit_instructions: { payment_rail: 'crypto', address: '0xSANDBOX110000000DoNotSend0000000000', type: 'Ethereum' },
}

test('reads the independent Iron USDC Ethereum channel and maps its network to ERC-20', async () => {
  const result = await createHttpDepositsGateway({ request: async () => [ach, crypto] }).list()
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data.bank).toHaveLength(1)
  expect(result.data.crypto).toEqual([{
    id: 'crypto', status: 'Approved',
    instructions: { address: crypto.deposit_instructions.address, asset: 'USDC', network: 'ERC-20' },
  }])
})

test('accepts the Bridge SWIFT and Ethereum fallback channels', async () => {
  const result = await createHttpDepositsGateway({ request: async () => [
    { ...swift, provider: 'bridge', status: 'activated' },
    { ...crypto, provider: 'bridge', status: 'active' },
  ] }).list()

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data.bank[0]).toMatchObject({
    id: swift.id,
    status: 'activated',
    instructions: { paymentRail: 'swift', bic: 'IRONUS33XXX' },
  })
  expect(result.data.crypto).toEqual([{
    id: 'crypto', status: 'active',
    instructions: { address: crypto.deposit_instructions.address, asset: 'USDC', network: 'ERC-20' },
  }])
})

test.each([
  { ...crypto, target_currency: 'usdt' },
  { ...crypto, deposit_instructions: { ...crypto.deposit_instructions, type: 'Solana' } },
  { ...crypto, deposit_instructions: { ...crypto.deposit_instructions, type: null } },
  { ...crypto, deposit_instructions: { ...crypto.deposit_instructions, address: 123 } },
  { ...crypto, deposit_instructions: { ...crypto.deposit_instructions, address: ' ' } },
])('invalid or unsupported crypto never discards valid bank instructions', async (invalid) => {
  const result = await createHttpDepositsGateway({ request: async () => [invalid, ach] }).list()
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data.bank.map((deposit) => deposit.id)).toEqual([ach.id])
  expect(result.data.crypto).toEqual([])
})

test('invalid bank instructions never discard valid crypto', async () => {
  const result = await createHttpDepositsGateway({ request: async () => [
    { ...ach, deposit_instructions: { ...ach.deposit_instructions, account_number: null } }, crypto,
  ] }).list()
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data.bank).toEqual([])
  expect(result.data.crypto.map((deposit) => deposit.id)).toEqual(['crypto'])
})

test('preserves a pending crypto channel with null instructions', async () => {
  const result = await createHttpDepositsGateway({ request: async () => [
    { ...crypto, status: 'Authorized', deposit_instructions: null },
  ] }).list()
  expect(result).toEqual({ ok: true, data: {
    bank: [], crypto: [{ id: 'crypto', status: 'Authorized', instructions: null }],
  } })
})
