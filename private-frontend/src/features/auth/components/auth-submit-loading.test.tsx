import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createAppI18n } from '../../../shared/i18n/app-i18n'

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: () => undefined,
}))

const authState = vi.hoisted(() => ({
  state: {
    step: 'phone' as 'phone' | 'code',
    country: {
      code: 'AE',
      flag: '🇦🇪',
      name: 'United Arab Emirates',
      phoneCode: '+971',
    },
    phone: '554570290',
    code: '123456',
    challengeId: 'challenge-1' as string | null,
    errors: {},
    gatewayError: null as {
      message: string
      retryAfterSeconds?: number
    } | null,
    submission: 'pending' as 'idle' | 'pending',
    submissionKind: 'verify-code' as
      | 'request-code'
      | 'verify-code'
      | 'resend-code'
      | null,
    resendSeconds: 60,
    authenticated: false,
  },
}))

const authActions = vi.hoisted(() => ({
  verifyCode: vi.fn<() => Promise<boolean>>(),
}))

vi.mock('../auth-flow-provider', () => ({
  useAuthFlow: () => ({
    state: authState.state,
    setPhone: () => undefined,
    setCode: () => undefined,
    requestCode: () => Promise.resolve(false),
    resendCode: () => Promise.resolve(false),
    verifyCode: authActions.verifyCode,
    tickResendCountdown: () => undefined,
    backToContact: () => undefined,
    signOut: () => undefined,
  }),
}))

import { CodeStep } from './code-step'
import { PhoneStep } from './phone-step'

beforeEach(() => {
  authActions.verifyCode.mockReset()
  authActions.verifyCode.mockResolvedValue(false)
})

afterEach(() => {
  authState.state.country = {
    code: 'AE',
    flag: '🇦🇪',
    name: 'United Arab Emirates',
    phoneCode: '+971',
  }
  authState.state.phone = '554570290'
  authState.state.submission = 'pending'
  authState.state.submissionKind = 'verify-code'
  authState.state.resendSeconds = 60
  authState.state.gatewayError = null
})

test('shows a busy request-code loader on the phone submit button', () => {
  const html = renderToStaticMarkup(<PhoneStep />)

  expect(html).toContain('aria-busy="true"')
  expect(html).toContain('aria-label="Requesting code"')
  expect(html).toContain('disabled=""')
  expect(html).toContain('aria-hidden="true"')
  expect(html).not.toContain('role="status"')
})

test('shows a busy verification loader on the OTP submit button', () => {
  const html = renderToStaticMarkup(
    <CodeStep />,
  )

  expect(html).toContain('aria-busy="true"')
  expect(html).toContain('aria-label="Verifying code"')
  expect(html).toContain('disabled=""')
  expect(html).toContain('aria-hidden="true"')
  expect(html).not.toContain('role="status"')
  expect(html).toContain('font-sans')
  expect(html).toContain('text-2xl leading-9')
  expect(html).toContain('px-4 py-8')
})

test('shows the same international phone number that received the code', () => {
  authState.state.country = {
    code: 'GB',
    flag: '🇬🇧',
    name: 'United Kingdom',
    phoneCode: '+44',
  }
  authState.state.phone = '+44 20 7183 8750'

  const html = renderToStaticMarkup(<CodeStep />)

  expect(html).toContain('Sent on WhatsApp to +442071838750.')
})

test('keeps the OTP loader visible while authenticated routing is pending', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null

  const html = renderToStaticMarkup(<CodeStep postAuthenticationPending />)

  expect(html).toContain('aria-busy="true"')
  expect(html).toContain('aria-label="Verifying code"')
  expect(html).toContain('disabled=""')
  expect(html).toContain('aria-hidden="true"')
})

test('counts down before enabling resend code', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.resendSeconds = 60

  const countingDown = renderToStaticMarkup(
    <CodeStep />,
  )
  expect(countingDown).toContain('aria-label="Resend code available in 60s"')
  expect(countingDown).toContain('Resend in 60s')

  authState.state.resendSeconds = 0
  const available = renderToStaticMarkup(
    <CodeStep />,
  )
  expect(available).toMatch(/<button[^>]*type="button"[^>]*>Resend code<\/button>/)
})

test('keeps the resend countdown at full opacity', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.resendSeconds = 52

  const html = renderToStaticMarkup(<CodeStep />)
  const countdownButton = html.match(
    /<button[^>]*aria-label="Resend code available in 52s"[^>]*>.*?<\/button>/,
  )?.[0]

  expect(countdownButton).toContain('disabled:opacity-100')
})

test('shows a long server resend cooldown using compact time units', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.resendSeconds = 85773

  const html = renderToStaticMarkup(
    <CodeStep />,
  )

  expect(html).toContain('Resend in 23h 49m 33s')
  expect(html).toContain(
    'aria-label="Resend code available in 23h 49m 33s"',
  )
  expect(html).not.toContain('id="verification-code-error"')
})

test.each([
  ['ru', 'Повторно через 23\u00a0ч 49\u00a0мин 33\u00a0с'],
  ['fr', 'Renvoyer dans 23\u00a0h 49\u00a0min 33\u00a0s'],
  ['es', 'Reenviar en 23\u00a0h 49\u00a0min 33\u00a0s'],
] as const)('formats resend duration naturally in %s', (language, expected) => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.resendSeconds = 85773

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createAppI18n(language)}>
      <CodeStep />
    </I18nextProvider>,
  )

  expect(html).toContain(expected)
})

test('localizes the initial OTP request cooldown', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.gatewayError = {
    message: 'Please try again in 1h 53m 5s.',
    retryAfterSeconds: 6785,
  }

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createAppI18n('ru')}>
      <PhoneStep />
    </I18nextProvider>,
  )

  expect(html).toContain(
    'Повторите попытку через 1\u00a0ч 53\u00a0мин 5\u00a0с.',
  )
})

test('localizes a known phone validation error', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.gatewayError = { message: 'Invalid phone number' }

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createAppI18n('ru')}>
      <PhoneStep />
    </I18nextProvider>,
  )

  expect(html).toContain('Некорректный номер телефона.')
})

test('localizes the backend invalid phone format error', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.gatewayError = { message: 'Invalid phone number format' }

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createAppI18n('ru')}>
      <PhoneStep />
    </I18nextProvider>,
  )

  expect(html).toContain(
    'Введите корректный номер в международном формате.',
  )
})

test('localizes a known invalid or expired OTP error', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.gatewayError = {
    message: 'Invalid or expired verification',
  }

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createAppI18n('ru')}>
      <CodeStep />
    </I18nextProvider>,
  )

  expect(html).toContain('Неверный или просроченный код.')
})

test('keeps an unknown useful auth error unchanged', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.gatewayError = {
    message: 'This account cannot receive WhatsApp codes.',
  }

  const html = renderToStaticMarkup(<PhoneStep />)

  expect(html).toContain('This account cannot receive WhatsApp codes.')
})

test('localizes a known generic auth failure', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.gatewayError = {
    message: 'Something went wrong. Please try again.',
  }

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createAppI18n('ru')}>
      <PhoneStep />
    </I18nextProvider>,
  )

  expect(html).toContain('Не удалось продолжить. Попробуйте ещё раз.')
})

test('localizes the backend send failure as a generic error', () => {
  authState.state.submission = 'idle'
  authState.state.submissionKind = null
  authState.state.gatewayError = {
    message: 'Failed to send verification code',
  }

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={createAppI18n('ru')}>
      <PhoneStep />
    </I18nextProvider>,
  )

  expect(html).toContain('Не удалось продолжить. Попробуйте ещё раз.')
})

test('keeps the resend label visible while the request is pending', () => {
  authState.state.submissionKind = 'resend-code'
  authState.state.resendSeconds = 0

  const html = renderToStaticMarkup(<CodeStep />)

  expect(html).toContain('aria-label="Requesting code"')
  expect(html).not.toContain('aria-label="Verifying code"')
  expect(html).toContain('disabled="">Resend code</button>')
  expect(html).not.toContain('invisible">Resend code</span>')
  expect(html).not.toContain('<svg')
})

test('dims the outline actions while the resend request is pending', () => {
  authState.state.submissionKind = 'resend-code'
  authState.state.resendSeconds = 0

  const html = renderToStaticMarkup(<CodeStep />)
  const resendButton = html.match(
    /<button[^>]*aria-label="Requesting code"[^>]*>.*?<\/button>/,
  )?.[0]
  const changeContactButton = html.match(
    /<button[^>]*>Use a different number<\/button>/,
  )?.[0]

  expect(resendButton).toContain('disabled:opacity-50')
  expect(resendButton).not.toContain('disabled:opacity-100')
  expect(changeContactButton).toContain('disabled:opacity-50')
  expect(changeContactButton).not.toContain('disabled:opacity-100')
})
