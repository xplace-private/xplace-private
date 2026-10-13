import { DEFAULT_RESEND_SECONDS } from './resend-countdown'
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneInput,
  type PhoneCountry,
} from '../../../shared/phone/phone-countries'

export type AuthStep = 'phone' | 'code'
export type AuthSubmissionKind =
  | 'request-code'
  | 'verify-code'
  | 'resend-code'

export interface AuthFlowGatewayError {
  message: string
  retryAfterSeconds?: number
}

export interface AuthFlowState {
  step: AuthStep
  country: PhoneCountry
  phone: string
  code: string
  challengeId: string | null
  resendSeconds: number
  errors: Partial<Record<'phone' | 'code', string>>
  gatewayError: AuthFlowGatewayError | null
  submission: 'idle' | 'pending'
  submissionKind: AuthSubmissionKind | null
}

export type AuthFlowEvent =
  | { type: 'phoneCountryChanged'; value: PhoneCountry }
  | { type: 'phoneChanged'; value: string }
  | { type: 'codeChanged'; value: string }
  | { type: 'errorsShown'; errors: AuthFlowState['errors'] }
  | {
      type: 'phoneAccepted'
      challengeId: string
      resendAfterSeconds: number
    }
  | { type: 'resendCountdownTick' }
  | {
      type: 'codeResent'
      challengeId: string
      resendAfterSeconds: number
    }
  | { type: 'backToContact' }
  | { type: 'submissionStarted'; kind: AuthSubmissionKind }
  | { type: 'submissionSucceeded' }
  | {
      type: 'submissionFailed'
      message: string
      retryAfterSeconds?: number
    }
  | { type: 'signedOut' }

export function createAuthFlowState(): AuthFlowState {
  return {
    step: 'phone',
    country: DEFAULT_PHONE_COUNTRY,
    phone: '',
    code: '',
    challengeId: null,
    resendSeconds: DEFAULT_RESEND_SECONDS,
    errors: {},
    gatewayError: null,
    submission: 'idle',
    submissionKind: null,
  }
}

export function validateAuthStep(state: AuthFlowState): AuthFlowState['errors'] {
  if (state.step === 'phone') {
    return state.phone.trim() === ''
      ? { phone: 'Enter phone number to continue' }
      : {}
  }

  return state.code.trim() === '' ? { code: 'Enter code to continue' } : {}
}

export function authFlowReducer(
  state: AuthFlowState,
  event: AuthFlowEvent,
): AuthFlowState {
  if (
    state.submission === 'pending' &&
    (event.type === 'phoneCountryChanged' ||
      event.type === 'phoneChanged' ||
      event.type === 'codeChanged' ||
      event.type === 'backToContact')
  ) {
    return state
  }

  switch (event.type) {
    case 'signedOut':
      return createAuthFlowState()
    case 'phoneCountryChanged':
      return {
        ...state,
        country: event.value,
        phone: formatPhoneInput(event.value, state.phone),
        challengeId: null,
        gatewayError: null,
      }
    case 'phoneChanged': {
      if (event.value.trim() === '') return { ...state, phone: event.value }

      const errors = { ...state.errors }
      delete errors.phone
      return {
        ...state,
        phone: formatPhoneInput(state.country, event.value),
        challengeId: null,
        errors,
        gatewayError: null,
      }
    }
    case 'codeChanged': {
      if (event.value.trim() === '') return { ...state, code: event.value }

      const errors = { ...state.errors }
      delete errors.code
      return { ...state, code: event.value, errors, gatewayError: null }
    }
    case 'errorsShown':
      return { ...state, errors: event.errors }
    case 'phoneAccepted':
      return {
        ...state,
        step: 'code',
        code: '',
        challengeId: event.challengeId,
        resendSeconds: event.resendAfterSeconds,
        errors: {},
        gatewayError: null,
      }
    case 'resendCountdownTick':
      return state.step !== 'code' || state.resendSeconds === 0
        ? state
        : { ...state, resendSeconds: state.resendSeconds - 1 }
    case 'codeResent':
      return {
        ...state,
        challengeId: event.challengeId,
        code: '',
        resendSeconds: event.resendAfterSeconds,
        errors: {},
        gatewayError: null,
      }
    case 'backToContact':
      return { ...state, step: 'phone', gatewayError: null }
    case 'submissionStarted':
      return state.submission === 'pending'
        ? state
        : {
            ...state,
            submission: 'pending',
            submissionKind: event.kind,
            gatewayError: null,
          }
    case 'submissionSucceeded':
      return { ...state, submission: 'idle', submissionKind: null }
    case 'submissionFailed':
      if (
        state.submissionKind === 'resend-code' &&
        event.retryAfterSeconds !== undefined
      ) {
        return {
          ...state,
          resendSeconds: event.retryAfterSeconds,
          submission: 'idle',
          submissionKind: null,
          gatewayError: null,
        }
      }

      return {
        ...state,
        submission: 'idle',
        submissionKind: null,
        gatewayError: {
          message: event.message,
          ...(event.retryAfterSeconds === undefined
            ? {}
            : { retryAfterSeconds: event.retryAfterSeconds }),
        },
      }
  }
}
