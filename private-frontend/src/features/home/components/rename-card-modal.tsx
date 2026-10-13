import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Loader } from '../../../shared/ui/loader'
import { ModalActions } from '../../../shared/ui/modal-actions'
import { ModalFieldError } from '../../../shared/ui/modal-field'
import { ModalShell } from '../../../shared/ui/modal-shell'

interface RenameCardModalProps {
  name: string
  status: 'editing' | 'saving'
  error?: string | undefined
  onNameChange: (name: string) => void
  onCancel: () => void
  onSave: () => void
}

/** Renames the selected card while preserving the physical cardholder name. */
export function RenameCardModal({
  name,
  status,
  error,
  onNameChange,
  onCancel,
  onSave,
}: RenameCardModalProps) {
  const { t } = useAppTranslation()
  const saving = status === 'saving'
  const nameError = error ?? null

  return (
    <ModalShell
      ariaLabel={t('home.renameCard.title')}
      closeDisabled={saving}
      onClose={onCancel}
      panelClassName="flex flex-col gap-6 p-6"
    >
      <header className="flex min-w-0 flex-col gap-2">
        <h2 className="text-base leading-none font-bold tracking-[-0.2px]">
          {t('home.renameCard.title')}
        </h2>
        <p className="text-xs leading-[19.2px] font-light text-secondary">
          {t('home.renameCard.description')}
        </p>
      </header>

      <label className="min-w-0 py-4" htmlFor="rename-card-name">
        <span className="sr-only">{t('home.newCard.name')}</span>
        <input
          id="rename-card-name"
          className={`w-full min-w-0 border-0 border-b bg-transparent px-0 pt-1 pb-[14px] text-2xl leading-none font-light text-foreground shadow-xs outline-none disabled:opacity-100 ${nameError ? 'border-destructive' : 'border-border'}`}
          aria-label={t('home.newCard.name')}
          aria-describedby={nameError ? 'rename-card-name-error' : undefined}
          aria-invalid={nameError ? true : undefined}
          value={name}
          disabled={saving}
          maxLength={40}
          onChange={(event) => onNameChange(event.target.value)}
        />
        {nameError ? <ModalFieldError id="rename-card-name-error" message={nameError} /> : null}
      </label>

      <ModalActions
        cancelDisabled={saving}
        saveDisabled={saving}
        saveContent={
          saving ? (
            <Loader label={t('home.renameCard.renaming')} />
          ) : (
            t('common.actions.save')
          )
        }
        onCancel={onCancel}
        onSave={onSave}
      />
    </ModalShell>
  )
}
