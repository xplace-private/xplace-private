import parsePhoneNumber from 'libphonenumber-js/max'

export function formatClientPhone(value: string | null): string | null {
  if (value === null) return value
  const raw = value.trim()
  if (!/^\+\d+$/.test(raw)) return value
  const phone = parsePhoneNumber(raw, { extract: false })
  return phone?.isValid() && phone.number === raw ? phone.formatInternational() : value
}
