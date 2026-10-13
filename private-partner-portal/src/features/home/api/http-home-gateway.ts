import { ApiRequestError, createApiClient, getApiErrorCode, isApiRequestError } from '../../../shared/api/api-client'
import type { ClientCounts, ClientPaymentDetails, ClientPaymentRail, HomeGateway, HomeOverview, PartnerClient } from './home-gateway'
import { ClientNotFoundError, HomeSessionError } from './home-gateway'
import { mockClientPaymentDetails, mockHomeGateway } from './mock-home-gateway'

interface HttpHomeGatewayOptions {
  baseUrl: string
  fetch?: typeof globalThis.fetch
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(): never {
  throw new ApiRequestError('invalid-response', null, null, 'Invalid partner dashboard response')
}

function integer(value: unknown, nonnegative = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || (nonnegative && value < 0)) invalidResponse()
  return value
}

const statuses = { active: 'active', onboarding: 'onboarding', partner_review: 'partner-review', limit_review: 'limit-review', overdue: 'overdue', suspended: 'suspended' } as const

function isClientStatus(value: unknown): value is keyof typeof statuses {
  return typeof value === 'string' && Object.hasOwn(statuses, value)
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string') invalidResponse()
  const parts = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
  if (!parts) invalidResponse()
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3])
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0
  if (year < 1 || day < 1 || day > days || !Number.isFinite(Date.parse(value))) invalidResponse()
  return value
}

function parseClient(value: unknown): PartnerClient {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id || typeof value.email !== 'string'
    || typeof value.phone !== 'string' || typeof value.name !== 'string'
    || (typeof value.client_ref !== 'string' && value.client_ref !== null)
    || !isClientStatus(value.status)) invalidResponse()
  const status = statuses[value.status]
  return { id: value.id, clientRef: value.client_ref, email: value.email, phone: value.phone, name: value.name,
    registeredAt: timestamp(value.registered_at), status, closedAt: null,
    paymentDetails: null, partnerReviewDetails: null }
}

function decimal(value: unknown, places: number): number {
  if (typeof value !== 'string' || !new RegExp(`^\\d+\\.\\d{${places}}$`).test(value)) invalidResponse()
  const units = Number(value.replace('.', ''))
  if (!Number.isSafeInteger(units)) invalidResponse()
  return units / 10 ** places
}

function parseRail(value: unknown): ClientPaymentRail {
  if (!isObject(value) || typeof value.third_party_allowed !== 'boolean') invalidResponse()
  const type = value.payment_rail
  if (type !== 'wire' && type !== 'ach' && type !== 'sepa') invalidResponse()
  if (value.currency !== (type === 'sepa' ? 'eur' : 'usd')) invalidResponse()
  const names: Record<string, ClientPaymentRail['fields'][number]['name']> = {
    beneficiary_name: 'accountName', bank_name: 'bank', beneficiary_address: 'beneficiaryAddress', bank_address: 'bankAddress',
    ...(type === 'sepa' ? { iban: 'iban', bic: 'bic', reference: 'reference' } : { account_number: 'accountNumber', routing_number: 'routingNumber' }),
  } as const
  const fields: ClientPaymentRail['fields'] = []
  for (const [key, name] of Object.entries(names)) {
    const field = value[key]
    if (field === null || field === undefined) continue
    if (typeof field !== 'string') invalidResponse()
    fields.push({ name, value: field })
  }
  return { type, currency: type === 'sepa' ? 'EUR' : 'USD', thirdPartyAllowed: value.third_party_allowed, fields }
}

function parsePayment(value: unknown): { status: 'overdue' | 'suspended'; details: ClientPaymentDetails } {
  if (!isObject(value) || (value.status !== 'overdue' && value.status !== 'suspended')
    || !Array.isArray(value.rails) || typeof value.third_party_allowed !== 'boolean') invalidResponse()
  const fixtures = mockClientPaymentDetails(value.status)
  if (!fixtures) invalidResponse()
  const amount = decimal(value.amount_usd, 2)
  const bankRails = value.rails.map(parseRail)
  const amountEur = value.amount_eur === null ? null : decimal(value.amount_eur, 2)
  const rate = value.fx_rate === null ? null : decimal(value.fx_rate, 8)
  if ((amountEur === null) !== (rate === null) || (rate !== null && rate <= 0)) invalidResponse()
  const frozenAt = value.frozen_at === null ? null : new Date(timestamp(value.frozen_at)).toISOString().slice(0, 10)
  return { status: value.status, details: {
    ...fixtures, source: 'api', currency: 'USD', statementOwed: amount, unpaidBalance: amount, amountToPay: amount,
    suspensionDate: value.status === 'suspended' ? frozenAt : fixtures.suspensionDate,
    bankRails, eur: bankRails.some(rail => rail.currency === 'EUR') ? { usdRate: rate, statementOwed: amountEur } : null,
  } }
}

export function createHttpHomeGateway(options: HttpHomeGatewayOptions): HomeGateway {
  const client = createApiClient(options)
  async function read(path: string, signal: AbortSignal): Promise<unknown> {
    try { return await client.request(path, { signal, retry: false }) }
    catch (error) {
      if (isApiRequestError(error)) {
        const code = getApiErrorCode(error)
        if (error.status === 401 || (error.status === 403 && (code === 'two_factor_required' || code === 'password_change_required'))) throw new HomeSessionError()
      }
      throw error
    }
  }

  async function readPayment(path: string, signal: AbortSignal) {
    try { return parsePayment(await read(path, signal)) }
    catch (error) {
      // The API deliberately returns usable USD details with 503 when the EUR quote fails.
      if (isApiRequestError(error) && error.status === 503 && typeof error.body === 'string') {
        let body: unknown
        try { body = JSON.parse(error.body) } catch { throw error }
        if (isObject(body) && body.amount_eur === null && body.fx_rate === null && Array.isArray(body.rails)) return parsePayment(body)
      }
      throw error
    }
  }

  return {
    ...mockHomeGateway,
    async getClients(query, signal) {
      const params = new URLSearchParams({ search: query.search, status: query.status === 'all' ? '' : query.status.replace('-', '_'), page: String(query.page), page_size: String(query.pageSize) })
      const value = await read(`clients/?${params}`, signal)
      if (!isObject(value) || !isObject(value.counts) || !Array.isArray(value.results)) invalidResponse()
      const counts: ClientCounts = {
        all: 0, active: integer(value.counts.active, true), onboarding: integer(value.counts.onboarding, true),
        'partner-review': integer(value.counts.partner_review, true), 'limit-review': integer(value.counts.limit_review, true), overdue: integer(value.counts.overdue, true), suspended: integer(value.counts.suspended, true),
      }
      counts.all = integer(counts.active + counts.onboarding + counts['limit-review'] + counts.overdue + counts.suspended + integer(value.counts.partner_review, true), true)
      const page = integer(value.page, true), pageSize = integer(value.page_size, true)
      if (page < 1 || ![10, 25, 50].includes(pageSize)) invalidResponse()
      return { items: value.results.map(parseClient), counts, page, pageSize, total: integer(value.total, true) }
    },
    async getClient(id, signal) {
      try {
        const path = `clients/${encodeURIComponent(id)}/`
        const result = parseClient(await read(path, signal))
        if (result.status !== 'overdue' && result.status !== 'suspended') return result
        const payment = await readPayment(`${path}payment-details/`, signal)
        return { ...result, status: payment.status, paymentDetails: payment.details }
      }
      catch (error) {
        if (isApiRequestError(error) && error.status === 404 && getApiErrorCode(error) === 'not_found') throw new ClientNotFoundError()
        throw error
      }
    },
    async getOverview(signal): Promise<HomeOverview> {
      const [summary, monthly, profile] = await Promise.all([
        read('dashboard/summary/', signal), read('dashboard/monthly/?months=12', signal), read('me/', signal),
      ])
      if (!isObject(summary) || !isObject(monthly) || !Array.isArray(monthly.months) || monthly.months.length !== 12
        || !isObject(profile) || !isObject(profile.partner) || (typeof profile.partner.name !== 'string' && profile.partner.name !== null)) invalidResponse()
      const completed = integer(summary.completed_purchases, true)
      const pending = integer(summary.pending_purchases, true)
      let previousMonth: number | undefined
      const months = monthly.months.map((point: unknown) => {
        if (!isObject(point) || typeof point.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(point.month)) invalidResponse()
        const month = Number(point.month.slice(0, 4)) * 12 + Number(point.month.slice(5)) - 1
        if (month < 12 || (previousMonth !== undefined && month !== previousMonth + 1)) invalidResponse()
        previousMonth = month
        return { month: point.month, spend: integer(point.spend_cents) / 100, commission: integer(point.commission_cents) / 100 }
      })
      const year = months[11]?.month.slice(0, 4)
      if (year === undefined) invalidResponse()
      const commissionMonthly = Array.from({ length: 12 }, (_, index) => {
        const month = `${year}-${String(index + 1).padStart(2, '0')}`
        return { month, spend: null, commission: months.find(point => point.month === month)?.commission ?? null }
      })
      return {
        partnerName: profile.partner.name, currency: 'USD', spend: integer(summary.spend_cents) / 100,
        purchases: integer(completed + pending, true), completedPurchases: completed, pendingPurchases: pending,
        averagePurchase: integer(summary.average_check_cents) / 100,
        activeClients: integer(summary.active_clients, true), overdueClients: integer(summary.overdue_clients, true), suspendedClients: integer(summary.suspended_clients, true),
        commission: integer(summary.commission_earned_cents) / 100, availablePayout: integer(summary.commission_available_cents) / 100,
        monthly: months, commissionMonthly,
      }
    },
  }
}
