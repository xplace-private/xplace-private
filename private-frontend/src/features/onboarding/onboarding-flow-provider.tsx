import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import type { OccupationGateway } from './api/occupation-gateway'
import type {
  Agreement,
  OnboardingGateway,
  SubmitApplicantInput,
} from './api/onboarding-gateway'
import {
  createOnboardingFlowState,
  isAccountPurpose,
  isMonthlySpend,
  isOccupation,
  isYearlyIncome,
  onboardingFlowReducer,
  validateOnboardingStep,
  type AccountPurpose,
  type MonthlySpend,
  type Occupation,
  type OnboardingFlowState,
  type Residency,
  type YearlyIncome,
} from './model/onboarding-flow'
import {
  OccupationQueryError,
  occupationQueryOptions,
} from './occupation-query'

export type OccupationLoadStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'

export type AgreementLoadStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'

// React Refresh requires non-component exports to be explicitly acknowledged.
// eslint-disable-next-line react-refresh/only-export-components
export const AGREEMENTS_QUERY_KEY = ['onboarding', 'agreements'] as const

interface OnboardingFlowValue {
  state: OnboardingFlowState
  occupations: readonly Occupation[]
  occupationLoadStatus: OccupationLoadStatus
  occupationLoadError: string | null
  agreements: readonly Agreement[]
  agreementLoadStatus: AgreementLoadStatus
  setResidency(value: Exclude<Residency, null>): void
  setOccupation(value: Occupation): void
  setOccupationQuery(value: string): void
  setYearlyIncome(value: YearlyIncome): void
  setMonthlySpend(value: MonthlySpend): void
  setAccountPurpose(value: AccountPurpose): void
  acceptAgreements(): void
  continueStep(): Promise<boolean>
  retryOccupations(): void
  retryAgreements(): void
  back(): void
}

interface OnboardingFlowProviderProps {
  gateway: OnboardingGateway
  occupationGateway: OccupationGateway
  children: ReactNode
}

const OnboardingFlowContext = createContext<OnboardingFlowValue | null>(null)
const unexpectedFailureMessage = 'Something went wrong. Please try again.'

function createSubmitApplicantInput(
  state: OnboardingFlowState,
): SubmitApplicantInput | null {
  if (
    !isOccupation(state.occupation) ||
    !isYearlyIncome(state.yearlyIncome) ||
    !isMonthlySpend(state.monthlySpend) ||
    !isAccountPurpose(state.accountPurpose)
  ) {
    return null
  }

  return {
    occupation: state.occupation,
    yearlyIncome: state.yearlyIncome,
    monthlySpend: state.monthlySpend,
    accountPurpose: state.accountPurpose,
  }
}

/** Owns the page-lifetime onboarding draft and gateway orchestration. */
export function OnboardingFlowProvider({
  gateway,
  occupationGateway,
  children,
}: OnboardingFlowProviderProps) {
  const [state, dispatch] = useReducer(
    onboardingFlowReducer,
    undefined,
    createOnboardingFlowState,
  )
  const pendingRef = useRef(false)
  const [debouncedOccupationQuery, setDebouncedOccupationQuery] = useState('')
  const normalizedOccupationQuery = state.occupationQuery.trim()
  const occupationQuery = useQuery({
    ...occupationQueryOptions(occupationGateway, debouncedOccupationQuery),
    enabled: state.step === 2,
  })
  const agreementsQuery = useQuery({
    queryKey: AGREEMENTS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const result = await gateway.listAgreements(signal)
      if (result.ok) return result.data
      throw new Error(result.message)
    },
    enabled: state.step === 6,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const isOccupationSearchDebouncing =
    state.step === 2 && normalizedOccupationQuery !== debouncedOccupationQuery
  const occupationLoadStatus = useMemo<OccupationLoadStatus>(() => {
    if (state.step !== 2) return 'idle'
    if (
      isOccupationSearchDebouncing ||
      occupationQuery.isPending ||
      occupationQuery.isFetching
    ) {
      return 'loading'
    }
    if (occupationQuery.isError) return 'error'
    return occupationQuery.data.length === 0 ? 'empty' : 'success'
  }, [
    isOccupationSearchDebouncing,
    occupationQuery.data,
    occupationQuery.isError,
    occupationQuery.isFetching,
    occupationQuery.isPending,
    state.step,
  ])
  const occupationLoadError =
    occupationLoadStatus === 'error'
      ? occupationQuery.error instanceof OccupationQueryError
        ? occupationQuery.error.message
        : 'Unable to load occupations. Try again.'
      : null
  const agreementLoadStatus = useMemo<AgreementLoadStatus>(() => {
    if (state.step !== 6) return 'idle'
    if (agreementsQuery.isPending || agreementsQuery.isFetching) return 'loading'
    if (agreementsQuery.isError) return 'error'
    return agreementsQuery.data.length === 0 ? 'empty' : 'success'
  }, [
    agreementsQuery.data,
    agreementsQuery.isError,
    agreementsQuery.isFetching,
    agreementsQuery.isPending,
    state.step,
  ])

  useEffect(() => {
    if (normalizedOccupationQuery === debouncedOccupationQuery) return

    const timeout = globalThis.setTimeout(() => {
      setDebouncedOccupationQuery(normalizedOccupationQuery)
    }, 300)

    return () => globalThis.clearTimeout(timeout)
  }, [debouncedOccupationQuery, normalizedOccupationQuery])

  const setResidency = useCallback((value: Exclude<Residency, null>) => {
    dispatch({ type: 'residencySelected', value })
  }, [])

  const setOccupation = useCallback((value: Occupation) => {
    dispatch({ type: 'occupationSelected', value })
  }, [])

  const setOccupationQuery = useCallback((value: string) => {
    dispatch({ type: 'occupationQueryChanged', value })
  }, [])

  const setYearlyIncome = useCallback((value: YearlyIncome) => {
    dispatch({ type: 'yearlyIncomeSelected', value })
  }, [])

  const setMonthlySpend = useCallback((value: MonthlySpend) => {
    dispatch({ type: 'monthlySpendSelected', value })
  }, [])

  const setAccountPurpose = useCallback((value: AccountPurpose) => {
    dispatch({ type: 'accountPurposeSelected', value })
  }, [])

  const acceptAgreements = useCallback(() => {
    dispatch({ type: 'agreementsAccepted' })
  }, [])

  const continueStep = useCallback(async () => {
    if (pendingRef.current || state.completed) {
      return false
    }

    const errors = validateOnboardingStep(state)
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'errorsShown', errors })
      return false
    }

    if (state.step !== 6) {
      dispatch({ type: 'submissionSucceeded' })
      return true
    }

    const input = createSubmitApplicantInput(state)
    if (input === null || agreementsQuery.data === undefined) return false

    pendingRef.current = true
    dispatch({ type: 'submissionStarted' })

    try {
      const result = await gateway.submitApplicant(input, agreementsQuery.data)
      if (!result.ok) {
        dispatch({ type: 'submissionFailed', message: unexpectedFailureMessage })
        return false
      }

      dispatch({ type: 'submissionSucceeded' })
      return true
    } catch {
      dispatch({ type: 'submissionFailed', message: unexpectedFailureMessage })
      return false
    } finally {
      pendingRef.current = false
    }
  }, [agreementsQuery.data, gateway, state])

  const back = useCallback(() => {
    dispatch({ type: 'back' })
  }, [])

  const retryOccupations = useCallback(() => {
    void occupationQuery.refetch()
  }, [occupationQuery])

  const retryAgreements = useCallback(() => {
    void agreementsQuery.refetch()
  }, [agreementsQuery])

  const value = useMemo(
    () => ({
      state,
      occupations: occupationQuery.data ?? [],
      occupationLoadStatus,
      occupationLoadError,
      agreements: agreementsQuery.data ?? [],
      agreementLoadStatus,
      setResidency,
      setOccupation,
      setOccupationQuery,
      setYearlyIncome,
      setMonthlySpend,
      setAccountPurpose,
      acceptAgreements,
      continueStep,
      retryOccupations,
      retryAgreements,
      back,
    }),
    [
      acceptAgreements,
      agreementLoadStatus,
      agreementsQuery.data,
      back,
      continueStep,
      occupationLoadError,
      occupationLoadStatus,
      occupationQuery.data,
      retryOccupations,
      retryAgreements,
      setAccountPurpose,
      setMonthlySpend,
      setOccupation,
      setOccupationQuery,
      setResidency,
      setYearlyIncome,
      state,
    ],
  )

  return <OnboardingFlowContext value={value}>{children}</OnboardingFlowContext>
}

// React Refresh requires non-component exports to be explicitly acknowledged.
// eslint-disable-next-line react-refresh/only-export-components
export function useOnboardingFlow(): OnboardingFlowValue {
  const value = useContext(OnboardingFlowContext)

  if (value === null) {
    throw new Error('useOnboardingFlow must be used within OnboardingFlowProvider')
  }

  return value
}
