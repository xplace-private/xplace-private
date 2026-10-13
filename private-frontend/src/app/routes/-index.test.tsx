import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

const routeTestState = vi.hoisted(() => ({
  postAuthenticationPending: null as boolean | null,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: object) => ({ options }),
}))

vi.mock('../../features/auth/auth-flow-provider', () => ({
  useAuthFlow: () => ({
    session: {
      status: 'authenticated',
      user: { id: 1, username: 'yury', email: 'yury@example.com', avatar: null },
      error: null,
    },
    state: { step: 'code' },
  }),
}))

vi.mock('../../features/verification/verification-flow-provider', () => ({
  useVerificationFlow: () => ({ applicantStatus: 'loading' }),
}))

vi.mock('../../features/auth/auth-screen', async () => {
  const { createElement } = await import('react')
  return {
    AuthScreen: ({
      postAuthenticationPending = false,
    }: {
      postAuthenticationPending?: boolean
    }) => {
      routeTestState.postAuthenticationPending = postAuthenticationPending
      return createElement('p', null, 'Auth screen')
    },
  }
})

import { Route } from './index'

test('keeps the OTP screen pending while applicant routing is loading', async () => {
  const Component = Route.options.component
  if (Component === undefined) throw new Error('Expected an index route component')

  await Component.preload?.()
  renderToStaticMarkup(<Component />)

  expect(routeTestState.postAuthenticationPending).toBe(true)
})
