import { describe, expect, test } from 'vitest'

import {
  authFlowReducer,
  createAuthFlowState,
  validateAuthStep,
} from './auth-flow'

describe('WhatsApp auth flow', () => {
  test('starts with phone entry and no browser session credential', () => {
    expect(createAuthFlowState()).toMatchObject({
      step: 'phone',
      country: {
        code: 'US',
        flag: '🇺🇸',
        name: 'United States',
        phoneCode: '+1',
      },
      phone: '',
      challengeId: null,
    })
  })

  test('requires a phone number before continuing', () => {
    expect(validateAuthStep(createAuthFlowState())).toEqual({
      phone: 'Enter phone number to continue',
    })
  })

  test('stores an edited phone and clears its visible failure', () => {
    const warned = {
      ...createAuthFlowState(),
      errors: { phone: 'Enter phone number to continue' },
      gatewayError: { message: 'Unable to request a code' },
    }

    expect(
      authFlowReducer(warned, {
        type: 'phoneChanged',
        value: '554570290',
      }),
    ).toMatchObject({
      phone: '(554) 570-290',
      errors: {},
      gatewayError: null,
    })
  })

  test('formats an edited phone for the selected country', () => {
    const state = {
      ...createAuthFlowState(),
      country: {
        code: 'US' as const,
        flag: '🇺🇸',
        name: 'United States',
        phoneCode: '+1',
      },
    }

    expect(
      authFlowReducer(state, {
        type: 'phoneChanged',
        value: '2133734253',
      }).phone,
    ).toBe('(213) 373-4253')
  })

  test('stores a different phone country and clears the previous challenge', () => {
    const state = {
      ...createAuthFlowState(),
      challengeId: 'challenge-1',
      gatewayError: { message: 'Unable to request a code' },
    }

    expect(
      authFlowReducer(state, {
        type: 'phoneCountryChanged',
        value: {
          code: 'GB',
          flag: '🇬🇧',
          name: 'United Kingdom',
          phoneCode: '+44',
        },
      }),
    ).toMatchObject({
      country: { code: 'GB', phoneCode: '+44' },
      challengeId: null,
      gatewayError: null,
    })
  })

  test('reformats the phone when its country changes', () => {
    const state = { ...createAuthFlowState(), phone: '02071838750' }

    expect(
      authFlowReducer(state, {
        type: 'phoneCountryChanged',
        value: {
          code: 'GB',
          flag: '🇬🇧',
          name: 'United Kingdom',
          phoneCode: '+44',
        },
      }).phone,
    ).toBe('020 7183 8750')
  })

  test('accepts a backend challenge and uses its resend timer', () => {
    const withPhone = authFlowReducer(createAuthFlowState(), {
      type: 'phoneChanged',
      value: '554570290',
    })

    expect(
      authFlowReducer(withPhone, {
        type: 'phoneAccepted',
        challengeId: 'challenge-1',
        resendAfterSeconds: 57,
      }),
    ).toMatchObject({
      step: 'code',
      phone: '(554) 570-290',
      challengeId: 'challenge-1',
      resendSeconds: 57,
      code: '',
    })
  })

  test('requires a code on the verification step', () => {
    expect(
      validateAuthStep({ ...createAuthFlowState(), step: 'code' }),
    ).toEqual({ code: 'Enter code to continue' })
  })

  test('ticks the resend countdown without going below zero', () => {
    const countingDown = {
      ...createAuthFlowState(),
      step: 'code' as const,
      resendSeconds: 1,
    }
    const available = authFlowReducer(countingDown, {
      type: 'resendCountdownTick',
    })

    expect(available.resendSeconds).toBe(0)
    expect(
      authFlowReducer(available, { type: 'resendCountdownTick' }),
    ).toBe(available)
  })

  test('replaces an expired challenge after resending', () => {
    const state = {
      ...createAuthFlowState(),
      step: 'code' as const,
      challengeId: 'challenge-1',
      code: '123456',
      resendSeconds: 0,
      gatewayError: { message: 'Incorrect code' },
    }

    expect(
      authFlowReducer(state, {
        type: 'codeResent',
        challengeId: 'challenge-2',
        resendAfterSeconds: 60,
      }),
    ).toMatchObject({
      challengeId: 'challenge-2',
      code: '',
      resendSeconds: 60,
      gatewayError: null,
    })
  })

  test('uses a resend rate limit as the countdown without showing an OTP error', () => {
    const state = {
      ...createAuthFlowState(),
      step: 'code' as const,
      submission: 'pending' as const,
      submissionKind: 'resend-code' as const,
      resendSeconds: 0,
    }

    expect(
      authFlowReducer(state, {
        type: 'submissionFailed',
        message: 'Please try again in 57s.',
        retryAfterSeconds: 57,
      }),
    ).toMatchObject({
      resendSeconds: 57,
      submission: 'idle',
      submissionKind: null,
      gatewayError: null,
    })
  })

  test('keeps an initial request rate limit for localized rendering', () => {
    const state = {
      ...createAuthFlowState(),
      submission: 'pending' as const,
      submissionKind: 'request-code' as const,
    }

    expect(
      authFlowReducer(state, {
        type: 'submissionFailed',
        message: 'Please try again in 57s.',
        retryAfterSeconds: 57,
      }),
    ).toMatchObject({
      gatewayError: {
        message: 'Please try again in 57s.',
        retryAfterSeconds: 57,
      },
    })
  })

  test('returns from code entry to the phone step', () => {
    const state = {
      ...createAuthFlowState(),
      step: 'code' as const,
      phone: '554570290',
      gatewayError: { message: 'Incorrect code' },
    }

    expect(authFlowReducer(state, { type: 'backToContact' })).toMatchObject({
      step: 'phone',
      phone: '554570290',
      gatewayError: null,
    })
  })

  test('ignores draft changes and Back while a submission is pending', () => {
    const pending = {
      ...createAuthFlowState(),
      step: 'code' as const,
      phone: '554570290',
      code: '123456',
      submission: 'pending' as const,
    }

    expect(
      authFlowReducer(pending, { type: 'phoneChanged', value: '555555555' }),
    ).toBe(pending)
    expect(
      authFlowReducer(pending, { type: 'codeChanged', value: '654321' }),
    ).toBe(pending)
    expect(authFlowReducer(pending, { type: 'backToContact' })).toBe(pending)
  })

  test('clears the complete authentication draft when signing out', () => {
    const state = {
      ...createAuthFlowState(),
      step: 'code' as const,
      phone: '554570290',
      challengeId: 'challenge-1',
      code: '123456',
      gatewayError: { message: 'Unable to continue' },
    }

    expect(authFlowReducer(state, { type: 'signedOut' })).toEqual(
      createAuthFlowState(),
    )
  })
})
