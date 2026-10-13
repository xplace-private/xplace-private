import { isApiRequestError, type ApiClient } from '../../../shared/api/api-client'
import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { AuthenticatorGateway, AuthenticatorSetup } from './authenticator-gateway'

const FAILURE = { ok: false, code: 'authenticator-failed', message: 'Unable to continue. Try again.' } as const

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readSetup(value: unknown): AuthenticatorSetup | null {
  if (!isObject(value) || typeof value.secret !== 'string' || !/^[A-Z2-7]+$/.test(value.secret) || typeof value.otpauth_uri !== 'string') return null
  try {
    const uri = new URL(value.otpauth_uri)
    if (uri.protocol !== 'otpauth:' || uri.hostname !== 'totp' || uri.searchParams.get('secret') !== value.secret) return null
    return { secret: value.secret, uri: value.otpauth_uri }
  } catch {
    return null
  }
}

function failure(error: unknown): Extract<GatewayResult, { ok: false }> {
  if (!isApiRequestError(error)) return FAILURE
  let body: unknown = error.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) as unknown } catch { return FAILURE }
  }
  if (!isObject(body)) return FAILURE
  if (body.error === 'invalid_code' || (error.status === 400 && Array.isArray(body.code))) {
    return { ok: false, code: 'invalid_code', message: 'Incorrect code' }
  }
  if (body.error === 'too_many_attempts') {
    return { ok: false, code: 'too_many_attempts', message: 'Too many attempts. Try again later.' }
  }
  if (body.error === 'totp_already_enabled' || body.error === 'totp_setup_required') {
    return { ok: false, code: 'session-changed', message: 'Unable to continue. Try again.' }
  }
  return FAILURE
}

export function createHttpAuthenticatorGateway(apiClient: ApiClient): AuthenticatorGateway {
  return {
    async getSetup(signal) {
      try {
        const setup = readSetup(await apiClient.request('users/web/auth/totp/setup/', {
          method: 'POST', authenticated: true, retry: false, signal,
        }))
        return setup === null ? FAILURE : { ok: true, data: setup }
      } catch (error) {
        return failure(error)
      }
    },
    async verifyCode({ code, requirement }) {
      if (!/^[0-9]{6}$/.test(code)) return { ok: false, code: 'invalid_code', message: 'Incorrect code' }
      const setup = requirement === 'totp_setup_required'
      try {
        const body = await apiClient.request(`users/web/auth/totp/${setup ? 'confirm' : 'verify'}/`, {
          method: 'POST', json: { code }, authenticated: true, retry: false,
        })
        return isObject(body) && body[setup ? 'totp_enabled' : 'totp_verified'] === true
          ? { ok: true }
          : FAILURE
      } catch (error) {
        return failure(error)
      }
    },
  }
}
