import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

import type { TwoFactorRequirement } from '../../features/auth/api/authenticator-gateway'

const routeTestState = vi.hoisted(() => {
  const state: {
    sessionStatus: 'checking' | 'authenticated'
    requirement: TwoFactorRequirement
  } = { sessionStatus: 'checking', requirement: 'totp_required' }
  return state
})

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: object) => ({
    options,
    useRouteContext: () => ({
      authenticatorGateway: {},
      routeAccess: {
        status: 'two-factor-required',
        requirement: routeTestState.requirement,
      },
    }),
  }),
}))

vi.mock('../../features/auth/auth-flow-provider', () => ({
  useAuthFlow: () => ({
    session: { status: routeTestState.sessionStatus, user: null, error: null },
    completeTwoFactor: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('../../features/auth/authenticator-screen', async () => {
  const { createElement } = await import('react')
  return {
    AuthenticatorScreen: ({ requirement }: { requirement: TwoFactorRequirement }) =>
      createElement('p', null, `Authenticator screen: ${requirement}`),
  }
})

import { Route } from './authenticator'

test.each([
  { sessionStatus: 'checking', requirement: 'totp_setup_required' },
  { sessionStatus: 'authenticated', requirement: 'totp_setup_required' },
  { sessionStatus: 'checking', requirement: 'totp_required' },
  { sessionStatus: 'authenticated', requirement: 'totp_required' },
] as const)(
  'keeps $requirement visible while the session is $sessionStatus during routing',
  async ({ sessionStatus, requirement }) => {
    routeTestState.sessionStatus = sessionStatus
    routeTestState.requirement = requirement
    const Component = Route.options.component
    if (Component === undefined) throw new Error('Expected an authenticator route component')

    await Component.preload?.()

    expect(renderToStaticMarkup(<Component />)).toContain(`Authenticator screen: ${requirement}`)
  },
)
