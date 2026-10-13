import type { FormEvent, ReactNode } from 'react'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { FlowHeading } from '../../../shared/ui/flow-heading'
import { Loader } from '../../../shared/ui/loader'

interface OnboardingStepLayoutProps {
  eyebrow: string
  title: string
  description?: ReactNode
  error: string | null | undefined
  errorClassName?: string | undefined
  pending: boolean
  continueDisabled?: boolean
  backDisabled?: boolean
  children: ReactNode
  onContinue(): void
  onBack(): void
}

/** Shared heading-to-actions structure and spacing for every onboarding step. */
export function OnboardingStepLayout({
  eyebrow,
  title,
  description,
  error,
  errorClassName = 'text-destructive',
  pending,
  continueDisabled = false,
  backDisabled = false,
  children,
  onContinue,
  onBack,
}: OnboardingStepLayoutProps) {
  const { t } = useAppTranslation()
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onContinue()
  }

  return (
    <section className="flex min-w-0 flex-col gap-8 px-4 py-10">
      <FlowHeading eyebrow={eyebrow} title={title} description={description} />

      <form className="flex min-w-0 flex-col gap-8" onSubmit={handleSubmit}>
        <div className="flex min-w-0 flex-col gap-2">
          {children}

          {error && (
            <p
              className={`text-xs leading-5 font-light ${errorClassName}`}
              id="onboarding-step-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col items-start gap-4">
          <Button
            className="relative w-full disabled:opacity-100"
            variant="default"
            size="lg"
            textStyle="strong"
            type="submit"
            disabled={pending || continueDisabled}
            aria-busy={pending || undefined}
            aria-label={pending ? t('onboarding.continuing') : undefined}
          >
            <span className={pending ? 'invisible' : undefined}>
              {t('common.actions.continue')}
            </span>
            {pending && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader decorative />
              </span>
            )}
          </Button>
          <Button
            className="disabled:opacity-100"
            variant="outline"
            size="sm"
            textStyle="body"
            disabled={pending || backDisabled}
            onClick={onBack}
          >
            {t('common.actions.back')}
          </Button>
        </div>
      </form>
    </section>
  )
}
