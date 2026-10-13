import {
  ACCOUNT_PURPOSES,
  MONTHLY_SPENDS,
  YEARLY_INCOMES,
} from './model/onboarding-flow'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { AgreementsStep } from './components/agreements-step'
import { OccupationStep } from './components/occupation-step'
import { OnboardingSelectionStep } from './components/onboarding-selection-step'
import { useOnboardingFlow } from './onboarding-flow-provider'

interface OnboardingScreenProps {
  onBackToAuth(): void
  onCompleted(): boolean | void | Promise<boolean | void>
}

/** Selects and renders the active onboarding step. */
export function OnboardingScreen({ onBackToAuth, onCompleted }: OnboardingScreenProps) {
  const { t } = useAppTranslation()
  const {
    state,
    setResidency,
    setYearlyIncome,
    setMonthlySpend,
    setAccountPurpose,
    continueStep,
    back,
  } = useOnboardingFlow()
  const pending = state.submission === 'pending'
  const onContinue = () => void continueStep()
  const errorFor = (hasFieldError: boolean) =>
    hasFieldError
      ? t('common.errors.selectToContinue')
      : state.gatewayError !== null
        ? t('common.errors.unexpected')
        : null
  const residencyOptions = [
    { value: 'united-states', label: t('onboarding.residency.us') },
    { value: 'rest-of-world', label: t('onboarding.residency.world') },
  ] as const
  const yearlyIncomeOptions = [
    { value: YEARLY_INCOMES[0], label: t('onboarding.income.under25') },
    { value: YEARLY_INCOMES[1], label: t('onboarding.income.from25To50') },
    { value: YEARLY_INCOMES[2], label: t('onboarding.income.from50To100') },
    { value: YEARLY_INCOMES[3], label: t('onboarding.income.from100To180') },
    { value: YEARLY_INCOMES[4], label: t('onboarding.income.over180') },
  ]
  const monthlySpendOptions = [
    { value: MONTHLY_SPENDS[0], label: t('onboarding.spend.under1') },
    { value: MONTHLY_SPENDS[1], label: t('onboarding.spend.from1To5') },
    { value: MONTHLY_SPENDS[2], label: t('onboarding.spend.from5To25') },
    { value: MONTHLY_SPENDS[3], label: t('onboarding.spend.from25To50') },
    { value: MONTHLY_SPENDS[4], label: t('onboarding.spend.over50') },
  ]
  const accountPurposeOptions = [
    { value: ACCOUNT_PURPOSES[0], label: t('onboarding.purpose.personal') },
    { value: ACCOUNT_PURPOSES[1], label: t('onboarding.purpose.business') },
    { value: ACCOUNT_PURPOSES[2], label: t('onboarding.purpose.investments') },
    { value: ACCOUNT_PURPOSES[3], label: t('onboarding.purpose.other') },
  ]

  switch (state.step) {
    case 1:
      return (
        <OnboardingSelectionStep
          eyebrow={t('onboarding.stepEyebrow', { step: 1 })}
          title={t('onboarding.residency.title')}
          description={t('onboarding.residency.description')}
          ariaLabel={t('onboarding.residency.label')}
          options={residencyOptions}
          selectedValue={state.residency}
          error={errorFor(state.errors.residency !== undefined)}
          pending={pending}
          onSelect={setResidency}
          onContinue={onContinue}
          onBack={onBackToAuth}
        />
      )
    case 2:
      return <OccupationStep />
    case 3:
      return (
        <OnboardingSelectionStep
          eyebrow={t('onboarding.stepEyebrow', { step: 3 })}
          title={t('onboarding.income.title')}
          description={t('onboarding.income.description')}
          ariaLabel={t('onboarding.income.label')}
          options={yearlyIncomeOptions}
          selectedValue={state.yearlyIncome}
          error={errorFor(state.errors.yearlyIncome !== undefined)}
          pending={pending}
          onSelect={setYearlyIncome}
          onContinue={onContinue}
          onBack={back}
        />
      )
    case 4:
      return (
        <OnboardingSelectionStep
          eyebrow={t('onboarding.stepEyebrow', { step: 4 })}
          title={t('onboarding.spend.title')}
          description={t('onboarding.spend.description')}
          ariaLabel={t('onboarding.spend.label')}
          options={monthlySpendOptions}
          selectedValue={state.monthlySpend}
          error={errorFor(state.errors.monthlySpend !== undefined)}
          pending={pending}
          onSelect={setMonthlySpend}
          onContinue={onContinue}
          onBack={back}
        />
      )
    case 5:
      return (
        <OnboardingSelectionStep
          eyebrow={t('onboarding.stepEyebrow', { step: 5 })}
          title={t('onboarding.purpose.title')}
          ariaLabel={t('onboarding.purpose.label')}
          options={accountPurposeOptions}
          selectedValue={state.accountPurpose}
          error={errorFor(state.errors.accountPurpose !== undefined)}
          pending={pending}
          onSelect={setAccountPurpose}
          onContinue={onContinue}
          onBack={back}
        />
      )
    case 6:
      return <AgreementsStep onCompleted={onCompleted} />
  }
}
