import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { ApplicantGateway } from './api/applicant-gateway'
import type { SumsubToken, SumsubTokenGateway } from './api/sumsub-token-gateway'
import {
  applicantQueryOptions,
  ApplicantQueryError,
  APPLICANT_QUERY_KEY,
} from './applicant-query'
import type { Applicant } from './model/applicant'
import {
  loadSumsubToken,
  SUMSUB_TOKEN_QUERY_KEY,
  SumsubTokenQueryError,
} from './sumsub-token-query'
import type { VerificationSessionStore } from './verification-session-store'

interface VerificationFlowProviderProps {
  applicantGateway: ApplicantGateway
  tokenGateway: SumsubTokenGateway
  sessionStore: VerificationSessionStore
  enabled: boolean
  sessionActive: boolean
  sessionIdentity: number
  isSessionIdentityCurrent(identity: number): boolean
  children: ReactNode
}

interface VerificationFlowValue {
  applicant: Applicant | null | undefined
  applicantStatus: 'disabled' | 'loading' | 'success' | 'error'
  applicantError: Error | null
  refetchApplicant(): Promise<void>
  invalidateApplicant(): Promise<Applicant | null>
  token: SumsubToken | null
  tokenStatus: 'idle' | 'loading' | 'success' | 'error'
  prepareToken(): Promise<boolean>
  refreshToken(): Promise<string>
  clearToken(): void
  submitted: boolean
  markSubmitted(): void
  markAttemptFailed(): void
  consumeAttemptFailure(): boolean
}

const VerificationFlowContext = createContext<VerificationFlowValue | null>(null)
const unexpectedFailureMessage = 'Something went wrong. Please try again.'

export function VerificationFlowProvider({
  applicantGateway,
  tokenGateway,
  sessionStore,
  enabled,
  sessionActive,
  sessionIdentity,
  isSessionIdentityCurrent,
  children,
}: VerificationFlowProviderProps) {
  const queryClient = useQueryClient()
  const [submitted, setSubmitted] = useState(() => sessionStore.isSubmitted())
  const tokenRefreshController = useRef<AbortController | null>(null)
  const tokenRefreshPromise = useRef<Promise<string> | null>(null)
  const tokenRefreshGeneration = useRef(0)
  const activeSessionIdentity = useRef(sessionIdentity)
  const cancelTokenRefresh = useCallback(() => {
    tokenRefreshGeneration.current += 1
    tokenRefreshController.current?.abort()
    tokenRefreshController.current = null
    tokenRefreshPromise.current = null
  }, [])
  const applicantQuery = useQuery({
    ...applicantQueryOptions(applicantGateway),
    enabled,
  })
  const tokenQuery = useQuery({
    queryKey: SUMSUB_TOKEN_QUERY_KEY,
    queryFn: ({ signal }) => loadSumsubToken(tokenGateway, signal),
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
  const refetchApplicantQuery = applicantQuery.refetch
  const refetchToken = tokenQuery.refetch

  const applicantStatus = useMemo<VerificationFlowValue['applicantStatus']>(() => {
    if (!enabled) return 'disabled'
    if (applicantQuery.data !== undefined) return 'success'
    if (applicantQuery.isError) return 'error'
    return 'loading'
  }, [
    applicantQuery.data,
    applicantQuery.isError,
    enabled,
  ])

  const applicantError = useMemo(() => {
    if (!applicantQuery.isError) return null
    if (applicantQuery.error instanceof ApplicantQueryError) {
      return applicantQuery.error
    }
    return new Error(unexpectedFailureMessage)
  }, [applicantQuery.error, applicantQuery.isError])

  const tokenStatus = useMemo<VerificationFlowValue['tokenStatus']>(() => {
    if (tokenQuery.isFetching) return 'loading'
    if (tokenQuery.isError) return 'error'
    return tokenQuery.data === undefined ? 'idle' : 'success'
  }, [tokenQuery.data, tokenQuery.isError, tokenQuery.isFetching])

  useLayoutEffect(() => {
    const identityChanged = activeSessionIdentity.current !== sessionIdentity
    activeSessionIdentity.current = sessionIdentity
    if (sessionActive && !identityChanged) return

    cancelTokenRefresh()
    sessionStore.clear()
    // Keep provider state aligned with the active identity without a remount.
    setSubmitted(false)
  }, [cancelTokenRefresh, sessionActive, sessionIdentity, sessionStore])

  useLayoutEffect(() => {
    const currentApplicant = applicantQuery.data
    if (
      currentApplicant === undefined ||
      !hasDurableApplicantProgress(currentApplicant)
    ) {
      return
    }

    sessionStore.clearSubmitted()
    // Keep the tab latch and exposed React state coherent before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubmitted(false)
  }, [applicantQuery.data, sessionStore])

  useEffect(() => cancelTokenRefresh, [cancelTokenRefresh])

  const refetchApplicant = useCallback(async () => {
    await refetchApplicantQuery({ cancelRefetch: false })
  }, [refetchApplicantQuery])

  const invalidateApplicant = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: APPLICANT_QUERY_KEY })
    return (
      queryClient.getQueryData<Applicant | null>(APPLICANT_QUERY_KEY) ?? null
    )
  }, [queryClient])

  const prepareToken = useCallback(async () => {
    if (queryClient.getQueryData<SumsubToken>(SUMSUB_TOKEN_QUERY_KEY) !== undefined) {
      return true
    }

    const result = await refetchToken()
    return result.isSuccess
  }, [queryClient, refetchToken])

  const refreshToken = useCallback(() => {
    const inFlightRefresh = tokenRefreshPromise.current
    if (inFlightRefresh !== null) return inFlightRefresh

    const controller = new AbortController()
    const generation = tokenRefreshGeneration.current + 1
    tokenRefreshGeneration.current = generation
    tokenRefreshController.current = controller

    const refresh = loadSumsubToken(tokenGateway, controller.signal)
      .then((token) => {
        if (tokenRefreshGeneration.current !== generation) {
          throw new SumsubTokenQueryError(
            'sumsub-token-failed',
            unexpectedFailureMessage,
          )
        }
        if (!isSessionIdentityCurrent(sessionIdentity)) {
          throw new SumsubTokenQueryError(
            'sumsub-token-failed',
            unexpectedFailureMessage,
          )
        }

        queryClient.setQueryData(SUMSUB_TOKEN_QUERY_KEY, token)
        return token.token
      })
      .finally(() => {
        if (tokenRefreshController.current === controller) {
          tokenRefreshController.current = null
          tokenRefreshPromise.current = null
        }
      })
    tokenRefreshPromise.current = refresh
    return refresh
  }, [
    isSessionIdentityCurrent,
    queryClient,
    sessionIdentity,
    tokenGateway,
  ])

  const clearToken = useCallback(() => {
    cancelTokenRefresh()
    void queryClient.resetQueries({
      queryKey: SUMSUB_TOKEN_QUERY_KEY,
      exact: true,
    })
  }, [cancelTokenRefresh, queryClient])

  const markSubmitted = useCallback(() => {
    sessionStore.markSubmitted()
    setSubmitted(true)
  }, [sessionStore])

  const markAttemptFailed = useCallback(() => {
    sessionStore.markAttemptFailed()
  }, [sessionStore])

  const consumeAttemptFailure = useCallback(
    () => sessionStore.consumeAttemptFailure(),
    [sessionStore],
  )

  const value = useMemo<VerificationFlowValue>(
    () => ({
      applicant: applicantQuery.data,
      applicantStatus,
      applicantError,
      refetchApplicant,
      invalidateApplicant,
      token: tokenQuery.data ?? null,
      tokenStatus,
      prepareToken,
      refreshToken,
      clearToken,
      submitted,
      markSubmitted,
      markAttemptFailed,
      consumeAttemptFailure,
    }),
    [
      applicantError,
      applicantQuery.data,
      applicantStatus,
      clearToken,
      consumeAttemptFailure,
      invalidateApplicant,
      markAttemptFailed,
      markSubmitted,
      prepareToken,
      refreshToken,
      refetchApplicant,
      submitted,
      tokenQuery.data,
      tokenStatus,
    ],
  )

  return (
    <VerificationFlowContext value={value}>{children}</VerificationFlowContext>
  )
}

function hasDurableApplicantProgress(applicant: Applicant | null): boolean {
  if (applicant === null) return false

  return (
    applicant.status === 'pending' ||
    applicant.status === 'approved' ||
    applicant.status === 'rejected' ||
    applicant.rainApproved ||
    applicant.rainStatus === 'denied' ||
    applicant.rainStatus === 'locked' ||
    applicant.rainStatus === 'canceled'
  )
}

// React Refresh requires non-component exports to be explicitly acknowledged.
// eslint-disable-next-line react-refresh/only-export-components
export function useVerificationFlow(): VerificationFlowValue {
  const value = useContext(VerificationFlowContext)
  if (value === null) {
    throw new Error(
      'useVerificationFlow must be used within VerificationFlowProvider',
    )
  }

  return value
}
