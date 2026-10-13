import type { GatewayResult } from '../../../shared/api/gateway-result'
import { isValidPassword } from '../../../shared/password-validation'
import { createTotpSecret, findTotpStep } from '../totp'
import type { AuthGateway, AuthSession } from './auth-gateway'

const SESSION_KEY = 'partner-portal.mock-auth-session.v2'
const storageError = { ok: false, code: 'storage', message: 'Unable to access your session. Check browser storage settings and try again.' } as const
const sessionError = { ok: false, code: 'session', message: 'Unable to continue. Please sign in again.' } as const
const incorrectCode = { ok: false, code: 'incorrectCode', message: 'Incorrect code' } as const
type SessionStorage = Pick<Storage, 'getItem' | 'setItem'>
interface MockAccount {
  email: string
  secret: string
  enrolled: boolean
  // Older demo sessions do not have this field.
  passwordSet?: boolean
  lastUsedStep: number | null
}
interface MockState {
  session: AuthSession
  email: string | null
  accounts: MockAccount[]
}

function emptyState(): MockState {
  return { session: 'anonymous', email: null, accounts: [] }
}

function isAccount(value: unknown): value is MockAccount {
  return typeof value === 'object' && value !== null &&
    'email' in value && typeof value.email === 'string' && value.email.length > 0 && value.email === value.email.trim().toLowerCase() &&
    'secret' in value && typeof value.secret === 'string' && /^[A-Z2-7]{32}$/.test(value.secret) &&
    'enrolled' in value && typeof value.enrolled === 'boolean' &&
    (!('passwordSet' in value) || typeof value.passwordSet === 'boolean') &&
    'lastUsedStep' in value && (value.lastUsedStep === null || (typeof value.lastUsedStep === 'number' && Number.isSafeInteger(value.lastUsedStep) && value.lastUsedStep >= 0))
}

function parseState(raw: string | null): MockState {
  if (!raw) return emptyState()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return emptyState() }
  if (typeof value !== 'object' || value === null || !('session' in value) ||
    !('email' in value) || !('accounts' in value) || !Array.isArray(value.accounts) || !value.accounts.every(isAccount) ||
    new Set(value.accounts.map((account) => account.email)).size !== value.accounts.length) return emptyState()
  const { session, email, accounts } = value
  if (session === 'anonymous' && email === null) return { session, email, accounts }
  const account = accounts.find((entry) => entry.email === email)
  if (typeof email !== 'string' || !account) return emptyState()
  if ((session === 'authenticator-required' && !account.enrolled) ||
    (session === 'password-required' && !account.enrolled && !account.passwordSet) ||
    (session === 'two-factor-required' && account.enrolled) ||
    (session === 'authenticated' && ((account.enrolled && account.lastUsedStep !== null) ||
      (account.passwordSet && !account.enrolled && account.lastUsedStep === null)))) return { session, email, accounts }
  return emptyState()
}

/** Demo accounts and TOTP keys only. Passwords are never stored or sent over the network. */
export function createMockAuthGateway(
  storage?: SessionStorage,
  onUserChanged?: (user: { email: string } | null) => void,
): AuthGateway {
  let memory = emptyState()

  function getStorage() {
    return storage ?? (typeof window === 'undefined' ? null : window.sessionStorage)
  }

  function readState(): MockState {
    const store = getStorage()
    return store ? parseState(store.getItem(SESSION_KEY)) : memory
  }

  async function advance(expected: MockState, next: MockState): Promise<GatewayResult> {
    await new Promise((resolve) => setTimeout(resolve, 250))
    if (JSON.stringify(readState()) !== JSON.stringify(expected)) return sessionError
    getStorage()?.setItem(SESSION_KEY, JSON.stringify(next))
    memory = next
    onUserChanged?.(next.email === null ? null : { email: next.email })
    return { ok: true }
  }

  return {
    getSession: async () => {
      const state = readState()
      onUserChanged?.(state.email === null ? null : { email: state.email })
      return state.session
    },
    async signIn({ email, password }) {
      email = email.trim().toLowerCase()
      if (!email || !password.trim()) return { ok: false, code: 'credentials', message: 'Enter your email and password.' }
      try {
        const state = readState()
        if (state.session !== 'anonymous') return sessionError
        const account = state.accounts.find((entry) => entry.email === email)
        const nextAccount: MockAccount = account ?? { email, secret: createTotpSecret(), enrolled: false, lastUsedStep: null }
        return await advance(state, {
          session: !nextAccount.enrolled ? 'authenticator-required' : 'two-factor-required',
          email,
          accounts: account ? state.accounts : [...state.accounts, nextAccount],
        })
      } catch { return storageError }
    },
    async getAuthenticatorSetup() {
      try {
        const state = readState()
        const account = state.accounts.find((entry) => entry.email === state.email)
        if ((state.session !== 'authenticator-required' && state.session !== 'authenticated') || !account || account.enrolled) return sessionError
        const issuer = 'XPlace Partners'
        const params = new URLSearchParams({ secret: account.secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
        return { ok: true, data: { secret: account.secret, uri: `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account.email)}?${params}` } }
      } catch { return storageError }
    },
    async verifyAuthenticatorCode({ code }) {
      try {
        const state = readState()
        if (state.session !== 'authenticator-required' && state.session !== 'two-factor-required' && state.session !== 'authenticated') return sessionError
        const account = state.accounts.find((entry) => entry.email === state.email)
        if (!account || (state.session === 'authenticated' && account.enrolled)) return sessionError
        const step = await findTotpStep(account.secret, code)
        if (step === null) return incorrectCode
        if (account.lastUsedStep !== null && step <= account.lastUsedStep) {
          return { ok: false, code: 'usedCode', message: 'This code has already been used. Wait for the next code.' }
        }
        return await advance(state, {
          ...state,
          session: state.session === 'two-factor-required' || state.session === 'authenticated' || account.passwordSet ? 'authenticated' : 'password-required',
          accounts: state.accounts.map((entry) => entry === account ? { ...entry, lastUsedStep: step, enrolled: entry.enrolled || entry.passwordSet === true } : entry),
        })
      } catch { return storageError }
    },
    async setPassword({ password }) {
      if (!isValidPassword(password)) return { ok: false, code: 'password', message: 'Your password must meet all the requirements below.' }
      try {
        const state = readState()
        if (state.session !== 'password-required') return sessionError
        return await advance(state, {
          ...state,
          session: 'authenticated',
          accounts: state.accounts.map((account) => account.email === state.email ? { ...account, passwordSet: true, enrolled: account.lastUsedStep !== null } : account),
        })
      } catch { return storageError }
    },
    async signOut() {
      try {
        const state = readState()
        if (state.session !== 'authenticated') return sessionError
        return await advance(state, { ...state, session: 'anonymous', email: null })
      } catch { return storageError }
    },
    async requestPasswordReset() {
      return { ok: false, code: 'unexpected', message: 'Password recovery is unavailable in the demo.' }
    },
    async resetPassword() {
      return { ok: false, code: 'unexpected', message: 'Password recovery is unavailable in the demo.' }
    },
  }
}
