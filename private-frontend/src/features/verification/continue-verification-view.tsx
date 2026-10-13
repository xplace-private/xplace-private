import { Button } from '../../shared/ui/button'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { FlowHeading } from '../../shared/ui/flow-heading'
import { Loader } from '../../shared/ui/loader'

interface ContinueVerificationViewProps {
  pending: boolean
  error: string | null
  onContinue(): void
  onSignOut(): void
}

/** Visual introduction to the identity-verification process. */
export function ContinueVerificationView({
  pending,
  error,
  onContinue,
  onSignOut,
}: ContinueVerificationViewProps) {
  const { t } = useAppTranslation()

  return (
    <section className="flex min-w-0 flex-col gap-8 px-4 py-10">
      <FlowHeading
        eyebrow={t('verification.continue.eyebrow')}
        title={t('verification.continue.title')}
        description={t('verification.continue.description')}
      />

      <div className="flex min-w-0 flex-col gap-4">
        {error !== null && (
          <p className="text-xs leading-5 font-light text-destructive" role="alert">
            {t('common.errors.unexpected')}
          </p>
        )}
        <Button
          className="relative w-full disabled:opacity-100"
          variant="default"
          size="lg"
          textStyle="strong"
          disabled={pending}
          aria-busy={pending || undefined}
          aria-label={pending ? t('verification.preparing') : undefined}
          onClick={onContinue}
        >
          <span className={pending ? 'invisible' : undefined}>
            {t('verification.continue.action')}
          </span>
          {pending && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader decorative />
            </span>
          )}
        </Button>
        <Button
          className="w-full"
          variant="outline"
          size="lg"
          textStyle="regular"
          onClick={onSignOut}
        >
          {t('common.actions.signOut')}
        </Button>
      </div>
    </section>
  )
}
