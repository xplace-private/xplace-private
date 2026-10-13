import { ApiRequestError, getApiErrorCode, isApiRequestError } from '../../../shared/api/api-client'
import { createCsrfApiClient } from '../../../shared/api/csrf-api-client'
import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { AuthGateway, AuthSession, AuthenticatorSetup } from './auth-gateway'

const STEP_KEY = 'partner-portal.auth-two-factor-step'
type TwoFactorStep = '2fa_setup' | '2fa_verify'
type StepStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type AuthOperation = 'login' | 'setup' | 'verify' | 'password' | 'logout' | 'forgot' | 'reset'

const failures: Record<string, { code: string; message: string }> = {
  invalid_credentials: { code: 'invalidCredentials', message: 'Invalid email or password.' },
  invalid_code: { code: 'incorrectCode', message: 'Incorrect code' },
  code_reused: { code: 'usedCode', message: 'This code has already been used. Wait for the next code.' },
  account_locked: { code: 'accountLocked', message: 'Too many attempts. Try again later.' },
  rate_limited: { code: 'rateLimited', message: 'Too many requests. Please try again later.' },
  invalid_password: { code: 'invalidPassword', message: 'Use at least 8 characters. Avoid common or entirely numeric passwords and choose a password different from your current one.' },
  invalid_request: { code: 'invalidRequest', message: 'Check the entered information and try again.' },
  invalid_token: { code: 'invalidToken', message: 'This reset link is invalid or has expired. Return to sign in to request a new link.' },
}

interface HttpAuthGatewayOptions {
  baseUrl: string
  fetch?: typeof globalThis.fetch
  storage?: StepStorage | null
  onUserChanged?: (user: { email: string } | null) => void
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(): never {
  throw new ApiRequestError('invalid-response', null, null, 'Invalid partner authentication response')
}

export function createHttpAuthGateway(options: HttpAuthGatewayOptions): AuthGateway {
  function getStorage() {
    try {
      return options.storage === undefined
        ? (typeof window === 'undefined' ? null : window.sessionStorage)
        : options.storage
    } catch { return null }
  }

  function readStep(): TwoFactorStep | null {
    try {
      const value = getStorage()?.getItem(STEP_KEY)
      return value === '2fa_setup' || value === '2fa_verify' ? value : null
    } catch { return null }
  }

  let step = readStep()
  let email: string | null = null
  let setupRequest: Promise<GatewayResult<AuthenticatorSetup>> | null = null
  let revision = 0

  function setStep(next: TwoFactorStep | null) {
    step = next
    try {
      if (next === null) getStorage()?.removeItem(STEP_KEY)
      else getStorage()?.setItem(STEP_KEY, next)
    } catch { /* The in-memory hint still works when browser storage is unavailable. */ }
  }

  function clearSession() {
    revision += 1
    setStep(null)
    email = null
    setupRequest = null
    options.onUserChanged?.(null)
  }

  const client = createCsrfApiClient({
    baseUrl: options.baseUrl,
    csrfPath: 'auth/csrf/',
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  })

  const unexpected = { ok: false, code: 'unexpected', message: 'Something went wrong. Please try again.' } as const

  function failure(error: unknown, operation: AuthOperation): Extract<GatewayResult, { ok: false }> {
    if (!isApiRequestError(error)) return unexpected
    if (error.kind === 'network') return { ok: false, code: 'network', message: 'Unable to connect. Please check your connection and try again.' }
    const code = getApiErrorCode(error)
    if (error.status === 403 && code?.startsWith('CSRF Failed:')) {
      return { ok: false, code: 'csrf', message: 'Unable to confirm the request. Please try again.' }
    }
    if (error.status === 401 && operation !== 'login' && operation !== 'forgot' && operation !== 'reset' && code !== 'invalid_code' && code !== 'code_reused') {
      clearSession()
      return { ok: false, code: 'session', message: 'Unable to continue. Please sign in again.' }
    }
    if (code === 'two_factor_required' && operation === 'logout') {
      return { ok: false, code: 'twoFactorRequired', message: 'Unable to sign out. Please try again later.' }
    }
    if (code === 'two_factor_setup_required' || code === 'two_factor_already_configured' || code === 'password_change_required' || code === 'two_factor_required') {
      revision += 1
      setupRequest = null
      if (code === 'two_factor_setup_required') setStep('2fa_setup')
      if (code === 'two_factor_already_configured') setStep('2fa_verify')
      if (code === 'password_change_required') setStep(null)
      return { ok: false, code: 'session', message: 'The required sign-in step has changed. Please continue.' }
    }
    const known = code === null || !Object.hasOwn(failures, code) ? undefined : failures[code]
    return known ? { ok: false, ...known } : unexpected
  }

  async function advance(path: string, json: unknown, operation: 'verify' | 'password'): Promise<GatewayResult> {
    try {
      const value = await client.request(path, { method: 'POST', json })
      if (!isObject(value) || (value.next !== 'done' && (operation !== 'verify' || value.next !== 'password_change'))) invalidResponse()
      revision += 1
      setStep(null)
      setupRequest = null
      return { ok: true }
    } catch (error) { return failure(error, operation) }
  }

  return {
    async getSession(): Promise<AuthSession> {
      const started = revision
      try {
        const value = await client.request('session/', { retry: false, expectedStatus: 204 })
        if (value !== null) invalidResponse()
        if (started === revision) {
          setStep(null)
          setupRequest = null
          options.onUserChanged?.(email === null ? null : { email })
        }
        return 'authenticated'
      } catch (error) {
        if (isApiRequestError(error) && error.status === 401) {
          if (started === revision) clearSession()
          return 'anonymous'
        }
        if (isApiRequestError(error) && error.status === 403) {
          if (getApiErrorCode(error) === 'password_change_required') {
            if (started === revision) { setStep(null); setupRequest = null }
            return 'password-required'
          }
          if (getApiErrorCode(error) === 'two_factor_required') {
            return step === '2fa_setup' ? 'authenticator-required' : step === '2fa_verify' ? 'two-factor-required' : 'anonymous'
          }
        }
        throw error
      }
    },
    async signIn(input): Promise<GatewayResult> {
      try {
        const normalizedEmail = input.email.trim().toLowerCase()
        const value = await client.request('auth/login/', { method: 'POST', json: { ...input, email: normalizedEmail } })
        if (!isObject(value) || (value.next !== '2fa_setup' && value.next !== '2fa_verify')) invalidResponse()
        revision += 1
        setupRequest = null
        setStep(value.next)
        email = normalizedEmail
        options.onUserChanged?.({ email })
        return { ok: true }
      } catch (error) { return failure(error, 'login') }
    },
    getAuthenticatorSetup() {
      const started = revision
      setupRequest ??= (async (): Promise<GatewayResult<AuthenticatorSetup>> => {
        try {
          const value = await client.request('auth/2fa/setup/', { method: 'POST' })
          if (!isObject(value) || typeof value.secret !== 'string' || !/^[A-Z2-7]+$/.test(value.secret) || typeof value.otpauth_uri !== 'string') invalidResponse()
          const uri = new URL(value.otpauth_uri)
          if (uri.protocol !== 'otpauth:' || uri.hostname !== 'totp' || uri.searchParams.get('secret') !== value.secret) invalidResponse()
          if (started !== revision) return { ok: false, code: 'session', message: 'Unable to continue. Please sign in again.' }
          return { ok: true, data: { secret: value.secret, uri: value.otpauth_uri } }
        } catch (error) {
          if (started !== revision) return { ok: false, code: 'session', message: 'Unable to continue. Please sign in again.' }
          setupRequest = null
          return failure(error, 'setup')
        }
      })()
      return setupRequest
    },
    verifyAuthenticatorCode({ code }) {
      return advance(step === '2fa_setup' ? 'auth/2fa/confirm/' : 'auth/2fa/verify/', { code }, 'verify')
    },
    setPassword({ password }) {
      return advance('auth/password/change/', { password }, 'password')
    },
    async requestPasswordReset({ email }) {
      try {
        const value = await client.request('auth/password/forgot/', { method: 'POST', json: { email: email.trim().toLowerCase() } })
        if (!isObject(value) || typeof value.message !== 'string' || !value.message.trim()) invalidResponse()
        return { ok: true }
      } catch (error) { return failure(error, 'forgot') }
    },
    async resetPassword({ token, password }) {
      try {
        const value = await client.request('auth/password/reset/', { method: 'POST', json: { token: token.trim(), password } })
        if (!isObject(value) || value.next !== 'done') invalidResponse()
        clearSession()
        return { ok: true }
      } catch (error) { return failure(error, 'reset') }
    },
    async signOut() {
      try {
        const value = await client.request('auth/logout/', { method: 'POST', expectedStatus: 204 })
        if (value !== null) invalidResponse()
        clearSession()
        return { ok: true }
      } catch (error) { return failure(error, 'logout') }
    },
  }
}
