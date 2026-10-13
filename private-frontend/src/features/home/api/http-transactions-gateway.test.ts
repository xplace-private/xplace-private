import { describe, expect, test, vi } from 'vitest'

import { createHttpTransactionsGateway } from './http-transactions-gateway'
import { KNOWN_TRANSACTION_TYPES } from '../model/transaction'

const bankFields = {
  bank_name: null,
  recipient_name: null,
  sender_name: null,
  sender_country: null,
  deposit_method: null,
  transfer_type: null,
  destination_currency: null,
  source_currency: null,
} as const

const cardTransaction = {
  id: 'b5df4824-9a64-4b40-8e58-8a9a65ea38ed',
  source: 'card',
  type: 'card',
  details_type: 'card',
  details_id: 'b5df4824-9a64-4b40-8e58-8a9a65ea38ed',
  amount: '123.45',
  currency: 'USD',
  status: 'completed',
  timestamp: '2026-08-20T09:41:00Z',
  created_at: '2026-08-20T09:41:01Z',
  is_credit: false,
  merchant_name: 'Paris Cafe',
  merchant_category: 'Restaurants',
  merchant_icon: null,
  location: 'Paris, FR',
  decline_reason: null,
  decline_reason_category: null,
  card_last4: '4242',
  posted_at: '2026-08-20T10:00:00Z',
  authorized_at: '2026-08-20T09:41:00Z',
  local_currency_amount: '115.50',
  local_currency: 'EUR',
  ...bankFields,
} as const

const listResponse = {
  count: 3,
  next: 'https://back-stage.x.place/api/v1/cards/private/transactions/?page=2&page_size=20',
  previous: null,
  results: [
    cardTransaction,
    {
      ...cardTransaction,
      id: 'refund:42',
      type: 'refund',
      details_type: 'refund',
      details_id: '42',
      amount: '9.90',
      status: 'pending',
      timestamp: '2026-08-19T09:41:00Z',
      created_at: '2026-08-19T09:41:00Z',
      is_credit: true,
      local_currency_amount: null,
      local_currency: null,
      posted_at: null,
      authorized_at: null,
    },
    {
      ...cardTransaction,
      id: 'top_up:17',
      source: 'ledger',
      type: 'top_up',
      details_type: 'top_up',
      details_id: '17',
      amount: '25.00',
      timestamp: '2026-08-18T09:41:00Z',
      created_at: '2026-08-18T09:41:00Z',
      is_credit: true,
      merchant_name: null,
      merchant_category: null,
      card_last4: null,
      local_currency_amount: null,
      local_currency: null,
      posted_at: null,
      authorized_at: null,
    },
  ],
  summary: {
    year: 2026,
    month: 8,
    transaction_count: 3,
    total_spent: '123.45',
    due_date: '2026-09-05',
  },
}

describe('createHttpTransactionsGateway', () => {
  test('loads the private-user feed from v1 and maps card, refund, and top-up rows', async () => {
    const request = vi.fn().mockResolvedValue(listResponse)
    const gateway = createHttpTransactionsGateway({ request })

    await expect(gateway.list({ page: 1, pageSize: 20 })).resolves.toEqual({
      ok: true,
      data: {
        count: 3,
        nextPage: 2,
        summary: {
          year: 2026,
          month: 8,
          transactionCount: 3,
          totalSpentCents: 12345,
          dueDate: '2026-09-05',
        },
        transactions: [
          {
            id: cardTransaction.id,
            source: 'card',
            type: 'card',
            isCredit: false,
            merchant: 'Paris Cafe',
            details: '20 Aug · 09:41',
            amount: 'USD 123.45',
            amountCents: 12345,
            currency: 'USD',
            convertedAmount: 'EUR 115.50',
            state: 'completed',
            category: 'Restaurants',
            date: '20 August 2026, 09:41',
            location: 'Paris, FR',
            declineReasonCategory: null,
            card: '•••• 4242',
            rate: null,
          },
          expect.objectContaining({
            id: 'refund:42',
            source: 'card',
            type: 'refund',
            isCredit: true,
            amount: 'USD 9.90',
            amountCents: 990,
            state: 'pending',
          }),
          expect.objectContaining({
            id: 'top_up:17',
            source: 'ledger',
            type: 'top_up',
            isCredit: true,
            merchant: 'Payment received',
            amount: 'USD 25.00',
            card: null,
          }),
        ],
      },
    })
    expect(request).toHaveBeenCalledWith(
      'cards/private/transactions/?page=1&page_size=20',
      { authenticated: true },
    )
  })

  test.each(['USD', 'usd'])('omits the duplicate local amount for %s transactions', async (localCurrency) => {
    const gateway = createHttpTransactionsGateway({
      request: vi.fn().mockResolvedValue({
        ...listResponse,
        count: 1,
        next: null,
        results: [{ ...cardTransaction, amount: '0.03', local_currency: localCurrency, local_currency_amount: '0.03' }],
      }),
    })

    const result = await gateway.list({ page: 1, pageSize: 20 })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected transactions to load')
    expect(result.data.transactions[0]?.amount).toBe('USD 0.03')
    expect(result.data.transactions[0]).not.toHaveProperty('convertedAmount')
  })

  test('filters the list and summary by a paired calendar year and month', async () => {
    const request = vi.fn().mockResolvedValue(listResponse)

    await createHttpTransactionsGateway({ request }).list({
      page: 1,
      pageSize: 20,
      period: { year: 2026, month: 8 },
    })

    expect(request).toHaveBeenCalledWith(
      'cards/private/transactions/?page=1&page_size=20&year=2026&month=8',
      { authenticated: true },
    )
  })

  test('maps a completed refund to the refunded design state', async () => {
    const gateway = createHttpTransactionsGateway({
      request: vi.fn().mockResolvedValue({
        ...listResponse,
        count: 1,
        next: null,
        results: [{ ...listResponse.results[1], status: 'completed' }],
      }),
    })

    await expect(gateway.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      ok: true,
      data: { transactions: [{ state: 'refunded' }] },
    })
  })

  test('maps the decline reason category and merchant location', async () => {
    const gateway = createHttpTransactionsGateway({
      request: vi.fn().mockResolvedValue({
        ...listResponse,
        count: 1,
        next: null,
        results: [{
          ...cardTransaction,
          status: 'declined',
          location: 'Dubai, AE',
          decline_reason: 'Raw backend reason',
          decline_reason_category: 'insufficient_funds',
        }],
      }),
    })

    await expect(gateway.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      ok: true,
      data: {
        transactions: [{
          location: 'Dubai, AE',
          declineReasonCategory: 'insufficient_funds',
        }],
      },
    })
  })

  test.each([
    { type: 'future_named_type', merchant_name: 'New transaction' },
    { type: 'future_type', merchant_name: null },
    { source: 'future_source' },
    { status: 'processing' },
    { type: '__proto__', source: 'constructor', status: 'toString' },
  ])('preserves the full page with unfamiliar values: %j', async (fields) => {
    const row = { ...cardTransaction, ...fields, id: 'new-transaction' }
    const gateway = createHttpTransactionsGateway({
      request: vi.fn().mockResolvedValue({
        ...listResponse,
        count: 4,
        results: [...listResponse.results, row],
      }),
    })

    const result = await gateway.list({ page: 1, pageSize: 20 })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected a successful transaction page')
    expect(result.data.transactions).toHaveLength(4)
    expect(result.data.transactions[0]?.merchant).toBe('Paris Cafe')
    expect(result.data.transactions[3]).toMatchObject({
      id: row.id,
      type: row.type,
      source: row.source,
      state: row.status,
      merchant: row.merchant_name,
      amount: 'USD 123.45',
      date: '20 August 2026, 09:41',
    })
    expect(result.data.nextPage).toBe(2)
    expect(result.data.summary.totalSpentCents).toBe(12345)
  })

  test.each(['type', 'source', 'status'])('still validates %s as a nonempty string', async (field) => {
    for (const value of [null, undefined, '', '   ', 42, {}]) {
      const gateway = createHttpTransactionsGateway({
        request: vi.fn().mockResolvedValue({
          ...listResponse,
          results: [{ ...cardTransaction, [field]: value }],
        }),
      })

      await expect(gateway.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({ ok: false })
    }
  })

  test.each([
    { ...listResponse, count: -1 },
    { ...listResponse, next: 'not a url' },
    { ...listResponse, results: [{ ...cardTransaction, amount: 123.45 }] },
    { ...listResponse, results: [{ ...cardTransaction, amount: '-1.00' }] },
    { ...listResponse, results: [{ ...cardTransaction, is_credit: 'false' }] },
    { ...listResponse, results: [{ ...cardTransaction, timestamp: null }] },
    { ...listResponse, results: [{ ...cardTransaction, type: 'future_type', amount: null }] },
    { ...listResponse, results: [{ ...cardTransaction, type: 'future_type', timestamp: null }] },
    { ...listResponse, summary: { ...listResponse.summary, month: 13 } },
    { ...listResponse, summary: { ...listResponse.summary, total_spent: null } },
    { ...listResponse, summary: { ...listResponse.summary, due_date: '2026-02-30' } },
  ])('rejects malformed list responses without exposing raw data', async (response) => {
    const gateway = createHttpTransactionsGateway({ request: vi.fn().mockResolvedValue(response) })

    await expect(gateway.list({ page: 1, pageSize: 20 })).resolves.toEqual({
      ok: false,
      code: 'transactions-failed',
      message: 'Unable to load transactions. Try again.',
    })
  })
})

test.each(['Physical card', null])('labels known physical-card debits as Physical Card when merchant is %s', async (merchant) => {
  expect(KNOWN_TRANSACTION_TYPES.has('physical_card')).toBe(true)
  const request = vi.fn().mockResolvedValue({ ...listResponse, count: 1, next: null, results: [{ ...cardTransaction, id: 'physical_card:1', source: 'ledger', type: 'physical_card', details_type: 'physical_card', merchant_name: merchant }] })
  await expect(createHttpTransactionsGateway({ request }).list({ page: 1, pageSize: 20 })).resolves.toMatchObject({ ok: true, data: { transactions: [{ type: 'physical_card', isCredit: false, merchant: 'Physical Card' }] } })
})
