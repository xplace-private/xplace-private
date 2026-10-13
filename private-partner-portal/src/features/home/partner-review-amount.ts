export function parseAmount(value: string) {
  const text = value.trim()
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.replaceAll(',', '').split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents / 100 : null
}

export function formatAmountOnBlur(value: string) {
  if (parseAmount(value) === null) return null
  const [whole, fraction = ''] = value.replaceAll(',', '').split('.')
  return `${whole!.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}

export function formatAmountInput(rawValue: string, rawCaret: number, previousValue = '', inputType = '') {
  let raw = rawValue
  let caret = Math.max(0, Math.min(rawCaret, raw.length))
  if (previousValue[caret] === ',' && previousValue.length === raw.length + 1) {
    const digitIndex = inputType === 'deleteContentBackward' ? caret - 1 : inputType === 'deleteContentForward' ? caret : -1
    if (digitIndex >= 0 && /\d/.test(raw[digitIndex] ?? '')) {
      raw = raw.slice(0, digitIndex) + raw.slice(digitIndex + 1)
      caret = digitIndex
    }
  }

  const decimalIndex = raw.indexOf('.')
  const commas = raw.match(/,/g)?.length ?? 0
  const decimalComma = decimalIndex < 0 && commas === 1 &&
    (inputType === 'insertFromPaste' || !previousValue.includes(',')) &&
    /^\D*\d+,\d{0,2}\D*$/.test(raw)
  const separatorIndex = decimalIndex >= 0 ? decimalIndex : decimalComma ? raw.indexOf(',') : -1
  const integerDigits = (separatorIndex < 0 ? raw : raw.slice(0, separatorIndex)).replace(/\D/g, '').replace(/^0+(?=\d)/, '') || (separatorIndex >= 0 ? '0' : '')
  const integer = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = separatorIndex < 0 ? '' : raw.slice(separatorIndex + 1).replace(/\D/g, '').slice(0, 2)
  const value = integer + (separatorIndex >= 0 ? `.${fraction}` : '')
  if (value && parseAmount(value) === null) {
    return { value: previousValue, caret: Math.min(caret, previousValue.length) }
  }

  if (separatorIndex >= 0 && caret > separatorIndex) {
    const fractionBeforeCaret = raw.slice(separatorIndex + 1, caret).replace(/\D/g, '').length
    return { value, caret: integer.length + 1 + Math.min(fractionBeforeCaret, fraction.length) }
  }
  const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length
  if (!digitsBeforeCaret) return { value, caret: 0 }
  let digits = 0
  let formattedCaret = integer.length
  for (let index = 0; index < integer.length; index++) {
    if (/\d/.test(integer[index]!)) digits++
    if (digits === Math.min(digitsBeforeCaret, integerDigits.length)) { formattedCaret = index + 1; break }
  }
  if (raw[caret - 1] === ',' && !decimalComma && integer[formattedCaret] === ',') formattedCaret++
  return { value, caret: formattedCaret }
}
