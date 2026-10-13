import { Button } from '../../../shared/ui/button'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Loader } from '../../../shared/ui/loader'

interface AuthSubmitButtonProps {
  disabled?: boolean
  label?: string
  loadingLabel: string
  pending: boolean
}

/** Auth submit action with a stable-size pending indicator. */
export function AuthSubmitButton({
  loadingLabel,
  pending,
  disabled = pending,
  label,
}: AuthSubmitButtonProps) {
  const { t } = useAppTranslation()

  return (
    <Button
      className="relative w-full disabled:opacity-100"
      variant="default"
      size="lg"
      textStyle="strong"
      type="submit"
      disabled={disabled}
      aria-busy={pending || undefined}
      aria-label={pending ? loadingLabel : undefined}
      onPointerDown={(event) => event.preventDefault()}
    >
      <span className={pending ? 'invisible' : undefined}>
        {label ?? t('common.actions.continue')}
      </span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader decorative />
        </span>
      )}
    </Button>
  )
}
