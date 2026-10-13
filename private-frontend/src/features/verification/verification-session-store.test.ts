import { expect, test } from 'vitest'

import { createVerificationSessionStore } from './verification-session-store'

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
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

test('keeps submitted and one-time attempt failure flags in the current tab', () => {
  const storage = createMemoryStorage()
  const store = createVerificationSessionStore(() => storage)

  expect(store.isSubmitted()).toBe(false)
  store.markSubmitted()
  expect(store.isSubmitted()).toBe(true)
  store.markAttemptFailed()
  expect(store.consumeAttemptFailure()).toBe(true)
  expect(store.consumeAttemptFailure()).toBe(false)
  store.clear()
  expect(storage.length).toBe(0)
})

test('does not remove unrelated current-tab storage when clearing verification flags', () => {
  const storage = createMemoryStorage()
  storage.setItem('xplace.unrelated', 'preserve')
  const store = createVerificationSessionStore(() => storage)

  store.markSubmitted()
  store.markAttemptFailed()
  store.clear()

  expect(storage.getItem('xplace.unrelated')).toBe('preserve')
  expect(storage.length).toBe(1)
})
