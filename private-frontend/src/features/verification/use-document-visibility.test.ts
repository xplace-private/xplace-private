import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test } from 'vitest'

import { useDocumentVisibility } from './use-document-visibility'

class VisibilityDocumentDouble {
  visibilityState: DocumentVisibilityState
  addedListeners: EventListener[] = []
  removedListeners: EventListener[] = []
  private listeners = new Set<EventListener>()

  constructor(visibilityState: DocumentVisibilityState) {
    this.visibilityState = visibilityState
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ) {
    if (type !== 'visibilitychange' || typeof listener !== 'function') return
    this.addedListeners.push(listener)
    this.listeners.add(listener)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ) {
    if (type !== 'visibilitychange' || typeof listener !== 'function') return
    this.removedListeners.push(listener)
    this.listeners.delete(listener)
  }

  changeVisibility(visibilityState: DocumentVisibilityState) {
    this.visibilityState = visibilityState
    for (const listener of this.listeners) listener(new Event('visibilitychange'))
  }
}

let root: Root | null = null

function createEmptyReactContainer(): Element {
  const ownerDocument = {
    nodeType: 9,
    documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
    addEventListener() {},
    removeEventListener() {},
  }
  return {
    nodeType: 1,
    nodeName: 'DIV',
    tagName: 'DIV',
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Element
}

function mount(target: VisibilityDocumentDouble, values: boolean[]) {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as unknown as { window?: unknown }).window = {
    HTMLIFrameElement: class {},
  }
  root = createRoot(createEmptyReactContainer())

  function Probe() {
    values.push(useDocumentVisibility(target))
    return null
  }

  act(() => root?.render(createElement(Probe)))
}

afterEach(() => {
  if (root !== null) act(() => root?.unmount())
  root = null
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT
  delete (globalThis as unknown as { window?: unknown }).window
})

test.each([
  ['visible', true],
  ['hidden', false],
] as const)('reports an initially %s document as %s', (visibilityState, expected) => {
  const target = new VisibilityDocumentDouble(visibilityState)
  const values: boolean[] = []

  mount(target, values)

  expect(values).toEqual([expected])
})

test('updates once for each visibility change', () => {
  const target = new VisibilityDocumentDouble('visible')
  const values: boolean[] = []
  mount(target, values)

  act(() => target.changeVisibility('hidden'))
  act(() => target.changeVisibility('visible'))

  expect(values).toEqual([true, false, true])
  expect(target.addedListeners).toHaveLength(1)
})

test('removes the exact visibility listener on unmount', () => {
  const target = new VisibilityDocumentDouble('visible')
  mount(target, [])
  const registeredListener = target.addedListeners[0]

  act(() => root?.unmount())
  root = null

  expect(target.removedListeners).toEqual([registeredListener])
})
