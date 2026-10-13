import type { ReactNode } from 'react'

import { OnboardingStepLayout } from './onboarding-step-layout'
import { OptionButton } from './option-button'
import { OptionList } from './option-list'

interface SelectionOption<T extends string> {
  value: T
  label: ReactNode
}

interface OnboardingSelectionStepProps<T extends string> {
  eyebrow: string
  title: string
  description?: ReactNode
  ariaLabel: string
  options: readonly SelectionOption<T>[]
  selectedValue: T | null
  error: string | null | undefined
  pending: boolean
  onSelect(value: T): void
  onContinue(): void
  onBack(): void
}

/** Data-driven single-choice onboarding screen using the shared step rhythm. */
export function OnboardingSelectionStep<T extends string>({
  eyebrow,
  title,
  description,
  ariaLabel,
  options,
  selectedValue,
  error,
  pending,
  onSelect,
  onContinue,
  onBack,
}: OnboardingSelectionStepProps<T>) {
  const hasError = error !== undefined && error !== null

  return (
    <OnboardingStepLayout
      eyebrow={eyebrow}
      title={title}
      description={description}
      error={error}
      pending={pending}
      onContinue={onContinue}
      onBack={onBack}
    >
      <OptionList
        role="radiogroup"
        aria-label={ariaLabel}
        aria-invalid={hasError}
        aria-describedby={hasError ? 'onboarding-step-error' : undefined}
      >
        {options.map((option) => (
          <OptionButton
            key={option.value}
            selected={selectedValue === option.value}
            warning={hasError}
            disabled={pending}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </OptionButton>
        ))}
      </OptionList>
    </OnboardingStepLayout>
  )
}
