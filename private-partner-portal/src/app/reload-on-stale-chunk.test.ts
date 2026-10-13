import { afterEach, expect, test, vi } from 'vitest'

import { reloadOnStaleChunk } from './reload-on-stale-chunk'

afterEach(() => vi.unstubAllGlobals())

function setup() {
  const values = new Map<string, string>()
  const reload = vi.fn()
  const window = Object.assign(new EventTarget(), { location: { reload } })
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
  }
  vi.stubGlobal('window', window)
  vi.stubGlobal('sessionStorage', storage)
  return { window, storage, reload }
}

test('recovers once, keeps later failures visible, and does not loop after reload', () => {
  const { window, reload } = setup()
  const stop = reloadOnStaleChunk()
  const first = new Event('vite:preloadError', { cancelable: true })
  window.dispatchEvent(first)
  expect(first.defaultPrevented).toBe(true)
  expect(reload).toHaveBeenCalledOnce()
  stop()

  const stopAfterReload = reloadOnStaleChunk()
  const second = new Event('vite:preloadError', { cancelable: true })
  window.dispatchEvent(second)
  expect(second.defaultPrevented).toBe(false)
  expect(reload).toHaveBeenCalledOnce()
  stopAfterReload()
})

test.each(['getItem', 'setItem'] as const)('leaves manual recovery available when storage %s fails', (method) => {
  const { window, storage, reload } = setup()
  storage[method].mockImplementation(() => { throw new Error('Storage unavailable') })
  const stop = reloadOnStaleChunk()
  const event = new Event('vite:preloadError', { cancelable: true })

  window.dispatchEvent(event)

  expect(reload).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
  stop()
})

test('removes the listener when its owner is disposed', () => {
  const { window, reload } = setup()
  const stop = reloadOnStaleChunk()
  stop()
  window.dispatchEvent(new Event('vite:preloadError'))
  expect(reload).not.toHaveBeenCalled()
})
