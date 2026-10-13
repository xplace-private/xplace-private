import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

import type { AuthGateway, AuthSession } from '../features/auth/api/auth-gateway'
import { createMockAuthGateway } from '../features/auth/api/mock-auth-gateway'
import { totpCode } from '../features/auth/totp'
import { mockHomeGateway } from '../features/home/api/mock-home-gateway'
import { mockProfileGateway } from '../features/profile/api/mock-profile-gateway'
import { queryClient } from './query-client'
import { routeTree } from './routeTree.gen'

function createTestRouter(authGateway: AuthGateway, initialEntries = ['/']) {
  return createRouter({
    routeTree,
    context: { authGateway, homeGateway: mockHomeGateway, profileGateway: mockProfileGateway },
    history: createMemoryHistory({ initialEntries }),
    isServer: false,
    origin: 'http://localhost',
  })
}

function restoredGateway(getSession: AuthGateway['getSession']): AuthGateway {
  const unexpectedAction = () => Promise.reject(new Error('Unexpected auth action during restoration'))
  return {
    getSession,
    signIn: unexpectedAction,
    getAuthenticatorSetup: unexpectedAction,
    verifyAuthenticatorCode: unexpectedAction,
    setPassword: unexpectedAction,
    requestPasswordReset: unexpectedAction,
    resetPassword: unexpectedAction,
    signOut: unexpectedAction,
  }
}

test('renders sign-in without a backend or authentication', async () => {
  const router = createTestRouter(createMockAuthGateway())

  await router.load()
  expect(router.state.location.pathname).toBe('/auth/sign-in')

  const html = renderToString(<RouterProvider router={router} />)
  expect(html).toContain('Sign In')
  expect(html).toContain('Forgot your password?')
  expect(html).toContain('type="email"')
  expect(html).toContain('type="password"')
})

test.each([
  ['/auth/forgot-password', 'Forgot your password?'],
  ['/auth/reset-password?token=one-use-token', 'Reset Password'],
  ['/auth/reset-password', 'This reset link is invalid or has expired.'],
])('opens public recovery link %s without requiring session restoration', async (path, text) => {
  const getSession = vi.fn<AuthGateway['getSession']>(() => Promise.reject(new Error('Session is unavailable')))
  const router = createTestRouter(restoredGateway(getSession), [path])
  await router.load()
  expect(router.state.location.href).toBe(path)
  expect(renderToString(<RouterProvider router={router} />)).toContain(text)
  expect(getSession).not.toHaveBeenCalled()
})

test('replaces the current page throughout one auth session without adding history entries', async () => {
  const authGateway = createMockAuthGateway()
  const router = createTestRouter(authGateway, ['/home'])
  function expectPage(path: string, session: AuthSession) {
    expect(router.state.location.pathname).toBe(path)
    expect(router.state.matches.at(-1)?.context.authSession).toBe(session)
    expect(router.history.length).toBe(1)
  }

  await router.load()
  expectPage('/auth/sign-in', 'anonymous')

  await authGateway.signIn({ email: 'partner@example.test', password: 'temporary' })
  await router.invalidate()
  expectPage('/auth/authenticator', 'authenticator-required')

  const setup = await authGateway.getAuthenticatorSetup()
  if (!setup.ok) throw new Error('Expected authenticator setup')
  await authGateway.verifyAuthenticatorCode({ code: await totpCode(setup.data.secret) })
  await router.invalidate()
  expectPage('/auth/set-password', 'password-required')
  router.history.back()
  await router.load()
  expectPage('/auth/set-password', 'password-required')

  await authGateway.setPassword({ password: 'a long passphrase' })
  await router.invalidate()
  expectPage('/home', 'authenticated')
  router.history.back()
  await router.load()
  expectPage('/home', 'authenticated')

  queryClient.setQueryData(['home', 'clients'], { private: 'previous session' })
  queryClient.setQueryData(['profile', 'account'], { private: 'previous session' })
  queryClient.setQueryData(['auth', 'authenticator-status'], { ok: true, data: { configured: true, enabled: true } })
  await authGateway.signOut()
  await router.invalidate()
  expectPage('/auth/sign-in', 'anonymous')
  expect(queryClient.getQueriesData({ queryKey: ['home'] })).toEqual([])
  expect(queryClient.getQueriesData({ queryKey: ['profile'] })).toEqual([])
  expect(queryClient.getQueriesData({ queryKey: ['auth'] })).toEqual([])
  router.history.forward()
  await router.load()
  expectPage('/auth/sign-in', 'anonymous')
})

test.each([
  ['anonymous', '/auth/sign-in', 'Sign In'],
  ['authenticator-required', '/auth/authenticator', 'Set Up Authenticator'],
  ['two-factor-required', '/auth/authenticator', '2FA authentication'],
  ['password-required', '/auth/set-password', 'Set Your Password'],
  ['authenticated', '/home', 'Home'],
] as const)('allows only the current route for %s, including direct links to past and future steps', async (session, destination, heading) => {
  for (const path of ['/', '/auth/sign-in', '/auth/authenticator', '/auth/set-password', '/home', '/profile', '/auth', '/auth/unknown', '/unknown']) {
    if (session === 'authenticated' && path === '/profile') continue
    const router = createTestRouter(restoredGateway(() => Promise.resolve(session)), [path])
    await router.load()

    expect(router.state.location.pathname).toBe(destination)
    expect(router.state.matches.at(-1)?.context.authSession).toBe(session)
    expect(router.state.matches.at(-1)?.routeId).toBe(destination)
    expect(router.history.length).toBe(1)
    const html = renderToString(<RouterProvider router={router} />)
    expect(html).toContain(heading)
    if (session === 'authenticator-required') {
      expect(html).toContain('Log Out')
      expect(html).not.toContain('Setup Later')
      expect(html).toContain('Open in authenticator app')
      expect(html).not.toContain('Enter your email and password to log in')
    } else {
      expect(html).not.toContain('Setup Later')
    }
  }
})

test('allows authenticated direct links to the partner profile', async () => {
  const router = createTestRouter(restoredGateway(() => Promise.resolve('authenticated')), ['/profile'])
  await router.load()
  expect(router.state.location.pathname).toBe('/profile')
  expect(router.state.matches.at(-1)?.routeId).toBe('/profile')
  expect(renderToString(<RouterProvider router={router} />)).toContain('Account Information')
})

test('does not restore protected pages from Back or Forward after the session expires', async () => {
  let session: AuthSession = 'authenticated'
  const router = createTestRouter(restoredGateway(() => Promise.resolve(session)), ['/home?old=1', '/auth/set-password', '/home'])
  await router.load()
  expect(router.state.location.pathname).toBe('/home')

  session = 'anonymous'
  await router.invalidate()

  for (const move of [() => router.history.back(), () => router.history.back(), () => router.history.forward(), () => router.history.forward()]) {
    move()
    await router.load()
    expect(router.state.location.pathname).toBe('/auth/sign-in')
    expect(router.state.matches.at(-1)?.context.authSession).toBe('anonymous')
    expect(router.history.length).toBe(3)
    expect(router.state.matches.some((match) => match.routeId === '/home')).toBe(false)
  }
})

test('keeps Home unavailable while restoring a session, handles failure, then recovers', async () => {
  let rejectRestore!: (error: Error) => void
  const restore = new Promise<AuthSession>((_resolve, reject) => { rejectRestore = reject })
  const getSession = vi.fn<AuthGateway['getSession']>()
    .mockReturnValueOnce(restore)
    .mockResolvedValue('authenticated')
  const router = createTestRouter(restoredGateway(getSession), ['/home'])
  const loading = router.load()

  await vi.waitFor(() => expect(getSession).toHaveBeenCalledOnce())
  expect(router.state.matches.some((match) => match.routeId === '/home' && match.status === 'success')).toBe(false)
  rejectRestore(new Error('Private server diagnostic'))
  await loading

  expect(router.state.matches[0]?.status).toBe('error')
  expect(router.state.matches.some((match) => match.routeId === '/home' && match.status === 'success')).toBe(false)

  await router.invalidate()
  expect(router.state.location.pathname).toBe('/home')
  expect(router.state.matches.at(-1)?.context.authSession).toBe('authenticated')
})

test('ignores a stale authenticated restoration after a newer anonymous session', async () => {
  let resolveStale!: (session: AuthSession) => void
  const stale = new Promise<AuthSession>((resolve) => { resolveStale = resolve })
  const getSession = vi.fn<AuthGateway['getSession']>()
    .mockResolvedValueOnce('authenticated')
    .mockReturnValueOnce(stale)
    .mockResolvedValue('anonymous')
  const router = createTestRouter(restoredGateway(getSession), ['/home'])
  await router.load()

  const oldRefresh = router.invalidate()
  await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
  await router.invalidate()
  expect(router.state.location.pathname).toBe('/auth/sign-in')
  resolveStale('authenticated')
  await oldRefresh

  expect(router.state.location.pathname).toBe('/auth/sign-in')
  expect(router.state.matches.at(-1)?.context.authSession).toBe('anonymous')
  expect(router.history.length).toBe(1)
})

test('a stale anonymous restoration cannot clear the current authenticated cache', async () => {
  let resolveStale!: (session: AuthSession) => void
  const stale = new Promise<AuthSession>((resolve) => { resolveStale = resolve })
  const getSession = vi.fn<AuthGateway['getSession']>()
    .mockResolvedValueOnce('authenticated')
    .mockReturnValueOnce(stale)
    .mockResolvedValue('authenticated')
  const router = createTestRouter(restoredGateway(getSession), ['/home'])
  await router.load()

  const oldRefresh = router.invalidate()
  await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
  await router.invalidate()
  const key = ['home', 'overview']
  queryClient.setQueryData(key, { partnerName: 'Current partner' })
  resolveStale('anonymous')
  await oldRefresh

  expect(router.state.location.pathname).toBe('/home')
  expect(queryClient.getQueryData(key)).toEqual({ partnerName: 'Current partner' })
  queryClient.clear()
})
