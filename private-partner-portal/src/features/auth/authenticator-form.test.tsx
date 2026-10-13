import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import { createMockAuthGateway } from './api/mock-auth-gateway'
import { AuthenticatorForm } from './authenticator-form'

test('keeps setup controls and offers Log Out instead of Setup Later', () => {
  const action = { pending: false, error: null, errorCode: null, run: () => Promise.resolve(), clearError: () => undefined }
  const html = renderToStaticMarkup(<AuthenticatorForm gateway={createMockAuthGateway()} action={action} setup={{ result: null, retry: () => undefined }} />)
  expect(html).toContain('Google Authenticator, Authy')
  expect(html).toContain('Open in Authenticator App')
  expect(html).toContain('Copy Authenticator Key')
  expect(html).toContain('Show QR code (for another device)')
  expect(html).toContain('Continue')
  expect(html).toContain('Log Out')
  expect(html).not.toContain('Setup Later')
  expect(html).not.toContain('Loading')
  expect(html).toContain('aria-busy="true"')
})

test('keeps setup instructions with recovery and Log Out when authenticator setup fails', () => {
  const action = { pending: false, error: null, errorCode: null, run: () => Promise.resolve(), clearError: () => undefined }
  const html = renderToStaticMarkup(<AuthenticatorForm gateway={createMockAuthGateway()} action={action} setup={{ result: { ok: false, code: 'unexpected', message: '' }, retry: () => undefined }} />)
  expect(html).toContain('Something went wrong. Please try again.')
  expect(html.indexOf('Something went wrong. Please try again.')).toBeGreaterThan(html.indexOf('Log Out'))
  expect(html).toContain('Try again')
  expect(html).toContain('Log Out')
  expect(html).toContain('Google Authenticator, Authy')
  expect(html.match(/<li /g)).toHaveLength(4)
  expect(html).not.toContain('Open in Authenticator App')
  expect(html).not.toContain('Copy Authenticator Key')
  expect(html).not.toContain('Show QR code (for another device)')
  expect(html).not.toContain('name="code"')
  expect(html).not.toContain('Continue')
})

test('shows a verification server failure below Log Out without marking the code invalid', () => {
  const action = { pending: false, error: 'Something went wrong. Please try again.', errorCode: 'unexpected', run: () => Promise.resolve(), clearError: () => undefined }
  const html = renderToStaticMarkup(<AuthenticatorForm gateway={createMockAuthGateway()} action={action} setup={null} />)
  expect(html).toContain('Something went wrong. Please try again.')
  expect(html).not.toContain('aria-invalid="true"')
  expect(html.indexOf('Something went wrong. Please try again.')).toBeGreaterThan(html.indexOf('Log Out'))
})

test.each(['incorrectCode', 'usedCode'])('keeps %s attached to the code field', (errorCode) => {
  const action = { pending: false, error: 'Check the code.', errorCode, run: () => Promise.resolve(), clearError: () => undefined }
  const html = renderToStaticMarkup(<AuthenticatorForm gateway={createMockAuthGateway()} action={action} setup={null} />)
  expect(html).toContain('aria-invalid="true"')
  expect(html.indexOf('Check the code.')).toBeLessThan(html.indexOf('Log Out'))
})
