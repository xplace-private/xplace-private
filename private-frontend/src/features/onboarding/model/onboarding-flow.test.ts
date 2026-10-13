import { describe, expect, test } from 'vitest'

import {
  onboardingFlowReducer,
  createOnboardingFlowState,
  validateOnboardingStep,
  type OnboardingFlowEvent,
} from './onboarding-flow'

const accountant = { id: 11, name: 'Accountant' } as const
const actuary = { id: 12, name: 'Actuary' } as const

describe('onboarding flow', () => {
  test('requires a residency selection before continuing from step 1', () => {
    expect(validateOnboardingStep(createOnboardingFlowState())).toEqual({
      residency: 'Select to continue',
    })
  })

  test('clears a residency warning when residency is selected', () => {
    const state = onboardingFlowReducer(
      { ...createOnboardingFlowState(), errors: { residency: 'Select to continue' } },
      { type: 'residencySelected', value: 'united-states' },
    )

    expect(state.errors.residency).toBeUndefined()
  })

  test('moves to step 2 after step 1 is accepted', () => {
    const withResidency = onboardingFlowReducer(createOnboardingFlowState(), {
      type: 'residencySelected',
      value: 'united-states',
    })

    expect(onboardingFlowReducer(withResidency, { type: 'submissionSucceeded' }).step).toBe(2)
  })

  test('returns to step 1 without clearing selected values', () => {
    const atStepTwo = {
      ...createOnboardingFlowState(),
      step: 2 as const,
      residency: 'rest-of-world' as const,
      occupation: actuary,
    }

    expect(onboardingFlowReducer(atStepTwo, { type: 'back' })).toMatchObject({
      step: 1,
      residency: 'rest-of-world',
      occupation: actuary,
    })
  })

  test('keeps the selected occupation when the search query changes', () => {
    const state = onboardingFlowReducer(
      {
        ...createOnboardingFlowState(),
        step: 2,
        occupation: actuary,
      },
      { type: 'occupationQueryChanged', value: 'account' },
    )

    expect(state).toMatchObject({ occupation: actuary, occupationQuery: 'account' })
  })

  test('requires an occupation selection before continuing from step 2', () => {
    expect(
      validateOnboardingStep({ ...createOnboardingFlowState(), step: 2 }),
    ).toEqual({ occupation: 'Select to continue' })
  })

  test('requires an occupation from the visible list before continuing from step 2', () => {
    expect(
      validateOnboardingStep({
        ...createOnboardingFlowState(),
        step: 2,
        occupation: { id: 0, name: 'Unlisted occupation' },
      }),
    ).toEqual({ occupation: 'Select to continue' })
  })

  test('clears an occupation warning when an occupation is selected', () => {
    const state = onboardingFlowReducer(
      {
        ...createOnboardingFlowState(),
        step: 2,
        errors: { occupation: 'Select to continue' },
      },
      { type: 'occupationSelected', value: accountant },
    )

    expect(state.errors.occupation).toBeUndefined()
  })

  test.each([
    [3, { yearlyIncome: 'Select to continue' }],
    [4, { monthlySpend: 'Select to continue' }],
    [5, { accountPurpose: 'Select to continue' }],
    [6, { agreementsAccepted: 'Select to continue' }],
  ] as const)('requires the current step %s selection', (step, expected) => {
    expect(validateOnboardingStep({ ...createOnboardingFlowState(), step })).toEqual(
      expected,
    )
  })

  test('clears each new step warning when its selection is made', () => {
    const cases = [
      {
        field: 'yearlyIncome',
        step: 3,
        event: { type: 'yearlyIncomeSelected', value: 'USD 25,000 – 50,000' },
      },
      {
        field: 'monthlySpend',
        step: 4,
        event: { type: 'monthlySpendSelected', value: 'USD 1,000 – 5,000' },
      },
      {
        field: 'accountPurpose',
        step: 5,
        event: { type: 'accountPurposeSelected', value: 'Investments' },
      },
      {
        field: 'agreementsAccepted',
        step: 6,
        event: { type: 'agreementsAccepted' },
      },
    ] as const

    for (const testCase of cases) {
      const state = onboardingFlowReducer(
        {
          ...createOnboardingFlowState(),
          step: testCase.step,
          errors: { [testCase.field]: 'Select to continue' },
        },
        testCase.event,
      )

      expect(state.errors[testCase.field]).toBeUndefined()
    }
  })

  test('advances sequentially from step 2 through step 6', () => {
    let state = createOnboardingFlowState()
    state = { ...state, step: 2 }

    for (const expectedStep of [3, 4, 5, 6] as const) {
      state = onboardingFlowReducer(state, { type: 'submissionSucceeded' })
      expect(state.step).toBe(expectedStep)
    }
  })

  test('marks the flow complete after a successful step 6 save', () => {
    const completed = onboardingFlowReducer(
      { ...createOnboardingFlowState(), step: 6, agreementsAccepted: true },
      { type: 'submissionSucceeded' },
    )

    expect(completed).toMatchObject({
      step: 6,
      completed: true,
      submission: 'idle',
    })
  })

  test('moves back one step without clearing selections', () => {
    const state = onboardingFlowReducer(
      {
        ...createOnboardingFlowState(),
        step: 5,
        yearlyIncome: 'USD 25,000 – 50,000',
        monthlySpend: 'USD 1,000 – 5,000',
        accountPurpose: 'Investments',
      },
      { type: 'back' },
    )

    expect(state).toMatchObject({
      step: 4,
      yearlyIncome: 'USD 25,000 – 50,000',
      monthlySpend: 'USD 1,000 – 5,000',
      accountPurpose: 'Investments',
    })
  })

  test('ignores draft changes and Back while a submission is pending', () => {
    const pending = {
      ...createOnboardingFlowState(),
      step: 2 as const,
      residency: 'united-states' as const,
      occupation: accountant,
      occupationQuery: 'account',
      submission: 'pending' as const,
    }
    const events = [
      { type: 'residencySelected', value: 'rest-of-world' },
      { type: 'occupationSelected', value: actuary },
      { type: 'occupationQueryChanged', value: 'actuary' },
      { type: 'yearlyIncomeSelected', value: 'USD 25,000 – 50,000' },
      { type: 'monthlySpendSelected', value: 'USD 1,000 – 5,000' },
      { type: 'accountPurposeSelected', value: 'Investments' },
      { type: 'agreementsAccepted' },
      { type: 'back' },
    ] satisfies readonly OnboardingFlowEvent[]

    for (const event of events) {
      expect(onboardingFlowReducer(pending, event)).toBe(pending)
    }
  })

  test('clears a step 2 gateway error when returning to step 1', () => {
    const failed = onboardingFlowReducer(
      {
        ...createOnboardingFlowState(),
        step: 2,
        residency: 'rest-of-world',
        occupation: actuary,
      },
      { type: 'submissionFailed', message: 'Unable to save occupation' },
    )

    expect(onboardingFlowReducer(failed, { type: 'back' })).toMatchObject({
      step: 1,
      residency: 'rest-of-world',
      occupation: actuary,
      gatewayError: null,
    })
  })

  test('keeps a duplicate submission start as the same pending state', () => {
    const pending = onboardingFlowReducer(createOnboardingFlowState(), {
      type: 'submissionStarted',
    })

    expect(onboardingFlowReducer(pending, { type: 'submissionStarted' })).toBe(pending)
  })
})
