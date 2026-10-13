import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { mapUnexpectedAuthError, type AuthGateway } from './api/auth-gateway'
import { isTwoFactorRequirement, type TwoFactorRequirement } from './api/authenticator-gateway'
import type { AuthSessionStore } from './api/browser-auth-session-store'
import type { CurrentUser, CurrentUserGateway } from './api/current-user-gateway'
import { CURRENT_USER_QUERY_KEY, currentUserQueryOptions } from './current-user-query'
import {
  authFlowReducer,
  createAuthFlowState,
  validateAuthStep,
  type AuthFlowState,
} from './model/auth-flow'
import {
  formatPhoneNumber,
  type PhoneCountry,
} from '../../shared/phone/phone-countries'

export type AuthSessionState =
  | { status: 'anonymous'; user: null; error: null }
  | { status: 'checking'; user: null; error: null }
  | { status: 'two-factor-required'; requirement: TwoFactorRequirement; user: null; error: null }
  | { status: 'authenticated'; user: CurrentUser; error: null }
  | { status: 'recovery-error'; user: null; error: string }

interface AuthFlowValue {
  state: AuthFlowState
  session: AuthSessionState
  setCountry(value: PhoneCountry): void
  setPhone(value: string): void
  setCode(value: string): void
  requestCode(): Promise<boolean>
  resendCode(): Promise<boolean>
  verifyCode(): Promise<boolean>
  completeTwoFactor(): Promise<void>
  retrySession(): Promise<boolean>
  tickResendCountdown(): void
  backToContact(): void
  signOut(): Promise<boolean>
}

interface AuthFlowProviderProps {
  gateway: AuthGateway
  currentUserGateway: CurrentUserGateway
  sessionStore: AuthSessionStore
  onSessionReady(): Promise<void>
  children: ReactNode
}

const AuthFlowContext = createContext<AuthFlowValue | null>(null)

/** Owns the in-memory WhatsApp authentication draft and cookie-session handoff. */
export function AuthFlowProvider({
  gateway,
  currentUserGateway,
  sessionStore,
  onSessionReady,
  children,
}: AuthFlowProviderProps) {
  const { t } = useAppTranslation()
  const [state, dispatch] = useReducer(authFlowReducer, undefined, () =>
    createAuthFlowState(),
  )
  const pendingRef = useRef(false)
  const signOutRequestRef = useRef<Promise<boolean> | null>(null)
  const sessionStatus = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.readStatus,
    sessionStore.readStatus,
  )
  const queryClient = useQueryClient()
  const currentUserQuery = useQuery({
    ...currentUserQueryOptions(currentUserGateway),
    enabled: sessionStatus !== 'anonymous' && !isTwoFactorRequirement(sessionStatus),
  })
  const session = useMemo<AuthSessionState>(
    () =>
      sessionStatus === 'anonymous'
        ? { status: 'anonymous', user: null, error: null }
        : isTwoFactorRequirement(sessionStatus)
          ? { status: 'two-factor-required', requirement: sessionStatus, user: null, error: null }
        : currentUserQuery.isSuccess
          ? { status: 'authenticated', user: currentUserQuery.data, error: null }
          : currentUserQuery.isError
            ? {
                status: 'recovery-error',
                user: null,
                error: 'Unable to restore session. Try again.',
              }
            : { status: 'checking', user: null, error: null },
    [
      currentUserQuery.data,
      currentUserQuery.isError,
      currentUserQuery.isSuccess,
      sessionStatus,
    ],
  )

  const setPhone = useCallback((value: string) => {
    dispatch({ type: 'phoneChanged', value })
  }, [])

  const setCountry = useCallback((value: PhoneCountry) => {
    dispatch({ type: 'phoneCountryChanged', value })
  }, [])

  const setCode = useCallback((value: string) => {
    dispatch({ type: 'codeChanged', value })
  }, [])

  const requestCode = useCallback(async () => {
    if (pendingRef.current) return false

    const errors = validateAuthStep(state)
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'errorsShown', errors })
      return false
    }

    pendingRef.current = true
    dispatch({ type: 'submissionStarted', kind: 'request-code' })
    try {
      const result = await gateway.requestCode({
        phone: formatPhoneNumber(state.country, state.phone),
      })
      if (!result.ok) {
        dispatch({
          type: 'submissionFailed',
          message: result.message,
          ...(result.retryAfterSeconds === undefined
            ? {}
            : { retryAfterSeconds: result.retryAfterSeconds }),
        })
        return false
      }

      dispatch({ type: 'submissionSucceeded' })
      dispatch({
        type: 'phoneAccepted',
        challengeId: result.data.challengeId,
        resendAfterSeconds: result.data.resendAfterSeconds,
      })
      return true
    } catch (error: unknown) {
      const failure = mapUnexpectedAuthError(error)
      dispatch({ type: 'submissionFailed', message: failure.message })
      return false
    } finally {
      pendingRef.current = false
    }
  }, [gateway, state])

  const resendCode = useCallback(async () => {
    if (
      pendingRef.current ||
      state.step !== 'code' ||
      state.resendSeconds > 0
    ) {
      return false
    }

    pendingRef.current = true
    dispatch({ type: 'submissionStarted', kind: 'resend-code' })
    try {
      const result = await gateway.requestCode({
        phone: formatPhoneNumber(state.country, state.phone),
      })
      if (!result.ok) {
        dispatch({
          type: 'submissionFailed',
          message: result.message,
          ...(result.retryAfterSeconds === undefined
            ? {}
            : { retryAfterSeconds: result.retryAfterSeconds }),
        })
        return false
      }

      dispatch({
        type: 'codeResent',
        challengeId: result.data.challengeId,
        resendAfterSeconds: result.data.resendAfterSeconds,
      })
      dispatch({ type: 'submissionSucceeded' })
      return true
    } catch (error: unknown) {
      const failure = mapUnexpectedAuthError(error)
      dispatch({ type: 'submissionFailed', message: failure.message })
      return false
    } finally {
      pendingRef.current = false
    }
  }, [gateway, state])

  const verifyCode = useCallback(async () => {
    if (pendingRef.current) return false

    const errors = validateAuthStep(state)
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'errorsShown', errors })
      return false
    }

    pendingRef.current = true
    dispatch({ type: 'submissionStarted', kind: 'verify-code' })
    try {
      if (state.challengeId === null) {
        dispatch({
          type: 'submissionFailed',
          message: 'Unable to continue. Try again.',
        })
        return false
      }

      const result = await gateway.verifyOtp({
        challengeId: state.challengeId,
        code: state.code,
      })
      if (!result.ok) {
        dispatch({ type: 'submissionFailed', message: result.message })
        return false
      }

      if (result.data.twoFactorRequirement !== null) {
        sessionStore.requireTwoFactor(result.data.twoFactorRequirement)
        await onSessionReady()
        dispatch({ type: 'submissionSucceeded' })
        return true
      }

      sessionStore.markAuthenticated()
      try {
        await queryClient.fetchQuery(currentUserQueryOptions(currentUserGateway))
        await onSessionReady()
        dispatch({ type: 'submissionSucceeded' })
        return true
      } catch {
        dispatch({ type: 'submissionSucceeded' })
        return false
      }
    } catch (error: unknown) {
      const failure = mapUnexpectedAuthError(error)
      dispatch({ type: 'submissionFailed', message: failure.message })
      return false
    } finally {
      pendingRef.current = false
    }
  }, [
    currentUserGateway,
    gateway,
    onSessionReady,
    queryClient,
    sessionStore,
    state,
  ])

  const completeTwoFactor = useCallback(async () => {
    sessionStore.markAuthenticated()
    await onSessionReady()
  }, [onSessionReady, sessionStore])

  const retrySession = useCallback(async () => {
    const result = await currentUserQuery.refetch()
    return result.isSuccess
  }, [currentUserQuery])

  const tickResendCountdown = useCallback(() => {
    dispatch({ type: 'resendCountdownTick' })
  }, [])

  const backToContact = useCallback(() => {
    dispatch({ type: 'backToContact' })
  }, [])

  const signOut = useCallback(() => {
    if (signOutRequestRef.current !== null) {
      return signOutRequestRef.current
    }

    const request = (async () => {
      try {
        await gateway.signOut()
        sessionStore.clear()
        queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
        dispatch({ type: 'signedOut' })
        return true
      } catch {
        toast.error(t('auth.errors.signOut'))
        return false
      } finally {
        signOutRequestRef.current = null
      }
    })()
    signOutRequestRef.current = request
    return request
  }, [gateway, queryClient, sessionStore, t])

  const value = useMemo(
    () => ({
      state,
      session,
      setCountry,
      setPhone,
      setCode,
      requestCode,
      resendCode,
      verifyCode,
      completeTwoFactor,
      retrySession,
      tickResendCountdown,
      backToContact,
      signOut,
    }),
    [
      backToContact,
      completeTwoFactor,
      requestCode,
      resendCode,
      retrySession,
      session,
      setCode,
      setCountry,
      setPhone,
      signOut,
      state,
      tickResendCountdown,
      verifyCode,
    ],
  )

  return <AuthFlowContext value={value}>{children}</AuthFlowContext>
}

// React Refresh requires non-component exports to be explicitly acknowledged.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuthFlow(): AuthFlowValue {
  const value = useContext(AuthFlowContext)
  if (value === null) {
    throw new Error('useAuthFlow must be used within AuthFlowProvider')
  }
  return value
}
