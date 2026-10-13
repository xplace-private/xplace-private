import { act, StrictMode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

import type { GatewayResult } from '../../shared/api/gateway-result'
import type { AuthSession } from './api/auth-gateway'
import { useAuthAction } from './use-auth-action'

let root: Root | undefined

// The probe renders no DOM; this is the same empty React host used in the main project.
function mountAction(onSessionChanged = () => Promise.resolve()) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('window', { HTMLIFrameElement: class {} })
  const ownerDocument = {
    nodeType: 9,
    documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
    addEventListener() {},
    removeEventListener() {},
  }
  const container = {
    nodeType: 1,
    nodeName: 'DIV',
    tagName: 'DIV',
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Element
  let current: ReturnType<typeof useAuthAction> | undefined
  function Probe() {
    const action = useAuthAction(onSessionChanged)
    useEffect(() => { current = action }, [action])
    return null
  }
  root = createRoot(container)
  act(() => root?.render(<StrictMode><Probe /></StrictMode>))
  return () => {
    if (!current) throw new Error('Auth action did not mount')
    return current
  }
}

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.unstubAllGlobals()
})

test('blocks duplicate submissions until both the gateway and session refresh finish', async () => {
  let completeAction!: (result: GatewayResult) => void
  const response = new Promise<GatewayResult>((resolve) => { completeAction = resolve })
  let completeRefresh!: () => void
  const refreshing = new Promise<void>((resolve) => { completeRefresh = resolve })
  const refresh = vi.fn(() => refreshing)
  const request = vi.fn(() => response)
  const auth = mountAction(refresh)
  let submission!: Promise<void>

  act(() => {
    submission = auth().run(request)
    void auth().run(request)
  })
  expect(auth().pending).toBe(true)
  expect(request).toHaveBeenCalledOnce()
  expect(refresh).not.toHaveBeenCalled()

  await act(async () => { completeAction({ ok: true }) })
  expect(auth().pending).toBe(true)
  expect(refresh).toHaveBeenCalledOnce()
  act(() => { void auth().run(request) })
  expect(request).toHaveBeenCalledOnce()

  await act(async () => { completeRefresh(); await submission })
  expect(auth().pending).toBe(false)
  expect(auth().error).toBeNull()
})

test('keeps a rejected action on the same step and clears its error when retried', async () => {
  const refresh = vi.fn(() => Promise.resolve())
  const auth = mountAction(refresh)
  await act(async () => {
    await auth().run(() => Promise.resolve({ ok: false, code: 'credentials', message: 'Gateway detail' }))
  })
  expect(auth().error).toBe('Enter your email and password.')
  expect(auth().errorCode).toBe('credentials')
  expect(auth().pending).toBe(false)
  expect(refresh).not.toHaveBeenCalled()

  let complete!: (result: GatewayResult) => void
  const response = new Promise<GatewayResult>((resolve) => { complete = resolve })
  let submission!: Promise<void>
  act(() => { submission = auth().run(() => response) })
  expect(auth().error).toBeNull()
  expect(auth().errorCode).toBeNull()
  expect(auth().pending).toBe(true)
  await act(async () => { complete({ ok: true }); await submission })
  expect(auth().pending).toBe(false)
  expect(auth().error).toBeNull()
  expect(refresh).toHaveBeenCalledOnce()
})

test.each(['request', 'refresh'])('handles an unexpected %s failure without exposing raw errors or leaving the form locked', async (stage) => {
  const failure = new Error('Private server diagnostic')
  const refresh = vi.fn(() => stage === 'refresh' ? Promise.reject(failure) : Promise.resolve())
  const auth = mountAction(refresh)

  await act(async () => {
    await auth().run(() => stage === 'request' ? Promise.reject(failure) : Promise.resolve({ ok: true }))
  })
  expect(auth().pending).toBe(false)
  expect(auth().error).toBe('Something went wrong. Please try again.')
  if (stage === 'request') expect(refresh).not.toHaveBeenCalled()
})

test('shows a safe gateway message for a new error code without advancing the session', async () => {
  const refresh = vi.fn(() => Promise.resolve())
  const auth = mountAction(refresh)
  await act(async () => {
    await auth().run(() => Promise.resolve({ ok: false, code: 'rate-limited', message: 'Please try again later.' }))
  })
  expect(auth().error).toBe('Please try again later.')
  expect(auth().pending).toBe(false)
  expect(refresh).not.toHaveBeenCalled()
})

test('rechecks the authoritative session when an action reports that it expired', async () => {
  let session: AuthSession = 'password-required'
  const getSession = () => Promise.resolve<AuthSession>('anonymous')
  const auth = mountAction(async () => { session = await getSession() })
  await act(async () => {
    await auth().run(() => Promise.resolve({ ok: false, code: 'session', message: 'Please sign in again.' }))
  })
  expect(session).toBe('anonymous')
  expect(auth().pending).toBe(false)
})
