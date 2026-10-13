import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

const pendingTestState = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouterState<T>({
    select,
  }: {
    select(state: { location: { pathname: string } }): T
  }) {
    return select({ location: { pathname: pendingTestState.pathname } })
  },
}))

vi.mock('../features/home/home-session-skeleton', () => ({
  HomeSessionSkeleton: () => <div>home-session-skeleton</div>,
}))

vi.mock('../features/home/transactions-session-skeleton', () => ({
  TransactionsSessionSkeleton: () => (
    <div>transactions-session-skeleton</div>
  ),
}))

import { SessionRoutePending } from './session-route-pending'

test.each([
  ['/home', 'home-session-skeleton'],
  ['/transactions', 'transactions-session-skeleton'],
  ['/', 'Loading account'],
  ['/verification', 'Loading account'],
] as const)('selects one pending surface for %s', (pathname, marker) => {
  pendingTestState.pathname = pathname
  const html = renderToStaticMarkup(<SessionRoutePending />)
  const pendingSurfaceIndex = html.indexOf(marker)

  expect(pendingSurfaceIndex).toBeGreaterThan(-1)
  expect(html).toContain('min-h-dvh')
  expect(
    html.match(
      /h-\[calc\(65px\+env\(safe-area-inset-top,0px\)\)\]/g,
    ),
  ).toHaveLength(2)
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain('min-[480px]:max-w-[460px]')
  expect(html.indexOf('min-h-dvh')).toBeLessThan(pendingSurfaceIndex)
  expect(html.indexOf('<footer')).toBeGreaterThan(pendingSurfaceIndex)
})

test('keeps the existing account-loader geometry', () => {
  pendingTestState.pathname = '/verification'

  expect(renderToStaticMarkup(<SessionRoutePending />)).toContain(
    'min-h-[441px]',
  )
})
