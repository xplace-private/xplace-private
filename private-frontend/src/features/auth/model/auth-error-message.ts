import type { TFunction } from 'i18next'

import { formatResendDuration } from './resend-countdown'
import type { AuthFlowGatewayError } from './auth-flow'

const AUTH_ERROR_KEYS = {
  'Phone number is required': 'auth.errors.phoneRequired',
  'Invalid phone number': 'auth.errors.invalidPhone',
  'Invalid phone number format': 'auth.errors.invalidPhoneFormat',
  'Ensure this field has no more than 20 characters.':
    'auth.errors.phoneTooLong',
  'Invalid phone number. Use the international format.':
    'auth.errors.invalidPhoneFormat',
  'WhatsApp verification is unavailable': 'auth.errors.whatsappUnavailable',
  'Invalid or expired verification': 'auth.errors.invalidOrExpiredCode',
  'Ensure this field has at most 8 characters.': 'auth.errors.invalidCode',
} as const

const GENERIC_AUTH_ERRORS = new Set([
  'Something went wrong. Please try again.',
  'Unable to continue. Try again.',
  'Invalid origin',
  'Failed to send verification code',
])

export function authErrorMessage(
  error: AuthFlowGatewayError,
  t: TFunction,
): string {
  if (error.retryAfterSeconds !== undefined) {
    const time = formatResendDuration(error.retryAfterSeconds, {
      hour: t('auth.code.hourShort'),
      minute: t('auth.code.minuteShort'),
      second: t('auth.code.secondShort'),
      separator: t('auth.code.unitSeparator'),
    })
    return t('auth.errors.retryAfter', { time })
  }

  const message = error.message.trim()
  if (message === '' || GENERIC_AUTH_ERRORS.has(message)) {
    return t('auth.errors.continue')
  }

  const key = AUTH_ERROR_KEYS[message as keyof typeof AUTH_ERROR_KEYS]
  return key === undefined ? message : t(key)
}
