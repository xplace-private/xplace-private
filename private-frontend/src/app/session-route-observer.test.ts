import { expect, test, vi } from 'vitest'

import type {
  AuthSessionStatus,
  AuthSessionStore,
} from '../features/auth/api/browser-auth-session-store'

vi.mock('../shared/api/app-env', () => ({
  appEnv: { mode: 'test', apiBaseUrl: 'https://back.example.test' },
}))

import {
  observeSessionRouteAccess,
  registerSessionRouteObserverDisposal,
} from './session-route-observer'

function createStore(initialStatus: AuthSessionStatus): AuthSessionStore {
  let status = initialStatus
  const listeners = new Set<() => void>()
  const publish = (nextStatus: AuthSessionStatus) => {
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

test('invalidates route access when the cookie session becomes anonymous', () => {
  const store = createStore('authenticated')
  const invalidate = vi.fn(() => Promise.resolve())
  observeSessionRouteAccess(store, { invalidate })

  store.clear()

  expect(invalidate).toHaveBeenCalledOnce()
})

test('leaves verified session adoption to the explicit OTP route handoff', () => {
  const store = createStore('anonymous')
  const invalidate = vi.fn(() => Promise.resolve())
  observeSessionRouteAccess(store, { invalidate })

  store.markAuthenticated()

  expect(invalidate).not.toHaveBeenCalled()
})

test('hot disposal unsubscribes the session route observer', () => {
  const store = createStore('authenticated')
  const invalidate = vi.fn(() => Promise.resolve())
  const stopObserving = observeSessionRouteAccess(store, { invalidate })
  const disposal: { current: (() => void) | null } = { current: null }

  registerSessionRouteObserverDisposal(
    {
      dispose(callback) {
        disposal.current = callback
      },
    },
    stopObserving,
  )

  const dispose = disposal.current
  if (dispose === null) throw new Error('Hot dispose callback was not captured')
  dispose()
  store.clear()

  expect(invalidate).not.toHaveBeenCalled()
})
