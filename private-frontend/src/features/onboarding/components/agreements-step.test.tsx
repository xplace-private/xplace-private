import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'

const onboardingState = vi.hoisted(() => ({
  state: {
    errors: {},
    gatewayError: null,
    agreementsAccepted: true,
    submission: 'idle' as 'idle' | 'pending',
    completed: true,
  },
  agreements: [
    {
      agreementType: 'e_sign_consent',
      agreementName: 'E-sign Consent',
      accepted: false,
      documentVersion: null,
      acceptedAt: null,
    },
  ],
  agreementLoadStatus: 'success' as 'loading' | 'success' | 'empty' | 'error',
}))

vi.mock('../onboarding-flow-provider', () => ({
  useOnboardingFlow: () => ({
    state: onboardingState.state,
    agreements: onboardingState.agreements,
    agreementLoadStatus: onboardingState.agreementLoadStatus,
    acceptAgreements() {},
    continueStep: () => Promise.resolve(false),
    back() {},
    retryAgreements() {},
  }),
}))

import { AgreementsStep } from './agreements-step'

beforeEach(() => {
  onboardingState.state.submission = 'idle'
  onboardingState.state.completed = true
  onboardingState.agreementLoadStatus = 'success'
  onboardingState.agreements = [
    {
      agreementType: 'e_sign_consent',
      agreementName: 'E-sign Consent',
      accepted: false,
      documentVersion: null,
      acceptedAt: null,
    },
  ]
})

test('renders three canonical skeleton rows while agreements load', () => {
  onboardingState.agreementLoadStatus = 'loading'
  onboardingState.agreements = []

  const html = renderToStaticMarkup(<AgreementsStep onCompleted={() => undefined} />)

  expect(html).toContain('Loading agreements')
  expect(html.match(/animate-pulse/g)).toHaveLength(3)
  expect(html).not.toContain('Cardholder Agreement')
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/)
})

test('renders every agreement name returned by the API', () => {
  onboardingState.agreements = [
    {
      agreementType: 'e_sign_consent',
      agreementName: 'E-sign Consent',
      accepted: false,
      documentVersion: null,
      acceptedAt: null,
    },
    {
      agreementType: 'account_opening_privacy',
      agreementName: 'Account Opening Privacy Notice',
      accepted: false,
      documentVersion: null,
      acceptedAt: null,
    },
  ]

  const html = renderToStaticMarkup(<AgreementsStep onCompleted={() => undefined} />)

  expect(html).toContain('E-sign Consent')
  expect(html).toContain('Account Opening Privacy Notice')
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(2)
  expect(html).not.toContain('Temporary privacy policy text.')
})

test('keeps only completion retry available after applicant submission', () => {
  const html = renderToStaticMarkup(<AgreementsStep onCompleted={() => undefined} />)
  const disabledAgreementButton = html.match(
    /<button[^>]*role="radio"[^>]*disabled=""[^>]*>[\s\S]*?<\/button>/,
  )?.[0]

  expect(html).toMatch(/<button[^>]*type="submit"><span>Continue<\/span>/)
  expect(disabledAgreementButton).toContain(
    'I have read and accept both agreements',
  )
  expect(html).toMatch(/<button[^>]*type="button"[^>]*disabled[^>]*>Back<\/button>/)
})

test('shows a loader without dimming Continue while final submission is pending', () => {
  onboardingState.state.submission = 'pending'
  onboardingState.state.completed = false

  const html = renderToStaticMarkup(<AgreementsStep onCompleted={() => undefined} />)

  expect(html).toContain('aria-busy="true"')
  expect(html).toContain('aria-label="Continuing"')
  expect(html).toContain('disabled:opacity-100')
  expect(html).toContain('<span class="invisible">Continue</span>')
  expect(html).toContain('<svg')
  expect(html).toContain('stroke="currentColor"')
})
