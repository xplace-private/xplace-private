import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { MouseEventHandler, ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

interface CapturedButton {
  children?: ReactNode
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
}

const ui = vi.hoisted(() => ({
  buttons: [] as CapturedButton[],
  heading: null as { description?: ReactNode } | null,
}))

vi.mock('../../../shared/ui/button', () => ({
  Button: (props: CapturedButton) => {
    ui.buttons.push(props)
    return null
  },
}))

vi.mock('../../../shared/ui/flow-heading', () => ({
  FlowHeading: (props: { description?: ReactNode }) => {
    ui.heading = props
    return null
  },
}))

vi.mock('../../../shared/ui/loader', () => ({
  Loader: () => null,
}))

import { SessionRecovery } from './session-recovery'

let root: Root | null = null

function createElement(ownerDocument: object, nodeName: string): Element {
  const children: Element[] = []
  return {
    nodeType: 1,
    nodeName: nodeName.toUpperCase(),
    tagName: nodeName.toUpperCase(),
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument,
    style: {},
    addEventListener() {},
    removeEventListener() {},
    appendChild(child: Element) {
      children.push(child)
      return child
    },
    insertBefore(child: Element) {
      children.push(child)
      return child
    },
    removeChild(child: Element) {
      children.splice(children.indexOf(child), 1)
      return child
    },
    setAttribute() {},
    removeAttribute() {},
  } as unknown as Element
}

function createContainer(): Element {
  const ownerDocument = {
    nodeType: 9,
    documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
    addEventListener() {},
    removeEventListener() {},
    createElement(nodeName: string) {
      return createElement(ownerDocument, nodeName)
    },
    createElementNS(_namespace: string, nodeName: string) {
      return createElement(ownerDocument, nodeName)
    },
  }

  return createElement(ownerDocument, 'div')
}

function button(label: string): CapturedButton {
  const captured = [...ui.buttons].reverse().find(({ children }) => children === label)
  if (captured === undefined) throw new Error(`${label} button was not captured`)
  return captured
}

function latestRecoveryButtons(): [CapturedButton, CapturedButton] {
  const retry = ui.buttons.at(-2)
  const signOut = ui.buttons.at(-1)
  if (retry === undefined || signOut === undefined) {
    throw new Error('Recovery buttons were not captured')
  }
  return [retry, signOut]
}

function mount(props: Parameters<typeof SessionRecovery>[0]) {
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as {
    window?: { event?: Event; HTMLIFrameElement: new () => object }
  }
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
  browserGlobal.window = { HTMLIFrameElement: class {} }
  root = createRoot(createContainer())
  act(() => {
    root?.render(<SessionRecovery {...props} />)
  })
}

afterEach(() => {
  if (root !== null) act(() => root?.unmount())
  root = null
  ui.buttons = []
  ui.heading = null

  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean
  }
  const browserGlobal = globalThis as unknown as { window?: unknown }
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
  delete browserGlobal.window
})

test('renders recovery controls and retries once while pending', async () => {
  let resolveRetry: ((value: boolean) => void) | null = null
  const onRetry = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        resolveRetry = resolve
      }),
  )
  const onSignOut = vi.fn()
  mount({
    message: 'Unable to restore session. Try again.',
    onRetry,
    onSignOut,
  })

  expect(ui.heading?.description).toBe('Unable to restore session. Try again.')
  expect(button('Try again').disabled).toBe(false)
  expect(button('Sign out').disabled).toBe(false)

  await act(async () => {
    button('Try again').onClick?.({} as never)
    await Promise.resolve()
  })

  expect(onRetry).toHaveBeenCalledTimes(1)
  expect(onSignOut).not.toHaveBeenCalled()
  const [retryButton, signOutButton] = latestRecoveryButtons()
  expect(retryButton.disabled).toBe(true)
  expect(signOutButton.disabled).toBe(true)

  act(() => {
    retryButton.onClick?.({} as never)
  })
  expect(onRetry).toHaveBeenCalledTimes(1)

  if (resolveRetry === null) throw new Error('Retry resolver was not captured')
  await act(async () => {
    resolveRetry!(true)
  })
})

test('calls sign out without retrying the session', () => {
  const onRetry = vi.fn(() => Promise.resolve(true))
  const onSignOut = vi.fn()
  mount({
    message: 'Unable to restore session. Try again.',
    onRetry,
    onSignOut,
  })

  act(() => {
    button('Sign out').onClick?.({} as never)
  })

  expect(onSignOut).toHaveBeenCalledTimes(1)
  expect(onRetry).not.toHaveBeenCalled()
})
