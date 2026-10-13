import { expect, test } from 'vitest'

import { ClientNotFoundError, HomeSessionError } from './home-gateway'
import { createHttpHomeGateway } from './http-home-gateway'

const baseUrl = 'https://api.example.test/partner/portal/v1/'
const summary = { spend_cents: 123456, completed_purchases: 3, pending_purchases: 2, average_check_cents: 24691, active_clients: 4, overdue_clients: 1, suspended_clients: 2, commission_earned_cents: 98765, commission_available_cents: 54321 }
const monthly = { months: Array.from({ length: 12 }, (_, index) => ({ month: index < 2 ? `2025-${11 + index}` : `2026-${String(index - 1).padStart(2, '0')}`, spend_cents: index === 11 ? 123456 : 0, commission_cents: index === 0 ? 77777 : index === 11 ? 12345 : 0 })) }
const signal = () => new AbortController().signal

test('loads real dashboard and commission amounts in USD with a January–December commission chart', async () => {
  const requests: Request[] = []
  const gateway = createHttpHomeGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    if (request.url.endsWith('dashboard/summary/')) return Response.json(summary)
    if (request.url.endsWith('dashboard/monthly/?months=12')) return Response.json(monthly)
    if (request.url.endsWith('me/')) return Response.json({ partner: { name: 'Actual Partner' } })
    throw new Error('Unexpected endpoint')
  } })
  const overview = await gateway.getOverview(signal())
  expect(overview).toMatchObject({
    partnerName: 'Actual Partner', currency: 'USD', spend: 1234.56, purchases: 5,
    completedPurchases: 3, pendingPurchases: 2, averagePurchase: 246.91,
    activeClients: 4, overdueClients: 1, suspendedClients: 2,
    commission: 987.65, availablePayout: 543.21,
    monthly: monthly.months.map(point => ({ month: point.month, spend: point.spend_cents / 100, commission: point.commission_cents / 100 })),
  })
  expect(overview.commissionMonthly).toHaveLength(12)
  expect(overview.commissionMonthly?.[0]).toEqual({ month: '2026-01', spend: null, commission: 0 })
  expect(overview.commissionMonthly?.[9]).toEqual({ month: '2026-10', spend: null, commission: 123.45 })
  expect(overview.commissionMonthly?.[10]).toEqual({ month: '2026-11', spend: null, commission: null })
  expect(overview.commissionMonthly?.[11]).toEqual({ month: '2026-12', spend: null, commission: null })
  expect(requests).toHaveLength(3)
  expect(requests.every(request => request.method === 'GET' && request.credentials === 'include' && !request.headers.has('Authorization') && !request.headers.has('X-CSRFToken'))).toBe(true)
})

const counts = { partner_review: 0, suspended: 1, overdue: 1, active: 5, limit_review: 11, onboarding: 3 }
const row = { id: 'opaque:client/1', email: '', phone: '+971 500000000', name: 'Actual Client', registered_at: '2026-10-05T12:30:00Z', status: 'limit_review', client_ref: null }

test('uses server search, status and pagination with opaque client ids and counts before status filtering', async () => {
  const gateway = createHttpHomeGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    expect(url.pathname).toBe('/partner/portal/v1/clients/')
    expect([...url.searchParams.entries()]).toEqual([['search', 'Actual'], ['status', 'limit_review'], ['page', '2'], ['page_size', '10']])
    return Response.json({ counts, page: 2, page_size: 10, total: 11, results: [row] })
  } })
  const result = await gateway.getClients({ search: 'Actual', status: 'limit-review', page: 2, pageSize: 10 }, signal())
  expect(result).toMatchObject({ page: 2, pageSize: 10, total: 11, counts: { all: 21, suspended: 1, overdue: 1, active: 5, 'limit-review': 11, onboarding: 3 } })
  expect(result.items).toEqual([{ id: 'opaque:client/1', email: '', phone: '+971 500000000', name: 'Actual Client', registeredAt: row.registered_at, clientRef: null, closedAt: null, status: 'limit-review', paymentDetails: null, partnerReviewDetails: null }])
})

const query = { search: '', status: 'all', page: 1, pageSize: 10 } as const
const page = { counts, page: 1, page_size: 10, total: 21, results: [row] }
function responding(body: unknown, status = 200) {
  return createHttpHomeGateway({ baseUrl, fetch: async () => Response.json(body, { status }) })
}

test.each([10, 25, 50])('keeps empty pages and requests the supported page size %i', async pageSize => {
  const gateway = createHttpHomeGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    expect(new URL(request.url).searchParams.get('status')).toBe('')
    expect(new URL(request.url).searchParams.get('page_size')).toBe(String(pageSize))
    return Response.json({ ...page, page: 4, page_size: pageSize, results: [] })
  } })
  expect(await gateway.getClients({ ...query, page: 4, pageSize }, signal())).toMatchObject({ items: [], page: 4, pageSize, total: 21 })
})

const payment = {
  status: 'suspended', amount_usd: '2000.00', amount_eur: '1761.40', fx_rate: '0.88070000',
  frozen_at: '2026-09-09T00:05:00Z', third_party_allowed: true,
  overdue: [{ due_date: '2026-09-05', amount: '2000.00', late_fees: '50.00' }],
  rails: [
    { payment_rail: 'wire', currency: 'usd', third_party_allowed: true, beneficiary_name: 'Actual Client',
      account_number: '8848841589', routing_number: '021000021', bank_name: 'Iron Bank', bank_address: null },
    { payment_rail: 'ach', currency: 'usd', third_party_allowed: true, beneficiary_name: 'Actual Client',
      account_number: '8848841589', routing_number: '734755376' },
    { payment_rail: 'sepa', currency: 'eur', third_party_allowed: true, beneficiary_name: 'Actual Client',
      iban: 'DE89370400440532013000', bic: null, reference: 'actual-reference' },
  ],
}

function paymentGateway(body: unknown = payment, status = 200) {
  return createHttpHomeGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    return request.url.endsWith('/payment-details/') ? Response.json(body, { status }) : Response.json({ ...row, status: 'suspended' })
  } })
}

test('loads payment details with the encoded id, real debt and every returned bank rail', async () => {
  const requests: Request[] = []
  const gateway = createHttpHomeGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    return request.url.endsWith('/payment-details/') ? Response.json(payment) : Response.json({ ...row, status: 'suspended', client_ref: 'customer-reference' })
  } })
  const client = await gateway.getClient(row.id, signal())
  expect(requests.map(request => request.url)).toEqual([`${baseUrl}clients/opaque%3Aclient%2F1/`, `${baseUrl}clients/opaque%3Aclient%2F1/payment-details/`])
  expect(requests.every(request => request.method === 'GET' && request.credentials === 'include')).toBe(true)
  expect(client).toMatchObject({ id: row.id, clientRef: 'customer-reference', status: 'suspended', paymentDetails: {
    source: 'api', unpaidBalance: 2000, amountToPay: 2000, suspensionDate: '2026-09-09',
    statementOwed: 2000, dueDate: '2026-09-05', proofEmail: 'example@gmail.com',
    eur: { usdRate: 0.8807, statementOwed: 1761.4 },
    bankRails: [
      { type: 'wire', currency: 'USD', thirdPartyAllowed: true, fields: [
        { name: 'accountName', value: 'Actual Client' }, { name: 'bank', value: 'Iron Bank' },
        { name: 'accountNumber', value: '8848841589' }, { name: 'routingNumber', value: '021000021' },
      ] },
      { type: 'ach', currency: 'USD', fields: [{ name: 'accountName', value: 'Actual Client' }, { name: 'accountNumber', value: '8848841589' }, { name: 'routingNumber', value: '734755376' }] },
      { type: 'sepa', currency: 'EUR', fields: [{ name: 'accountName', value: 'Actual Client' }, { name: 'iban', value: 'DE89370400440532013000' }, { name: 'reference', value: 'actual-reference' }] },
    ],
  } })
  client.paymentDetails!.proofEmail = 'mutated'
  expect((await gateway.getClient(row.id, signal())).paymentDetails?.proofEmail).toBe('example@gmail.com')
  await expect(responding({ error: 'not_found' }, 404).getClient('bad-id', signal())).rejects.toBeInstanceOf(ClientNotFoundError)
})

test.each([
  { ...page, counts: { ...counts, active: null } },
  { ...page, counts: { ...counts, overdue: -1 } },
  { ...page, page_size: 20 },
  { ...page, total: 1.5 },
  ...[{ status: 'unknown' }, { client_ref: undefined }, { email: null }, { registered_at: '2026-02-30T12:00:00Z' }, { registered_at: '2026-13-01T12:00:00Z' }].map(change => ({ ...page, results: [{ ...row, ...change }] })),
])('rejects malformed client data instead of inventing fallback values: %#', async body => {
  await expect(responding(body).getClients(query, signal())).rejects.toMatchObject({ kind: 'invalid-response' })
})

function overviewGateway(summaryBody: unknown = summary, monthlyBody: unknown = monthly) {
  return createHttpHomeGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    return Response.json(request.url.endsWith('me/') ? { partner: { name: null } } : request.url.includes('/monthly/') ? monthlyBody : summaryBody)
  } })
}

test('preserves zero amounts, zero counts and the nullable partner name', async () => {
  const zeroSummary = Object.fromEntries(Object.keys(summary).map(key => [key, 0]))
  const overview = await overviewGateway(zeroSummary).getOverview(signal())
  expect(overview).toMatchObject({ partnerName: null, spend: 0, purchases: 0, completedPurchases: 0, pendingPurchases: 0, averagePurchase: 0, activeClients: 0, overdueClients: 0, suspendedClients: 0, commission: 0, availablePayout: 0 })
})

test.each([
  { ...summary, spend_cents: null }, { ...summary, spend_cents: '123456' },
  { ...summary, completed_purchases: -1 }, { ...summary, average_check_cents: 1.5 },
  { ...summary, pending_purchases: Number.MAX_SAFE_INTEGER },
  { ...summary, commission_earned_cents: null }, { ...summary, commission_earned_cents: undefined },
  { ...summary, commission_available_cents: '54321' },
])('rejects invalid dashboard numbers: %#', async body => {
  await expect(overviewGateway(body).getOverview(signal())).rejects.toMatchObject({ kind: 'invalid-response' })
})

test.each([
  { months: [] },
  { months: monthly.months.map((point, index) => index === 1 ? { ...point, month: '2026-13' } : point) },
  { months: monthly.months.map((point, index) => index === 1 ? { ...point, month: '2025-11' } : point) },
  { months: monthly.months.map((point, index) => index === 1 ? { ...point, spend_cents: null } : point) },
  { months: monthly.months.map((point, index) => index === 1 ? { ...point, commission_cents: null } : point) },
  { months: monthly.months.map((point, index) => index === 1 ? { ...point, commission_cents: undefined } : point) },
])('rejects missing or malformed monthly data: %#', async body => {
  await expect(overviewGateway(summary, body).getOverview(signal())).rejects.toMatchObject({ kind: 'invalid-response' })
})

test.each([[401, 'not_authenticated'], [403, 'two_factor_required'], [403, 'password_change_required']])('requests session revalidation for %i %s', async (status, error) => {
  const gateway = responding({ error }, status)
  await expect(gateway.getOverview(signal())).rejects.toBeInstanceOf(HomeSessionError)
  await expect(gateway.getClients(query, signal())).rejects.toBeInstanceOf(HomeSessionError)
  await expect(gateway.getClient(row.id, signal())).rejects.toBeInstanceOf(HomeSessionError)
})

test('retains ordinary server failures and cancels requests with the caller signal', async () => {
  await expect(responding({ error: 'internal_error' }, 500).getClients(query, signal())).rejects.toMatchObject({ kind: 'http', status: 500 })
  const gateway = createHttpHomeGateway({ baseUrl, fetch: (input, init) => {
    const request = new Request(input, init)
    return new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'))
      if (request.signal.aborted) abort()
      else request.signal.addEventListener('abort', abort, { once: true })
    })
  } })
  const controller = new AbortController()
  const pending = gateway.getClients(query, controller.signal)
  const rejected = expect(pending).rejects.toMatchObject({ kind: 'aborted' })
  controller.abort()
  await rejected
})

test('keeps real USD debt and bank rails when only the EUR quote is unavailable', async () => {
  const client = await paymentGateway({ ...payment, amount_eur: null, fx_rate: null, frozen_at: null }, 503).getClient(row.id, signal())
  expect(client.paymentDetails).toMatchObject({ source: 'api', unpaidBalance: 2000, amountToPay: 2000, suspensionDate: null, eur: { usdRate: null, statementOwed: null } })
  expect(client.paymentDetails?.bankRails).toHaveLength(3)
  await expect(paymentGateway({ error: 'service_unavailable' }, 503).getClient(row.id, signal())).rejects.toMatchObject({ kind: 'http', status: 503 })
})

test('preserves zero debt and absent rails without substituting bank or frozen-date fixtures', async () => {
  const result = await paymentGateway({ ...payment, amount_usd: '0.00', amount_eur: null, fx_rate: null, frozen_at: null, rails: [], third_party_allowed: false }).getClient(row.id, signal())
  expect(result.paymentDetails).toMatchObject({ unpaidBalance: 0, amountToPay: 0, suspensionDate: null, bankRails: [], eur: null })
})

test.each([
  { amount_usd: null }, { amount_usd: '2000.00invalid' }, { amount_usd: '9007199254740992.00' },
  { fx_rate: '0.00000000' }, { amount_eur: null }, { frozen_at: '2026-02-30T00:00:00Z' },
  { status: 'active' }, { third_party_allowed: 'true' }, { rails: [{ ...payment.rails[0], routing_number: 21000021 }] },
  { rails: [{ ...payment.rails[0], currency: 'eur' }] }, { rails: [{ ...payment.rails[0], payment_rail: 'unknown' }] },
])('rejects malformed payment data rather than showing fixtures as real: %#', async change => {
  await expect(paymentGateway({ ...payment, ...change }).getClient(row.id, signal())).rejects.toMatchObject({ kind: 'invalid-response' })
})

test.each([[401, 'not_authenticated'], [403, 'two_factor_required'], [409, 'payment_details_unavailable'], [500, 'internal_error']])('handles failure of the payment request itself: %i', async (status, error) => {
  const failure = expect(paymentGateway({ error }, status).getClient(row.id, signal())).rejects
  if (status === 401 || status === 403) await failure.toBeInstanceOf(HomeSessionError)
  else await failure.toMatchObject({ kind: 'http', status })
})

test('aborts the payment request with the same caller signal', async () => {
  const controller = new AbortController()
  const gateway = createHttpHomeGateway({ baseUrl, fetch: async (input, init) => {
    const request = new Request(input, init)
    if (!request.url.endsWith('/payment-details/')) return Response.json({ ...row, status: 'overdue' })
    controller.abort()
    throw new DOMException('Aborted', 'AbortError')
  } })
  await expect(gateway.getClient(row.id, controller.signal)).rejects.toMatchObject({ kind: 'aborted' })
})


test('accepts mixed live client pages with the newly returned partner-review status', async () => {
  const result = await responding({ ...page, counts: { ...counts, partner_review: 2 }, total: 23, results: [
    { ...row, status: 'partner_review' }, { ...row, status: 'overdue', id: 'overdue-id' },
  ] }).getClients(query, signal())
  expect(result.counts).toMatchObject({ all: 23, 'partner-review': 2 })
  expect(result.items.map(client => client.status)).toEqual(['partner-review', 'overdue'])
  expect(result.items.every(client => client.paymentDetails === null)).toBe(true)
})
