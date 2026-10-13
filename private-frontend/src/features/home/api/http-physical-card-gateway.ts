import { isApiRequestError, type ApiClient } from '../../../shared/api/api-client'
import type { CardRecipient, DeliveryCountry, DeliveryErrors, PhysicalCardOptions, PhysicalCardOrder, PhysicalDeliveryAddress, PhysicalOrderStatus } from '../model/physical-card-order'

export class PhysicalCardError extends Error {
  constructor(message = 'home.delivery.errors.request', readonly fields: DeliveryErrors = {}) { super(message) }
}

export interface PhysicalCardGateway {
  options(signal?: AbortSignal): Promise<PhysicalCardOptions>
  latest(signal?: AbortSignal): Promise<PhysicalCardOrder | null>
  save(id: number | null, address: PhysicalDeliveryAddress, recipient: CardRecipient, signal?: AbortSignal): Promise<PhysicalCardOrder>
  pay(id: number, signal?: AbortSignal): Promise<PhysicalCardOrder>
}

export function createHttpPhysicalCardGateway(client: ApiClient): PhysicalCardGateway {
  async function request(path: string, method: 'GET' | 'POST' | 'PATCH', json?: unknown, signal?: AbortSignal) {
    try { return await client.request(path, { method, json, authenticated: true, retry: false, signal }) }
    catch (error) {
      if (method === 'GET' && isApiRequestError(error) && error.status === 404 && path.includes('/tier/')) return null
      throw readError(error)
    }
  }
  return {
    async options(signal) {
      const [countries, rates] = await Promise.all([
        (async () => {
          const countries: DeliveryCountry[] = []
          let more = true
          while (more) {
            const page = await request(`cards/countries/?limit=250&offset=${countries.length}`, 'GET', undefined, signal)
            if (!record(page) || !Array.isArray(page.results) || !(page.next === null || typeof page.next === 'string')) throw new PhysicalCardError()
            const items = page.results.map(readCountry)
            if (page.next !== null && items.length === 0) throw new PhysicalCardError()
            countries.push(...items)
            more = page.next !== null
          }
          return countries
        })(),
        request('users/tier-rates/', 'GET', undefined, signal),
      ])
      if (!record(rates) || !Array.isArray(rates.tiers)) throw new PhysicalCardError()
      const silver: unknown = rates.tiers.find((tier: unknown) => record(tier) && tier.tier === 2)
      if (!record(silver)) throw new PhysicalCardError()
      return { countries, price: readPrice(silver.physical_card_issue_price_usd) }
    },
    async latest(signal) {
      const data = await request('cards/physical-orders/tier/2/', 'GET', undefined, signal)
      return data === null ? null : readOrder(data)
    },
    async save(id, address, recipient, signal) {
      if (!recipient.firstName?.trim() || !recipient.lastName?.trim()) throw new PhysicalCardError('home.delivery.errors.recipient')
      const payload = {
        ...(id === null ? { tier: 2 } : {}),
        first_name: recipient.firstName.trim(), last_name: recipient.lastName.trim(),
        display_name: `${recipient.firstName.trim()} ${recipient.lastName.trim()}`,
        shipping_line1: address.address.trim(), shipping_line2: address.apartment.trim(), shipping_city: address.city.trim(),
        shipping_region: address.region.trim(), shipping_postal_code: address.postcode.trim(), shipping_country: { code: address.country },
        phone_number: { number_country: { code: address.phoneCountry }, raw_number: address.phone },
      }
      return readOrder(await request(id === null ? 'cards/physical-orders/create/' : `cards/physical-orders/${id}/`, id === null ? 'POST' : 'PATCH', payload, signal))
    },
    async pay(id, signal) {
      const data = await request(`cards/physical-orders/${id}/prepare-payment/`, 'POST', {}, signal)
      if (!record(data)) throw new PhysicalCardError()
      const order = readOrder(data.order)
      if (order.id !== id || !['paid', 'issued'].includes(order.status)) throw new PhysicalCardError()
      return order
    },
  }
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function readPrice(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{1,10}\.\d{2}$/.test(value)) throw new PhysicalCardError()
  return value
}
function readCountry(value: unknown): DeliveryCountry {
  if (!record(value) || typeof value.code !== 'string' || !/^[A-Z]{2}$/.test(value.code) ||
      typeof value.name !== 'string' || typeof value.phone_code !== 'string' || typeof value.postal_code_regex !== 'string') throw new PhysicalCardError()
  return { code: value.code, name: value.name, phoneCode: value.phone_code, postalCodeRegex: value.postal_code_regex,
    flag: String.fromCodePoint(...[...value.code].map((char) => char.charCodeAt(0) + 127397)) }
}
const statuses: readonly string[] = ['draft', 'pending_payment', 'paid', 'issued', 'failed', 'canceled'] satisfies readonly PhysicalOrderStatus[]
function isOrderStatus(value: unknown): value is PhysicalOrderStatus { return typeof value === 'string' && statuses.includes(value) }
function readOrder(value: unknown): PhysicalCardOrder {
  if (!record(value) || !Number.isSafeInteger(value.id) || typeof value.id !== 'number' || value.id <= 0 || value.tier !== 2 || !isOrderStatus(value.status) ||
      !(value.card_id === null || (typeof value.card_id === 'number' && Number.isSafeInteger(value.card_id) && value.card_id > 0))) throw new PhysicalCardError()
  const { shipping_line1: address, shipping_line2: apartment, shipping_city: city, shipping_region: region, shipping_postal_code: postcode } = value
  if (typeof address !== 'string' || typeof apartment !== 'string' || typeof city !== 'string' || typeof region !== 'string' || typeof postcode !== 'string') throw new PhysicalCardError()
  const country = value.shipping_country === null ? '' : readCountry(value.shipping_country).code
  let phoneCountry = '', phone = ''
  if (value.phone_number !== null) {
    if (!record(value.phone_number) || typeof value.phone_number.raw_number !== 'string') throw new PhysicalCardError()
    phoneCountry = readCountry(value.phone_number.number_country).code
    phone = value.phone_number.raw_number
  }
  if (value.status === 'issued' && value.card_id === null) throw new PhysicalCardError()
  return { id: value.id, status: value.status, cardId: value.card_id, price: readPrice(value.price_usd), address: { address, apartment, city, region, postcode, country, phoneCountry, phone } }
}

function readError(error: unknown): PhysicalCardError {
  if (!isApiRequestError(error) || error.status !== 400) return new PhysicalCardError()
  let body = error.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { return new PhysicalCardError() } }
  if (!record(body)) return new PhysicalCardError()
  const message = body.error ?? body.detail ?? body.tier
  const text = Array.isArray(message) ? message[0] : message
  const known: Record<string, string> = {
    'Insufficient balance': 'balance',
    'Private credit line is not configured.': 'credit', 'Private credit line is not active.': 'credit',
    'Card issuance limit reached. Contact Support.': 'limit', 'Maximum active cards reached. Contact Support.': 'limit',
    'Physical card applications are not available.': 'unavailable', 'This physical card tier is not available for ordering.': 'unavailable',
    'An active physical card order already exists for this tier.': 'existing', 'Activate your current physical card before ordering a new one.': 'existing',
  }
  const fields: DeliveryErrors = {}
  const fieldMap = { shipping_line1: 'address', shipping_line2: 'apartment', shipping_city: 'city', shipping_region: 'region', shipping_postal_code: 'postcode', shipping_country: 'country', phone_number: 'phone' } as const
  for (const [key, field] of Object.entries(fieldMap)) if (key in body) fields[field] = `home.delivery.errors.${field === 'phone' || field === 'postcode' ? field : 'invalid'}`
  return new PhysicalCardError(typeof text === 'string' && known[text] ? `home.delivery.errors.${known[text]}` : 'home.delivery.errors.request', fields)
}
