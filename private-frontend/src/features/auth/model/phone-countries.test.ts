import { expect, test } from 'vitest'

import {
  filterPhoneCountries,
  formatPhoneInput,
  type PhoneCountry,
} from '../../../shared/phone/phone-countries'

const UNITED_STATES: PhoneCountry = {
  code: 'US',
  flag: '🇺🇸',
  name: 'United States',
  phoneCode: '+1',
}

test('formats phone input using the selected country', () => {
  expect(formatPhoneInput(UNITED_STATES, '2133734253')).toBe(
    '(213) 373-4253',
  )
})

test('keeps a pasted international prefix out of the national input', () => {
  expect(formatPhoneInput(UNITED_STATES, '+1 213 373 4253')).toBe(
    '(213) 373-4253',
  )
})

test('keeps the last typed digit directly deletable', () => {
  expect(formatPhoneInput(UNITED_STATES, '213')).toBe('(213')
})

const SEARCH_COUNTRIES: readonly PhoneCountry[] = [
  UNITED_STATES,
  {
    code: 'GB',
    flag: '🇬🇧',
    name: 'United Kingdom',
    phoneCode: '+44',
  },
  {
    code: 'AE',
    flag: '🇦🇪',
    name: 'United Arab Emirates',
    phoneCode: '+971',
  },
]

test.each([
  ['kingdom', ['GB']],
  ['  us  ', ['US']],
  ['+971', ['AE']],
])('filters phone countries using "%s"', (query, expectedCodes) => {
  expect(
    filterPhoneCountries(SEARCH_COUNTRIES, query).map(({ code }) => code),
  ).toEqual(expectedCodes)
})

test('keeps every phone country when search is empty', () => {
  expect(filterPhoneCountries(SEARCH_COUNTRIES, '   ')).toBe(SEARCH_COUNTRIES)
})

test('puts an exact ISO country code before broader name matches', () => {
  const israel: PhoneCountry = {
    code: 'IL',
    flag: '🇮🇱',
    name: 'Israel',
    phoneCode: '+972',
  }

  expect(
    filterPhoneCountries([israel, ...SEARCH_COUNTRIES], 'ae').map(
      ({ code }) => code,
    ),
  ).toEqual(['AE', 'IL'])
})
