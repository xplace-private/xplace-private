import { isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js/max'
import { DEFAULT_PHONE_COUNTRY, formatPhoneNumber, type PhoneCountry } from '../../../shared/phone/phone-countries'

export interface DeliveryCountry extends Omit<PhoneCountry, 'code'> {
  code: string
  postalCodeRegex: string
}

export interface PhysicalDeliveryAddress {
  address: string
  apartment: string
  city: string
  region: string
  postcode: string
  country: string
  phoneCountry: string
  phone: string
}

export const emptyPhysicalAddress: PhysicalDeliveryAddress = {
  address: '', apartment: '', city: '', region: '', postcode: '', country: '', phoneCountry: DEFAULT_PHONE_COUNTRY.code, phone: '',
}

export type DeliveryErrors = Partial<Record<keyof PhysicalDeliveryAddress, string>>
export type PhysicalOrderStatus = 'draft' | 'pending_payment' | 'paid' | 'issued' | 'failed' | 'canceled'
export interface PhysicalCardOrder {
  id: number
  status: PhysicalOrderStatus
  cardId: number | null
  price: string | null
  address: PhysicalDeliveryAddress
}
export interface PhysicalCardOptions {
  countries: readonly DeliveryCountry[]
  price: string | null
}
export interface CardRecipient {
  firstName: string | null
  lastName: string | null
}

export function deliveryPhoneCountries(countries: readonly DeliveryCountry[]): PhoneCountry[] {
  return countries.flatMap((country) => isSupportedCountry(country.code) && /^\+\d{1,4}$/.test(country.phoneCode)
    ? [{ ...country, code: country.code }] : [])
}

export function deliveryErrors(address: PhysicalDeliveryAddress, countries: readonly DeliveryCountry[]): DeliveryErrors {
  const errors: DeliveryErrors = {}
  for (const field of ['address', 'city', 'region', 'postcode', 'country', 'phoneCountry', 'phone'] as const) {
    if (!address[field].trim()) errors[field] = 'common.errors.required'
  }
  const country = countries.find((item) => item.code === address.country)
  if (!country) errors.country = 'common.errors.required'
  if (country && address.postcode.trim()) {
    try {
      const pattern = country.postalCodeRegex
      const regex = new RegExp(pattern.replace(/^\(\?i\)/, ''), pattern.startsWith('(?i)') ? 'i' : '')
      const match = regex.exec(address.postcode.trim())
      if (!match || match[0] !== address.postcode.trim()) errors.postcode = 'home.delivery.errors.postcode'
    } catch {
      errors.postcode = 'home.delivery.errors.postcode'
    }
  }
  const phoneCountry = deliveryPhoneCountries(countries).find((item) => item.code === address.phoneCountry)
  if (!phoneCountry) errors.phoneCountry = 'common.errors.required'
  if (phoneCountry && address.phone.trim()) {
    const phone = parsePhoneNumberFromString(formatPhoneNumber(phoneCountry, address.phone), phoneCountry.code)
    if (!phone?.isValid() || phone.country !== phoneCountry.code) errors.phone = 'home.delivery.errors.phone'
  }
  for (const field of ['address', 'apartment', 'city', 'region'] as const) {
    if (address[field].length > 255) errors[field] = 'home.delivery.errors.tooLong'
  }
  if (address.postcode.length > 20) errors.postcode = 'home.delivery.errors.postcode'
  return errors
}
