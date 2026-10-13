export type Residency = 'united-states' | 'rest-of-world' | null

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6

export interface Occupation {
  id: number
  name: string
}

export const YEARLY_INCOMES = [
  'Less than USD 25,000',
  'USD 25,000 – 50,000',
  'USD 50,000 – 100,000',
  'USD 100,000 – 180,000',
  'More than USD 180,000',
] as const

export type YearlyIncome = (typeof YEARLY_INCOMES)[number]

export const MONTHLY_SPENDS = [
  'Less than USD 1,000',
  'USD 1,000 – 5,000',
  'USD 5,000 – 25,000',
  'USD 25,000 – 50,000',
  'More than USD 50,000',
] as const

export type MonthlySpend = (typeof MONTHLY_SPENDS)[number]

export const ACCOUNT_PURPOSES = [
  'Personal spending',
  'Business expenses',
  'Investments',
  'Something else',
] as const

export type AccountPurpose = (typeof ACCOUNT_PURPOSES)[number]

export type OnboardingField =
  | 'residency'
  | 'occupation'
  | 'yearlyIncome'
  | 'monthlySpend'
  | 'accountPurpose'
  | 'agreementsAccepted'

export interface OnboardingFlowState {
  step: OnboardingStep
  residency: Residency
  occupation: Occupation | null
  occupationQuery: string
  yearlyIncome: YearlyIncome | null
  monthlySpend: MonthlySpend | null
  accountPurpose: AccountPurpose | null
  agreementsAccepted: boolean
  errors: Partial<Record<OnboardingField, string>>
  gatewayError: string | null
  submission: 'idle' | 'pending'
  completed: boolean
}

export type OnboardingFlowEvent =
  | { type: 'residencySelected'; value: Exclude<Residency, null> }
  | { type: 'occupationSelected'; value: Occupation }
  | { type: 'occupationQueryChanged'; value: string }
  | { type: 'yearlyIncomeSelected'; value: YearlyIncome }
  | { type: 'monthlySpendSelected'; value: MonthlySpend }
  | { type: 'accountPurposeSelected'; value: AccountPurpose }
  | { type: 'agreementsAccepted' }
  | { type: 'errorsShown'; errors: OnboardingFlowState['errors'] }
  | { type: 'back' }
  | { type: 'submissionStarted' }
  | { type: 'submissionSucceeded' }
  | { type: 'submissionFailed'; message: string }

export function createOnboardingFlowState(): OnboardingFlowState {
  return {
    step: 1,
    residency: null,
    occupation: null,
    occupationQuery: '',
    yearlyIncome: null,
    monthlySpend: null,
    accountPurpose: null,
    agreementsAccepted: false,
    errors: {},
    gatewayError: null,
    submission: 'idle',
    completed: false,
  }
}

export function isOccupation(value: unknown): value is Occupation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const { id, name } = value as Record<string, unknown>
  return (
    typeof id === 'number' &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    typeof name === 'string' &&
    name.trim() !== ''
  )
}

export function isYearlyIncome(value: string | null): value is YearlyIncome {
  return YEARLY_INCOMES.some((yearlyIncome) => yearlyIncome === value)
}

export function isMonthlySpend(value: string | null): value is MonthlySpend {
  return MONTHLY_SPENDS.some((monthlySpend) => monthlySpend === value)
}

export function isAccountPurpose(value: string | null): value is AccountPurpose {
  return ACCOUNT_PURPOSES.some((accountPurpose) => accountPurpose === value)
}

export function validateOnboardingStep(
  state: OnboardingFlowState,
): OnboardingFlowState['errors'] {
  switch (state.step) {
    case 1:
      return state.residency === null ? { residency: 'Select to continue' } : {}
    case 2:
      return isOccupation(state.occupation) ? {} : { occupation: 'Select to continue' }
    case 3:
      return isYearlyIncome(state.yearlyIncome)
        ? {}
        : { yearlyIncome: 'Select to continue' }
    case 4:
      return isMonthlySpend(state.monthlySpend)
        ? {}
        : { monthlySpend: 'Select to continue' }
    case 5:
      return isAccountPurpose(state.accountPurpose)
        ? {}
        : { accountPurpose: 'Select to continue' }
    case 6:
      return state.agreementsAccepted
        ? {}
        : { agreementsAccepted: 'Select to continue' }
  }
}

function clearError(
  errors: OnboardingFlowState['errors'],
  field: OnboardingField,
): OnboardingFlowState['errors'] {
  const nextErrors = { ...errors }
  delete nextErrors[field]
  return nextErrors
}

function nextStep(step: OnboardingStep): OnboardingStep {
  switch (step) {
    case 1:
      return 2
    case 2:
      return 3
    case 3:
      return 4
    case 4:
      return 5
    case 5:
      return 6
    case 6:
      return 6
  }
}

function previousStep(step: OnboardingStep): OnboardingStep {
  switch (step) {
    case 1:
      return 1
    case 2:
      return 1
    case 3:
      return 2
    case 4:
      return 3
    case 5:
      return 4
    case 6:
      return 5
  }
}

export function onboardingFlowReducer(
  state: OnboardingFlowState,
  event: OnboardingFlowEvent,
): OnboardingFlowState {
  if (
    state.submission === 'pending' &&
    (event.type === 'residencySelected' ||
      event.type === 'occupationSelected' ||
      event.type === 'occupationQueryChanged' ||
      event.type === 'yearlyIncomeSelected' ||
      event.type === 'monthlySpendSelected' ||
      event.type === 'accountPurposeSelected' ||
      event.type === 'agreementsAccepted' ||
      event.type === 'back')
  ) {
    return state
  }

  switch (event.type) {
    case 'residencySelected':
      return {
        ...state,
        residency: event.value,
        errors: clearError(state.errors, 'residency'),
        gatewayError: null,
      }
    case 'occupationSelected':
      return {
        ...state,
        occupation: event.value,
        errors: clearError(state.errors, 'occupation'),
        gatewayError: null,
      }
    case 'occupationQueryChanged':
      return { ...state, occupationQuery: event.value }
    case 'yearlyIncomeSelected':
      return {
        ...state,
        yearlyIncome: event.value,
        errors: clearError(state.errors, 'yearlyIncome'),
        gatewayError: null,
      }
    case 'monthlySpendSelected':
      return {
        ...state,
        monthlySpend: event.value,
        errors: clearError(state.errors, 'monthlySpend'),
        gatewayError: null,
      }
    case 'accountPurposeSelected':
      return {
        ...state,
        accountPurpose: event.value,
        errors: clearError(state.errors, 'accountPurpose'),
        gatewayError: null,
      }
    case 'agreementsAccepted':
      return {
        ...state,
        agreementsAccepted: true,
        errors: clearError(state.errors, 'agreementsAccepted'),
        gatewayError: null,
      }
    case 'errorsShown':
      return { ...state, errors: event.errors }
    case 'back':
      return { ...state, step: previousStep(state.step), gatewayError: null }
    case 'submissionStarted':
      return state.submission === 'pending'
        ? state
        : { ...state, submission: 'pending', gatewayError: null }
    case 'submissionSucceeded':
      return state.step === 6
        ? { ...state, submission: 'idle', completed: true }
        : { ...state, step: nextStep(state.step), submission: 'idle' }
    case 'submissionFailed':
      return { ...state, submission: 'idle', gatewayError: event.message }
  }
}
