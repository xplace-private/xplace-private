import { expect, test, vi } from 'vitest'
import { ApiRequestError } from '../../../shared/api/api-client'
import { createHttpPhysicalCardGateway } from './http-physical-card-gateway'

const country = { code: 'US', name: 'United States', phone_code: '+1', postal_code_regex: '^\\d{5}(-\\d{4})?$' }
const apiOrder = {
  id: 42, tier: 2, status: 'draft', card_id: null, price_usd: '99.00',
  shipping_line1: '1 Main St', shipping_line2: '', shipping_city: 'New York',
  shipping_region: 'NY', shipping_postal_code: '10001', shipping_country: country,
  phone_number: { number_country: country, raw_number: '2025550123' },
}

test('loads all allowed countries without following external next URLs and reads Silver pricing', async () => {
  const request = vi.fn(async (path: string) => {
    if (path.startsWith('users/')) return { tiers: [
      { tier: 3, physical_card_issue_price_usd: '199.00' },
      { tier: 2, physical_card_issue_price_usd: '0.01' },
      { tier: 4, physical_card_issue_price_usd: '199.00' },
    ] }
    return path.includes('offset=1')
      ? { results: [{ ...country, code: 'GB', name: 'United Kingdom', phone_code: '+44' }], next: null }
      : { results: [country], next: 'https://untrusted.example/countries/' }
  })
  const result = await createHttpPhysicalCardGateway({ request }).options()
  expect(result.countries.map((item) => item.code)).toEqual(['US', 'GB'])
  expect(result.price).toBe('0.01')
  expect(request.mock.calls.every(([path]) => !path.startsWith('http'))).toBe(true)
})

test('saves Silver delivery with applicant names and pays the same order without a wallet', async () => {
  const request = vi.fn().mockResolvedValueOnce(apiOrder).mockResolvedValueOnce({ order: { ...apiOrder, status: 'paid' } })
  const gateway = createHttpPhysicalCardGateway({ request })
  const order = await gateway.save(null, {
    address: '1 Main St', apartment: '', city: 'New York', region: 'NY', postcode: '10001', country: 'US',
    phoneCountry: 'US', phone: '(202) 555-0123',
  }, { firstName: 'Jane', lastName: 'Doe' })
  await gateway.pay(order.id)
  expect(request).toHaveBeenNthCalledWith(1, 'cards/physical-orders/create/', expect.objectContaining({
    method: 'POST', retry: false, json: expect.objectContaining({ tier: 2, first_name: 'Jane', last_name: 'Doe', display_name: 'Jane Doe', shipping_country: { code: 'US' } }),
  }))
  expect(request).toHaveBeenNthCalledWith(2, 'cards/physical-orders/42/prepare-payment/', expect.objectContaining({ method: 'POST', json: {}, retry: false }))
})

test('updates a known draft and treats absence of an order as empty', async () => {
  const request = vi.fn().mockRejectedValueOnce(new ApiRequestError('http', 404, null, 'not found')).mockResolvedValueOnce(apiOrder)
  const gateway = createHttpPhysicalCardGateway({ request })
  expect(await gateway.latest()).toBeNull()
  const order = await gateway.save(42, { address: '1 Main St', apartment: '', city: 'New York', region: 'NY', postcode: '10001', country: 'US', phoneCountry: 'US', phone: '2025550123' }, { firstName: 'Jane', lastName: 'Doe' })
  expect(order.id).toBe(42)
  expect(request).toHaveBeenLastCalledWith('cards/physical-orders/42/', expect.objectContaining({ method: 'PATCH' }))
})

test('reads the fee of the restored Silver order', async () => {
  const request = vi.fn().mockResolvedValue({ ...apiOrder, price_usd: '0.01' })
  expect(await createHttpPhysicalCardGateway({ request }).latest()).toMatchObject({ price: '0.01' })
  expect(request).toHaveBeenCalledWith('cards/physical-orders/tier/2/', expect.objectContaining({ method: 'GET' }))
})

test('rejects malformed responses and hides raw backend failures', async () => {
  const request = vi.fn().mockResolvedValueOnce({ ...apiOrder, id: '42' }).mockRejectedValueOnce(new ApiRequestError('http', 500, 'internal secrets', 'raw'))
  const gateway = createHttpPhysicalCardGateway({ request })
  await expect(gateway.latest()).rejects.toMatchObject({ message: 'home.delivery.errors.request' })
  await expect(gateway.pay(42)).rejects.toMatchObject({ message: 'home.delivery.errors.request' })
})

test('maps expected payment rejection and nested phone validation without exposing arbitrary text', async () => {
  const request = vi.fn().mockRejectedValueOnce(new ApiRequestError('http', 400, JSON.stringify({ error: 'Insufficient balance' }), 'raw'))
  await expect(createHttpPhysicalCardGateway({ request }).pay(42)).rejects.toMatchObject({ message: 'home.delivery.errors.balance' })
})

test('keeps delivery countries even if they have no supported telephone numbering plan', async () => {
  const request = vi.fn(async (path: string) => path.startsWith('users/') ? { tiers: [{ tier: 2, physical_card_issue_price_usd: null }] } : { results: [{ ...country, code: 'AQ', phone_code: '' }], next: null })
  await expect(createHttpPhysicalCardGateway({ request }).options()).resolves.toMatchObject({ countries: [{ code: 'AQ' }], price: null })
})
