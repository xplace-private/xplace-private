import { useState } from 'react'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { completeOnboarding } from '../complete-onboarding'
import { useOnboardingFlow } from '../onboarding-flow-provider'
import { AgreementDisclosure } from './agreement-disclosure'
import { OnboardingStepLayout } from './onboarding-step-layout'
import { OptionButton } from './option-button'
import { OptionList } from './option-list'

interface AgreementsStepProps {
  onCompleted(): boolean | void | Promise<boolean | void>
}

/** Final onboarding step for reviewing and accepting the required agreements. */
export function AgreementsStep({ onCompleted }: AgreementsStepProps) {
  const { t } = useAppTranslation()
  const {
    state,
    agreements,
    agreementLoadStatus,
    acceptAgreements,
    continueStep,
    retryAgreements,
    back,
  } = useOnboardingFlow()
  const [openAgreement, setOpenAgreement] = useState<string | null>(null)
  const [completionPending, setCompletionPending] = useState(false)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const error =
    state.errors.agreementsAccepted !== undefined
      ? t('common.errors.selectToContinue')
      : state.gatewayError !== null || completionError !== null
        ? t('common.errors.unexpected')
        : null
  const hasError = error !== undefined && error !== null
  const pending = state.submission === 'pending' || completionPending
  const agreementsReady = agreementLoadStatus === 'success'

  const handleContinue = async () => {
    if (pending || !agreementsReady) return

    setCompletionPending(true)
    setCompletionError(null)
    const result = await completeOnboarding(
      continueStep,
      onCompleted,
      state.completed,
    )
    if (result === 'completion-failed') {
      setCompletionError('Something went wrong. Please try again.')
    }
    if (result === 'completed') return

    setCompletionPending(false)
  }

  const toggleAgreement = (agreement: string) => {
    setOpenAgreement((current) => (current === agreement ? null : agreement))
  }

  return (
    <OnboardingStepLayout
      eyebrow={t('onboarding.stepEyebrow', { step: 6 })}
      title={t('onboarding.agreements.title')}
      description={t('onboarding.agreements.description')}
      error={error}
      pending={pending}
      continueDisabled={!agreementsReady}
      backDisabled={state.completed}
      onContinue={() => void handleContinue()}
      onBack={back}
    >
      {agreementLoadStatus === 'loading' ? (
        <div className="flex min-w-0 flex-col gap-2.5" role="status">
          <span className="sr-only">Loading agreements</span>
          <Skeleton className="h-[51px]" />
          <Skeleton className="h-[51px]" />
          <Skeleton className="h-[51px]" />
        </div>
      ) : agreementLoadStatus === 'success' ? (
        <>
          {agreements.map((agreement) => (
            <AgreementDisclosure
              id={agreement.agreementType}
              key={agreement.agreementType}
              title={agreement.agreementName}
              expanded={openAgreement === agreement.agreementType}
              onToggle={() => toggleAgreement(agreement.agreementType)}
            >
              <p>{agreement.agreementType}</p>
            </AgreementDisclosure>
          ))}

          <OptionList
            role="radiogroup"
            aria-label={t('onboarding.agreements.label')}
            aria-invalid={hasError}
            aria-describedby={hasError ? 'onboarding-step-error' : undefined}
          >
            <OptionButton
              selected={state.agreementsAccepted}
              warning={hasError}
              disabled={pending || state.completed}
              onClick={acceptAgreements}
            >
              {t('onboarding.agreements.accept')}
            </OptionButton>
          </OptionList>
        </>
      ) : agreementLoadStatus === 'error' || agreementLoadStatus === 'empty' ? (
        <div className="flex min-w-0 flex-col items-start gap-3" role="alert">
          <p className="text-xs leading-5 font-light text-destructive">
            {t('common.errors.unexpected')}
          </p>
          <Button variant="outline" size="default" onClick={retryAgreements}>
            {t('common.actions.retry')}
          </Button>
        </div>
      ) : null}
    </OnboardingStepLayout>
  )
}
