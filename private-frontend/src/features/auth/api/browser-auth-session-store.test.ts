import { describe, expect, test, vi } from 'vitest'

import { createBrowserAuthSessionStore } from './browser-auth-session-store'

function createMemoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries))

  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

describe('browser auth session store', () => {
  test('keeps unfinished 2FA in memory and starts unknown after a reload', () => {
    const storage = createMemoryStorage()
    const store = createBrowserAuthSessionStore(storage)
    store.requireTwoFactor('totp_setup_required')
    expect(store.readStatus()).toBe('totp_setup_required')
    store.requireTwoFactor('totp_required')
    expect(store.readStatus()).toBe('totp_required')
    expect(storage.values.size).toBe(0)
    expect(createBrowserAuthSessionStore(storage).readStatus()).toBe('unknown')
  })
  test('starts unknown and removes legacy JWT values from browser storage', () => {
    const storage = createMemoryStorage({
      'xplace.auth.access': 'legacy-access',
      'xplace.auth.refresh': 'legacy-refresh',
      unrelated: 'keep-me',
    })

    const store = createBrowserAuthSessionStore(storage)

    expect(store.readStatus()).toBe('unknown')
    expect(storage.values).toEqual(new Map([['unrelated', 'keep-me']]))
  })

  test('publishes authenticated and anonymous session transitions in memory', () => {
    const storage = createMemoryStorage()
    const store = createBrowserAuthSessionStore(storage)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.markAuthenticated()
    expect(store.readStatus()).toBe('authenticated')
    store.clear()
    expect(store.readStatus()).toBe('anonymous')
    expect(storage.values.size).toBe(0)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    store.markAuthenticated()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
