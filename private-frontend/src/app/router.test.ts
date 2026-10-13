import { expect, test, vi } from 'vitest'

import type { AuthSessionStatus } from '../features/auth/api/browser-auth-session-store'

const routerTestState = vi.hoisted(() => ({
  status: 'anonymous' as AuthSessionStatus,
  listeners: new Set<() => void>(),
}))

vi.mock('../shared/api/app-env', () => ({
  appEnv: { mode: 'test', apiBaseUrl: 'https://back.example.test' },
}))

vi.mock('./app-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./app-runtime')>()
  const publish = (status: AuthSessionStatus) => {
    routerTestState.status = status
    routerTestState.listeners.forEach((listener) => listener())
  }

  return {
    ...actual,
    appRuntime: {
      authSessionStore: {
        readStatus: () => routerTestState.status,
        markAuthenticated: () => publish('authenticated'),
        requireTwoFactor: publish,
        clear: () => publish('anonymous'),
        subscribe(listener: () => void) {
          routerTestState.listeners.add(listener)
          return () => routerTestState.listeners.delete(listener)
        },
      },
    },
  }
})

import { appRuntime } from './app-runtime'
import { router } from './router'

test('restores scroll positions after history navigation', () => {
  expect(router.options.scrollRestoration).toBe(true)
})

test('uses the singleton application runtime as Router context', () => {
  expect(router.options.context).toBe(appRuntime)
})

test('invalidates route access on logout but not OTP session adoption', () => {
  const invalidate = vi.spyOn(router, 'invalidate').mockResolvedValue(undefined)

  appRuntime.authSessionStore.markAuthenticated()
  expect(invalidate).not.toHaveBeenCalled()

  appRuntime.authSessionStore.clear()
  expect(invalidate).toHaveBeenCalledOnce()
})
