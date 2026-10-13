import { ApiRequestError, getApiErrorCode, isApiRequestError } from '../../../shared/api/api-client'
import { createCsrfApiClient } from '../../../shared/api/csrf-api-client'
import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { PartnerProfile, ProfileGateway } from './profile-gateway'
import { ProfileSessionError } from './profile-gateway'

interface HttpProfileGatewayOptions {
  baseUrl: string
  fetch?: typeof globalThis.fetch
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function invalidResponse(): never {
  throw new ApiRequestError('invalid-response', null, null, 'Invalid partner profile response')
}

const failures: Record<string, { code: string; message: string }> = {
  invalid_credentials: { code: 'currentPassword', message: 'Current password is incorrect.' },
  invalid_code: { code: 'incorrectCode', message: 'Incorrect code' },
  code_reused: { code: 'usedCode', message: 'This code has already been used. Wait for the next code.' },
  invalid_password: { code: 'invalidPassword', message: 'Use at least 8 characters. Avoid common or entirely numeric passwords and choose a password different from your current one.' },
  invalid_request: { code: 'invalidRequest', message: 'Check the entered information and try again.' },
  account_locked: { code: 'accountLocked', message: 'Too many attempts. Try again later.' },
  rate_limited: { code: 'rateLimited', message: 'Too many requests. Please try again later.' },
}

function needsSessionRefresh(error: unknown): boolean {
  if (!isApiRequestError(error)) return false
  const code = getApiErrorCode(error)
  return (error.status === 401 && (code === null || !Object.hasOwn(failures, code)))
    || (error.status === 403 && (code === 'two_factor_required' || code === 'password_change_required' || code === 'two_factor_setup_required'))
}

export function createHttpProfileGateway(options: HttpProfileGatewayOptions): ProfileGateway {
  const client = createCsrfApiClient({ ...options, csrfPath: 'auth/csrf/' })

  function failure(error: unknown): Extract<GatewayResult, { ok: false }> {
    if (isApiRequestError(error)) {
      const code = getApiErrorCode(error)
      if (error.status === 403 && code?.startsWith('CSRF Failed:')) {
        return { ok: false, code: 'csrf', message: 'Unable to confirm the request. Please try again.' }
      }
      if (needsSessionRefresh(error)) return { ok: false, code: 'session', message: 'Unable to continue. Please sign in again.' }
      if (error.kind === 'network') return { ok: false, code: 'network', message: 'Unable to connect. Please check your connection and try again.' }
      const known = code !== null && Object.hasOwn(failures, code) ? failures[code] : undefined
      if (known) return { ok: false, ...known }
    }
    return { ok: false, code: 'unexpected', message: 'Something went wrong. Please try again.' }
  }

  async function read(path: string, signal: AbortSignal): Promise<unknown> {
    try { return await client.request(path, { signal, retry: false }) }
    catch (error) {
      if (needsSessionRefresh(error)) throw new ProfileSessionError()
      throw error
    }
  }
  return {
    async getProfile(signal): Promise<PartnerProfile> {
      const value = await read('me/', signal)
      if (!isObject(value) || !isObject(value.partner) || !isObject(value.account)
        || !isNullableString(value.partner.name) || !isNullableString(value.partner.slug)
        || !isNullableString(value.account.full_name) || !isNullableString(value.account.email) || !isNullableString(value.account.phone)
        || typeof value.must_change_password !== 'boolean' || typeof value.totp_configured !== 'boolean') invalidResponse()
      return {
        company: value.partner.name, partnerSlug: value.partner.slug,
        fullName: value.account.full_name, email: value.account.email, phone: value.account.phone,
        mustChangePassword: value.must_change_password, totpConfigured: value.totp_configured,
      }
    },
    async changePassword({ currentPassword, password, code }): Promise<GatewayResult> {
      try {
        const value = await client.request('auth/password/change/', { method: 'POST', expectedStatus: 200, json: { current_password: currentPassword, password, code } })
        if (!isObject(value) || value.next !== 'done') invalidResponse()
        return { ok: true }
      } catch (error) { return failure(error) }
    },
    async revokeOtherSessions(): Promise<GatewayResult> {
      try {
        await client.request('auth/sessions/revoke-all/', { method: 'POST', expectedStatus: 204 })
        return { ok: true }
      } catch (error) { return failure(error) }
    },
  }
}
