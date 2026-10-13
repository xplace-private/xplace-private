import { expect, test, vi } from 'vitest'

import { observeInfiniteScroll } from './observe-infinite-scroll'

test('loads the next page only when the sentinel intersects and disconnects on cleanup', () => {
  const loadMore = vi.fn()
  const disconnect = vi.fn()
  const observe = vi.fn()
  let callback!: IntersectionObserverCallback
  const Observer = vi.fn(function (this: IntersectionObserver, next: IntersectionObserverCallback) {
    callback = next
    return { observe, disconnect }
  }) as unknown as typeof IntersectionObserver
  const node = {} as Element

  const cleanup = observeInfiniteScroll(node, loadMore, Observer)
  expect(observe).toHaveBeenCalledWith(node)

  callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
  expect(loadMore).not.toHaveBeenCalled()
  callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  expect(loadMore).toHaveBeenCalledTimes(1)

  cleanup()
  expect(disconnect).toHaveBeenCalledTimes(1)
})
