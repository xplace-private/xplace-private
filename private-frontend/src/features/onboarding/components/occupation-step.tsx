import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { useOnboardingFlow } from '../onboarding-flow-provider'
import { OnboardingStepLayout } from './onboarding-step-layout'
import { OptionButton } from './option-button'
import { OptionList } from './option-list'

/** Second onboarding step for searching and selecting an occupation. */
export function OccupationStep() {
  const { t } = useAppTranslation()
  const {
    state,
    occupations,
    occupationLoadStatus,
    setOccupation,
    setOccupationQuery,
    continueStep,
    retryOccupations,
    back,
  } = useOnboardingFlow()
  const error =
    state.errors.occupation !== undefined
      ? t('common.errors.selectToContinue')
      : state.gatewayError !== null
        ? t('common.errors.unexpected')
        : null
  const hasError = error !== undefined && error !== null

  return (
    <OnboardingStepLayout
      eyebrow={t('onboarding.stepEyebrow', { step: 2 })}
      title={t('onboarding.occupation.title')}
      description={t('onboarding.occupation.description')}
      error={error}
      errorClassName={state.errors.occupation !== undefined ? 'text-secondary' : undefined}
      pending={state.submission === 'pending'}
      onContinue={() => void continueStep()}
      onBack={back}
    >
      <label className="sr-only" htmlFor="occupation-search">
        {t('onboarding.occupation.search')}
      </label>
      <input
        className="min-w-0 border-b border-border bg-transparent py-[9.5px] font-sans text-lg leading-7 font-light text-foreground caret-accent outline-none placeholder:text-secondary focus:border-accent focus:text-accent disabled:opacity-100"
        id="occupation-search"
        name="occupation-search"
        type="search"
        autoComplete="off"
        placeholder={t('onboarding.occupation.search')}
        value={state.occupationQuery}
        disabled={state.submission === 'pending'}
        onChange={(event) => setOccupationQuery(event.target.value)}
      />

      {occupationLoadStatus === 'loading' ? (
        <div role="status">
          <span className="sr-only">{t('onboarding.occupation.loading')}</span>
          <OptionList aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-[48px]" key={index} />
            ))}
          </OptionList>
        </div>
      ) : occupationLoadStatus === 'error' ? (
        <div className="flex min-w-0 flex-col items-start gap-3" role="alert">
          <p className="text-xs leading-5 font-light text-destructive">
            {t('onboarding.occupation.loadError')}
          </p>
          <Button
            variant="outline"
            size="default"
            onClick={retryOccupations}
          >
            {t('common.actions.retry')}
          </Button>
        </div>
      ) : occupationLoadStatus === 'empty' ? (
        <p className="py-4 text-sm font-light text-secondary">
          {t('onboarding.occupation.empty')}
        </p>
      ) : (
        <OptionList
          role="radiogroup"
          aria-label={t('onboarding.occupation.label')}
          aria-invalid={hasError}
          aria-describedby={hasError ? 'onboarding-step-error' : undefined}
        >
          {occupations.map((occupation) => (
            <OptionButton
              key={occupation.id}
              selected={state.occupation?.id === occupation.id}
              warning={hasError}
              disabled={state.submission === 'pending'}
              onClick={() => setOccupation(occupation)}
            >
              {occupation.name}
            </OptionButton>
          ))}
        </OptionList>
      )}
    </OnboardingStepLayout>
  )
}
