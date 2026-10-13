import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

import { mockProfileGateway } from './api/mock-profile-gateway'
import { ChangePasswordModal } from './change-password-modal'
import { profileQuery } from './profile-queries'
import { ProfileScreen } from './profile-screen'

test('mock profile read is cancellable and returns the displayed account values', async () => {
  vi.useFakeTimers()
  try {
    const controller = new AbortController()
    const cancelled = mockProfileGateway.getProfile(controller.signal)
    const rejected = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort(new DOMException('Aborted', 'AbortError'))
    await rejected
    expect(vi.getTimerCount()).toBe(0)

    const loaded = mockProfileGateway.getProfile(new AbortController().signal)
    await vi.advanceTimersByTimeAsync(450)
    expect(await loaded).toEqual({ fullName: 'David Mitchell', email: 'vanguard@tech.co', phone: '+1 (555) 666-7777', company: 'Valkyrie Global Ltd', partnerSlug: 'valkyrie', mustChangePassword: false, totpConfigured: true })
  } finally {
    vi.useRealTimers()
  }
})

test('profile keeps the approved account, security and support content without extra metadata', () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(profileQuery(mockProfileGateway).queryKey, { fullName: 'David Mitchell', email: 'vanguard@tech.co', phone: '+1 (555) 666-7777', company: 'Valkyrie Global Ltd', partnerSlug: 'valkyrie', mustChangePassword: false, totpConfigured: true })
  const html = renderToStaticMarkup(<QueryClientProvider client={queryClient}><ProfileScreen gateway={mockProfileGateway} onSessionChanged={() => Promise.resolve()} signOut={<button>Log Out</button>} onHome={() => undefined} onProfile={() => undefined} /></QueryClientProvider>)
  expect(html).toContain('Account Information')
  expect(html).toContain('vanguard@tech.co')
  expect(html.match(/Valkyrie Global Ltd/g)?.length).toBe(2)
  expect(html).not.toContain('role="switch"')
  expect(html).toContain('David Mitchell')
  expect(html).toContain('+1 (555) 666-7777')
  expect(html).not.toContain('valkyrie')
  expect(html).not.toContain('Partner code')
  expect(html).not.toContain('Signing keys')
  expect(html).not.toContain('Two-factor authentication')
  expect(html).not.toContain('Configured')
  expect(html).not.toContain('Your current session stays active.')
  expect(html).toContain('Sign out all sessions')
  expect(html).toContain('Need to change account details?')
  expect(html).toContain('href="https://wa.me/971554570290" target="_blank" rel="noopener noreferrer"')
})

test('header uses a known company during loading but respects an explicit null profile company', () => {
  const queryClient = new QueryClient()
  const render = (knownCompanyName?: string) => renderToStaticMarkup(<QueryClientProvider client={queryClient}><ProfileScreen gateway={mockProfileGateway} onSessionChanged={() => Promise.resolve()} knownCompanyName={knownCompanyName} signOut={<button>Log Out</button>} onHome={() => undefined} onProfile={() => undefined} /></QueryClientProvider>)
  expect(render().match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0]).toContain('animate-pulse')
  const pendingHeader = render('Valkyrie Global Ltd').match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0]
  expect(pendingHeader).toContain('Valkyrie Global Ltd')
  expect(pendingHeader).not.toContain('animate-pulse')
  queryClient.setQueryData(profileQuery(mockProfileGateway).queryKey, { fullName: 'David Mitchell', email: null, phone: null, company: null, partnerSlug: null, mustChangePassword: false, totpConfigured: true })
  const loadedHeader = render('Valkyrie Global Ltd').match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0]
  expect(loadedHeader).toContain('Not available')
  expect(loadedHeader).not.toContain('Valkyrie Global Ltd')
  queryClient.clear()
})

test('password modal requires the current password, confirmation and TOTP while keeping its notice', () => {
  const html = renderToStaticMarkup(<ChangePasswordModal gateway={mockProfileGateway} onSessionChanged={() => Promise.resolve()} onChanged={() => undefined} onClose={() => undefined} returnFocusElement={null} />)
  expect(html.match(/type="password"/g)?.length).toBe(3)
  expect(html).toContain('Current password')
  expect(html).toContain('Code from authenticator app')
  expect(html).toContain('Enter new password')
  expect(html).toContain('Confirm new password')
  expect(html).toContain('Password Requirements')
  expect(html).toContain('Change Password &amp; Continue')
})
