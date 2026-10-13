import type { TwoFactorRequirement } from './authenticator-gateway'

interface AuthSessionStorage {
  removeItem(key: string): void
}

export type AuthSessionStatus = 'unknown' | 'authenticated' | 'anonymous' | TwoFactorRequirement

export interface AuthSessionStore {
  readStatus(): AuthSessionStatus
  markAuthenticated(): void
  requireTwoFactor(requirement: TwoFactorRequirement): void
  clear(): void
  subscribe(listener: () => void): () => void
}

const LEGACY_ACCESS_TOKEN_KEY = 'xplace.auth.access'
const LEGACY_REFRESH_TOKEN_KEY = 'xplace.auth.refresh'

export function createBrowserAuthSessionStore(
  storage: AuthSessionStorage | null,
): AuthSessionStore {
  const listeners = new Set<() => void>()
  let status: AuthSessionStatus = 'unknown'

  try {
    storage?.removeItem(LEGACY_ACCESS_TOKEN_KEY)
    storage?.removeItem(LEGACY_REFRESH_TOKEN_KEY)
  } catch {
    // Storage can be unavailable in private browsing or embedded WebViews.
  }

  const publish = (nextStatus: AuthSessionStatus) => {
    if (status === nextStatus) return
    status = nextStatus
    listeners.forEach((listener) => listener())
  }

  return {
    readStatus: () => status,
    markAuthenticated: () => publish('authenticated'),
    requireTwoFactor: publish,
    clear: () => publish('anonymous'),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function getLocalStorage(): AuthSessionStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const browserAuthSessionStore = createBrowserAuthSessionStore(
  getLocalStorage(),
)
