import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'

const routeTestState = vi.hoisted(() => ({
  pathname: '/verification',
  pushes: [] as string[],
  replacements: [] as string[],
  signOutCalls: 0,
  screenProps: null as {
    onStartSdk(): void
    onCompleted(): void
    onSignOut(): void
  } | null,
}))

vi.mock('../../features/auth/auth-flow-provider', () => ({
  useAuthFlow: () => ({
    signOut: () => {
      routeTestState.signOutCalls += 1
    },
  }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const { createElement } = await import('react')
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    createFileRoute: () =>
      (options: object) => ({
        options,
      }),
    Outlet: () => createElement('p', null, 'Sumsub child route'),
    useRouter: () => ({
      history: {
        push: (path: string) => routeTestState.pushes.push(path),
        replace: (path: string) => routeTestState.replacements.push(path),
      },
    }),
    useRouterState<T>({
      select,
    }: {
      select(state: { location: { pathname: string } }): T
    }) {
      return select({ location: { pathname: routeTestState.pathname } })
    },
  }
})

vi.mock('../../features/verification/verification-screen', async () => {
  const { createElement } = await import('react')
  return {
    VerificationScreen: (props: {
      onStartSdk(): void
      onCompleted(): void
      onSignOut(): void
    }) => {
      routeTestState.screenProps = props
      return createElement('p', null, 'Verification screen')
    },
  }
})

import { Route } from './verification'

async function renderRoute() {
  const Component = Route.options.component
  if (Component === undefined) throw new Error('Expected a route component')
  await Component.preload?.()
  return renderToStaticMarkup(<Component />)
}

beforeEach(() => {
  routeTestState.pathname = '/verification'
  routeTestState.pushes = []
  routeTestState.replacements = []
  routeTestState.signOutCalls = 0
  routeTestState.screenProps = null
})

test('renders the verification screen at the parent route', async () => {
  await expect(renderRoute()).resolves.toContain('Verification screen')
})

test('pushes the Sumsub child route when verification starts', async () => {
  await renderRoute()
  if (routeTestState.screenProps === null) {
    throw new Error('Expected verification screen props')
  }

  routeTestState.screenProps.onStartSdk()

  expect(routeTestState.pushes).toEqual(['/verification/sumsub'])
})

test('replaces the verification route with Home when completed', async () => {
  await renderRoute()
  if (routeTestState.screenProps === null) {
    throw new Error('Expected verification screen props')
  }

  routeTestState.screenProps.onCompleted()

  expect(routeTestState.replacements).toEqual(['/home'])
})

test('signs out from the verification introduction', async () => {
  await renderRoute()
  if (routeTestState.screenProps === null) {
    throw new Error('Expected verification screen props')
  }

  routeTestState.screenProps.onSignOut()

  expect(routeTestState.signOutCalls).toBe(1)
})

test('renders the nested route outlet at the Sumsub route', async () => {
  routeTestState.pathname = '/verification/sumsub'

  const html = await renderRoute()

  expect(html).toContain('Sumsub child route')
  expect(html).not.toContain('Verification screen')
})
