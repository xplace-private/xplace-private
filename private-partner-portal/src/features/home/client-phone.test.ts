import { expect, test } from 'vitest'

import { formatClientPhone } from './client-phone'

test.each([
  ['+971501234567', '+971 50 123 4567'],
  ['+12025550123', '+1 202 555 0123'],
  ['+442079460958', '+44 20 7946 0958'],
  ['+79161234567', '+7 916 123 45 67'],
  ['  +971501234567  ', '+971 50 123 4567'],
])('formats raw international phone %s using its country calling code', (raw, formatted) => {
  expect(formatClientPhone(raw)).toBe(formatted)
})

test.each([
  '+1 (202) 555-0123', '+971 50 123 4567', '02079460958', '971501234567',
  '+999123456789', '+123', '+12025550123456', '+4402079460958', '+12025550123 ext. 42',
  'Call +12025550123', 'not a phone', '   ', '', null,
])('preserves already formatted, ambiguous, invalid and missing phone values: %s', value => {
  expect(formatClientPhone(value)).toBe(value)
})

test('formatting is stable and retains all digits', () => {
  const raw = '+79161234567'
  const formatted = formatClientPhone(raw)
  expect(formatClientPhone(formatted)).toBe(formatted)
  expect(formatted?.replace(/\D/g, '')).toBe(raw.slice(1))
})
