import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { expect, test } from 'vitest'

import type { AuthGateway } from './api/auth-gateway'
import type { CurrentUserGateway } from './api/current-user-gateway'
import { AuthFlowProvider } from './auth-flow-provider'
import { AuthScreen } from './auth-screen'
import { createAppI18n } from '../../shared/i18n/app-i18n'

const authGateway: AuthGateway = {
  requestCode: async () => ({
    ok: true,
    data: {
      challengeId: 'challenge-1',
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    },
  }),
  verifyOtp: async () => ({
    ok: true,
    data: { isNew: true, isPrivate: true, twoFactorRequirement: null },
  }),
  signOut: async () => undefined,
}

const currentUserGateway: CurrentUserGateway = {
  get: async () => ({
    ok: true,
    data: {
      id: 1,
      username: 'yury',
      email: 'yury@example.com',
      avatar: null,
    },
  }),
}

test('shows phone entry with a native country picker while keeping email entry hidden', () => {
  const html = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <AuthFlowProvider
        gateway={authGateway}
        currentUserGateway={currentUserGateway}
        onSessionReady={() => Promise.resolve()}
        sessionStore={{
          readStatus: () => 'anonymous',
          markAuthenticated: () => undefined,
          requireTwoFactor: () => undefined,
          clear: () => undefined,
          subscribe: () => () => undefined,
        }}
      >
        <AuthScreen />
      </AuthFlowProvider>
    </QueryClientProvider>,
  )

  expect(html).toContain('id="phone-number"')
  expect(html).toContain('autoComplete="tel-national"')
  expect(html).toContain('<select')
  expect(html).toContain('name="country"')
  expect(html).toContain(
    '<option class="[direction:rtl] text-left" value="US" selected="">United States +1 \u2066🇺🇸\u2069</option>',
  )
  expect(html).not.toContain('aria-haspopup="menu"')
  expect(html).not.toContain('id="email-address"')
})

test('describes WhatsApp delivery on the phone step', () => {
  const html = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <AuthFlowProvider
        gateway={authGateway}
        currentUserGateway={currentUserGateway}
        onSessionReady={() => Promise.resolve()}
        sessionStore={{
          readStatus: () => 'anonymous',
          markAuthenticated: () => undefined,
          requireTwoFactor: () => undefined,
          clear: () => undefined,
          subscribe: () => () => undefined,
        }}
      >
        <AuthScreen />
      </AuthFlowProvider>
    </QueryClientProvider>,
  )

  expect(html).toContain('Apply or sign in')
  expect(html).toContain('six-digit code on WhatsApp')
})

test('localizes the selected country name in Russian', () => {
  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createAppI18n('ru')}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthFlowProvider
          gateway={authGateway}
          currentUserGateway={currentUserGateway}
          onSessionReady={() => Promise.resolve()}
          sessionStore={{
            readStatus: () => 'anonymous',
            markAuthenticated: () => undefined,
            requireTwoFactor: () => undefined,
            clear: () => undefined,
            subscribe: () => () => undefined,
          }}
        >
          <AuthScreen />
        </AuthFlowProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  )

  expect(html).toContain('Выбрать код страны. Выбрано: Соединенные Штаты, +1')
  expect(html).not.toContain('United States')
})
