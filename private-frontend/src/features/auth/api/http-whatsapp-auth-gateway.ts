import {
  isApiRequestError,
  type ApiClient,
} from '../../../shared/api/api-client'
import { formatResendDuration } from '../model/resend-countdown'
import type { AuthGateway } from './auth-gateway'
import type { TwoFactorRequirement } from './authenticator-gateway'

const DEFAULT_OTP_ERROR = 'Something went wrong. Please try again.'

interface SessionCsrfToken {
  invalidate(): void
}

export function createHttpWhatsAppAuthGateway(
  apiClient: ApiClient,
  csrfToken: SessionCsrfToken,
  getPartner: () => 'ww' | 'xplace',
): AuthGateway {
  return {
    async requestCode({ phone }: { phone: string }) {
      try {
        const body = await apiClient.request('users/web/auth/whatsapp/start/', {
          method: 'POST',
          json: { phone: normalizePhone(phone) },
          retry: false,
        })
        const challenge = readChallenge(body)
        if (challenge === null) return requestFailure()

        return { ok: true as const, data: challenge }
      } catch (error: unknown) {
        const body = readApiErrorBody(
          isApiRequestError(error) ? error.body : undefined,
        )
        const retryAfterSeconds = readRetryAfterSeconds(body)
        return retryAfterSeconds === null
          ? requestFailure(undefined, readApiErrorMessage(body))
          : requestFailure(retryAfterSeconds)
      }
    },
    async verifyOtp({
      challengeId,
      code,
    }: {
      challengeId: string
      code: string
    }) {
      try {
        const body = await apiClient.request('users/web/auth/whatsapp/verify/', {
          method: 'POST',
          json: { challenge_id: challengeId, otp: code, partner: getPartner() },
          retry: false,
        })
        const verification = readVerification(body)
        if (verification === null) return verificationFailure()

        csrfToken.invalidate()
        return { ok: true as const, data: verification }
      } catch (error: unknown) {
        const body = readApiErrorBody(
          isApiRequestError(error) ? error.body : undefined,
        )
        return verificationFailure(readApiErrorMessage(body))
      }
    },
    async signOut() {
      await apiClient.request('users/web/auth/logout/', {
        method: 'POST',
        retry: false,
      })
      csrfToken.invalidate()
    },
  }
}

function readVerification(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.is_new !== 'boolean' ||
    typeof record.is_private !== 'boolean' ||
    typeof record.totp_setup_required !== 'boolean' ||
    typeof record.totp_required !== 'boolean' ||
    (record.totp_setup_required && record.totp_required) ||
    (!record.is_private && (record.totp_setup_required || record.totp_required))
  ) {
    return null
  }

  const twoFactorRequirement: TwoFactorRequirement | null = record.totp_setup_required
    ? 'totp_setup_required'
    : record.totp_required ? 'totp_required' : null
  return { isNew: record.is_new, isPrivate: record.is_private, twoFactorRequirement }
}

function readChallenge(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const challengeId = record.challenge_id
  const expiresInSeconds = record.expires_in_seconds
  const resendAfterSeconds = record.resend_after_seconds
  if (
    typeof challengeId !== 'string' ||
    challengeId.trim() === '' ||
    !isNonNegativeInteger(expiresInSeconds) ||
    !isNonNegativeInteger(resendAfterSeconds)
  ) {
    return null
  }

  return { challengeId, expiresInSeconds, resendAfterSeconds }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function readApiErrorBody(value: unknown): unknown {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function readRetryAfterSeconds(value: unknown): number | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const retryAfterSeconds = (value as Record<string, unknown>)
    .retry_after_seconds
  return isNonNegativeInteger(retryAfterSeconds) ? retryAfterSeconds : null
}

function readApiErrorMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  const messages: string[] = []
  for (const [key, fieldValue] of Object.entries(value)) {
    const candidates = Array.isArray(fieldValue)
      ? fieldValue
      : key === 'error' || key === 'detail'
        ? [fieldValue]
        : []

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue
      const message = candidate.trim()
      if (message !== '') messages.push(message)
    }
  }

  return messages.length === 0 ? undefined : messages.join(' ')
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return `+${digits}`
}

function requestFailure(retryAfterSeconds?: number, message?: string) {
  const failure = {
    ok: false as const,
    code: 'otp-request-failed',
    message:
      retryAfterSeconds === undefined
        ? (message ?? DEFAULT_OTP_ERROR)
        : `Please try again in ${formatResendDuration(retryAfterSeconds)}.`,
  }

  return retryAfterSeconds === undefined
    ? failure
    : { ...failure, retryAfterSeconds }
}

function verificationFailure(message?: string) {
  return {
    ok: false as const,
    code: 'otp-verification-failed',
    message: message ?? DEFAULT_OTP_ERROR,
  }
}
