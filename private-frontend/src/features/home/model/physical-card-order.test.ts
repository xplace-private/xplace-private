import { expect, test } from 'vitest'
import { deliveryErrors } from './physical-card-order'

const countries = [{ code: 'US' as const, name: 'United States', flag: '🇺🇸', phoneCode: '+1', postalCodeRegex: '^\\d{5}(-\\d{4})?$' }]
const address = { address: '1 Main St', apartment: '', city: 'New York', region: 'New York', postcode: '10001', country: 'US', phoneCountry: 'US', phone: '(202) 555-0123' }

test('validates required fields, the server postal pattern and selected phone region', () => {
  expect(deliveryErrors(address, countries)).toEqual({})
  expect(deliveryErrors({ ...address, postcode: 'wrong', phone: '12', address: '' }, countries)).toMatchObject({ address: 'common.errors.required', postcode: 'home.delivery.errors.postcode', phone: 'home.delivery.errors.phone' })
  expect(deliveryErrors({ ...address, country: 'XX' }, countries)).toHaveProperty('country')
})

test('supports alphanumeric postal codes and fails safely on an invalid server regex', () => {
  expect(deliveryErrors({ ...address, postcode: 'SW1A 1AA' }, [{ ...countries[0]!, postalCodeRegex: '^[A-Z0-9 ]+$' }])).toEqual({})
  expect(deliveryErrors(address, [{ ...countries[0]!, postalCodeRegex: '[' }])).toHaveProperty('postcode')
})

test('requires state or region, including whitespace-only values', () => {
  for (const region of ['', '   ']) {
    expect(deliveryErrors({ ...address, region }, countries)).toHaveProperty('region', 'common.errors.required')
  }
})
