import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { ModalActions } from '../../../shared/ui/modal-actions'
import { ModalField } from '../../../shared/ui/modal-field'
import { ModalShell } from '../../../shared/ui/modal-shell'
import { Loader } from '../../../shared/ui/loader'
import { isCardActivationValid, isCardExpiryValid } from '../model/card-collection'

interface CardActivationModalProps {
  loading?: boolean
  error?: string | null
  expiry: string
  lastFour: string
  validationAttempted: boolean
  onCancel: () => void
  onExpiryChange: (value: string) => void
  onLastFourChange: (value: string) => void
  onSubmit: () => void
}

/** Printed-card verification step used before the physical-card PIN flow. */
export function CardActivationModal({
  loading = false,
  error,
  expiry,
  lastFour,
  validationAttempted,
  onCancel,
  onExpiryChange,
  onLastFourChange,
  onSubmit,
}: CardActivationModalProps) {
  const { t } = useAppTranslation()
  const lastFourError = !validationAttempted
    ? undefined
    : !lastFour
      ? t('common.errors.required')
      : lastFour.length !== 4
        ? t('home.activation.fourDigits')
        : undefined
  const expiryError = !validationAttempted
    ? undefined
    : !expiry
      ? t('common.errors.required')
      : !isCardExpiryValid(expiry)
        ? t('home.activation.validExpiry')
        : undefined
  const complete = isCardActivationValid(lastFour, expiry)

  return (
    <ModalShell
      ariaLabel={t('home.activation.title')}
      closeDisabled={loading}
      onClose={onCancel}
      panelClassName="flex flex-col gap-6 p-6"
    >
      <header className="flex min-w-0 flex-col gap-2">
        <h2 className="text-base leading-none font-bold tracking-[-0.2px]">
          {t('home.activation.title')}
        </h2>
        <p className="text-xs leading-[19.2px] font-light text-secondary">
          {t('home.activation.description')}
        </p>
      </header>

      <div className="flex min-w-0 flex-col gap-6">
        <ModalField
          label={t('home.activation.lastFour')}
          aria-label={t('home.activation.lastFour')}
          autoComplete="cc-number"
          disabled={loading}
          error={lastFourError}
          inputClassName="!text-xl"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0000"
          required
          value={lastFour}
          onChange={(event) => onLastFourChange(event.target.value)}
        />
        <ModalField
          label={t('home.activation.expiry')}
          aria-label={t('home.activation.expiry')}
          autoComplete="cc-exp"
          disabled={loading}
          error={expiryError}
          inputClassName="!text-xl"
          inputMode="numeric"
          placeholder="MM/YY"
          required
          value={expiry}
          onChange={(event) => onExpiryChange(event.target.value)}
        />
      </div>

      {error ? <p role="alert" className="text-xs leading-5 text-destructive">{t(error)}</p> : null}
      <ModalActions
        cancelDisabled={loading}
        saveDisabled={loading}
        preventSaveFocus={!complete}
        saveContent={loading ? <Loader label={t('common.loading')} /> : t('home.cards.activate')}
        onCancel={onCancel}
        onSave={onSubmit}
      />
    </ModalShell>
  )
}
