import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { InfoBanner } from '../../../shared/ui/info-banner'
import { Loader } from '../../../shared/ui/loader'
import { ModalActions } from '../../../shared/ui/modal-actions'
import { ModalFieldError } from '../../../shared/ui/modal-field'
import { ModalShell } from '../../../shared/ui/modal-shell'
import type { CardKind } from '../model/card-collection'

interface NewCardModalProps {
  name: string
  cardType: CardKind
  status: 'editing' | 'issuing' | 'loading'
  validationAttempted: boolean
  requestError?: string | undefined
  onTypeChange: (cardType: CardKind) => void
  onNameChange: (name: string) => void
  onCancel: () => void
  onSave: () => void
}

/** Card issuance dialog matching the editable and loading Figma states. */
export function NewCardModal({
  name,
  cardType,
  status,
  validationAttempted,
  requestError,
  onTypeChange,
  onNameChange,
  onCancel,
  onSave,
}: NewCardModalProps) {
  const { t } = useAppTranslation()
  const busy = status !== 'editing'
  const nameError =
    validationAttempted && !name.trim() ? t('common.errors.required') : null

  return (
    <ModalShell
      ariaLabel={t('home.newCard.title')}
      closeDisabled={busy}
      onClose={onCancel}
      panelClassName="flex flex-col gap-6 p-6"
    >
      <header className="flex min-w-0 flex-col gap-2">
        <h2 className="text-base leading-none font-bold tracking-[-0.2px]">
          {t('home.newCard.title')}
        </h2>
        <p className="text-xs leading-[19.2px] font-light text-secondary">
          {t('home.newCard.description')}
        </p>
      </header>

      <div className="flex min-w-0 gap-2">
        <Button
          className={cardType === 'Virtual'
            ? 'flex-1 shadow-none disabled:opacity-100'
            : 'flex-1 text-secondary shadow-none disabled:opacity-100'}
          variant={cardType === 'Virtual' ? 'default' : 'outline'}
          size="chip"
          aria-pressed={cardType === 'Virtual'}
          disabled={busy}
          onClick={() => onTypeChange('Virtual')}
        >
          {t('home.cards.kind.virtual')}
        </Button>
        <Button
          className={cardType === 'Physical'
            ? 'flex-1 shadow-none disabled:opacity-100'
            : 'flex-1 text-secondary shadow-none disabled:opacity-100'}
          variant={cardType === 'Physical' ? 'default' : 'outline'}
          size="chip"
          aria-pressed={cardType === 'Physical'}
          disabled={busy}
          onClick={() => onTypeChange('Physical')}
        >
          {t('home.cards.kind.physical')}
        </Button>
      </div>

      <label className="min-w-0 py-4" htmlFor="new-card-name">
        <span className="sr-only">{t('home.newCard.name')}</span>
        <input
          id="new-card-name"
          className={`w-full min-w-0 border-0 border-b bg-transparent px-0 pt-1 pb-[14px] text-2xl leading-none font-light shadow-xs outline-none transition-colors disabled:opacity-100 ${nameError ? 'border-destructive text-foreground' : busy ? 'border-accent text-foreground' : 'border-border text-secondary focus:border-accent focus:text-foreground'}`}
          aria-label={t('home.newCard.name')}
          aria-describedby={nameError ? 'new-card-name-error' : undefined}
          aria-invalid={nameError ? true : undefined}
          value={name}
          maxLength={40}
          disabled={busy}
          required
          onChange={(event) => onNameChange(event.target.value)}
        />
        {nameError ? <ModalFieldError id="new-card-name-error" message={nameError} /> : null}
      </label>

      {requestError ? (
        <InfoBanner variant="warning">{t('home.cards.errors.issue')}</InfoBanner>
      ) : null}

      <ModalActions
        cancelDisabled={busy}
        preventSaveFocus={!name.trim()}
        saveDisabled={busy}
        saveContent={
          busy ? (
            <Loader label={status === 'loading' ? t('common.loading') : t('home.newCard.issuing')} tone="light" />
          ) : (
            t('common.actions.save')
          )
        }
        onCancel={onCancel}
        onSave={onSave}
        {...(busy ? { saveClassName: 'opacity-90 disabled:opacity-90' } : {})}
        saveVariant={busy ? 'outline' : 'default'}
      />
    </ModalShell>
  )
}
