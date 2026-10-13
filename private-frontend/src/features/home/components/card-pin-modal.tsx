import { useLayoutEffect, useRef } from 'react'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Loader } from '../../../shared/ui/loader'
import { ModalActions } from '../../../shared/ui/modal-actions'
import { ModalFieldError } from '../../../shared/ui/modal-field'
import { ModalShell } from '../../../shared/ui/modal-shell'
import {
  shouldKeepPinInputFocused,
  shouldRestorePinInputFocus,
} from '../card-pin-interactions'
import type { CardPinFlowState } from '../model/card-collection'

const PIN_ERROR_KEYS = {
  'PIN must be 4 digits': 'home.pin.errors.fourDigits',
  'PIN cannot contain repeated numbers': 'home.pin.errors.repeated',
  'PIN cannot be a simple sequence': 'home.pin.errors.sequence',
  'Cannot have more than 2 consecutive identical digits':
    'home.pin.errors.consecutive',
  'PIN pattern is too weak': 'home.pin.errors.weak',
  'PIN cannot have alternating pattern': 'home.pin.errors.alternating',
} as const

interface CardPinModalProps {
  cardName: string
  hasPin: boolean
  state: Exclude<CardPinFlowState, { status: 'closed' }>
  onPinChange: (pin: string) => void
  onBack: () => void
  onCancel: () => void
  onSave: () => void
}

/** Two-step PIN form; the PIN exists only while this dialog is open. */
export function CardPinModal({
  cardName,
  hasPin,
  state,
  onPinChange,
  onBack,
  onCancel,
  onSave,
}: CardPinModalProps) {
  const { t } = useAppTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const saving = state.status === 'saving'
  const confirming = state.status !== 'entering'
  const value =
    state.status === 'entering'
      ? state.pin
      : state.status === 'confirming'
        ? state.confirmation
        : state.pin
  const title = confirming
    ? t('home.pin.confirmTitle')
    : hasPin
      ? t('home.pin.changeTitle')
      : t('home.pin.setTitle')
  const description = confirming
    ? t('home.pin.confirmDescription')
    : t('home.pin.chooseDescription', { card: cardName })
  const error = state.status === 'saving' ? null : state.error
  const previousFocusStateRef = useRef({ status: state.status, error })
  const errorMessage =
    typeof error === 'object' && error !== null
      ? pinRequestErrorMessage(error.message, t)
      : error === 'required'
        ? t('common.errors.required')
        : error === 'incomplete'
          ? t('home.pin.incomplete')
          : error === 'mismatch'
            ? t('home.pin.mismatch')
            : error === null
              ? null
              : t(`home.pin.errors.${error}`)
  useLayoutEffect(() => {
    const currentFocusState = { status: state.status, error }
    const restoreInputFocus = shouldRestorePinInputFocus(
      previousFocusStateRef.current,
      currentFocusState,
    )
    previousFocusStateRef.current = currentFocusState
    if (!restoreInputFocus) return
    inputRef.current?.focus({ preventScroll: true })
  }, [error, state.status])

  return (
    <ModalShell
      ariaLabel={title}
      closeDisabled={saving}
      onClose={onCancel}
      panelClassName="flex flex-col gap-6 p-6"
    >
      <header className="flex min-w-0 flex-col gap-2">
        <h2 className="text-base leading-none font-bold tracking-[-0.2px]">{title}</h2>
        <p className="text-xs leading-[19.2px] font-light text-secondary">{description}</p>
      </header>

      <label className="min-w-0 py-4" htmlFor="card-pin-input">
        <span className="sr-only">
          {confirming ? t('home.pin.confirmTitle') : t('home.pin.label')}
        </span>
        <input
          ref={inputRef}
          id="card-pin-input"
          className={`w-full min-w-0 border-0 border-b bg-transparent px-0 pt-1 pb-[14px] text-2xl leading-none font-light tracking-[0.5em] text-foreground shadow-xs outline-none placeholder:tracking-normal placeholder:text-secondary ${errorMessage ? 'border-destructive' : 'border-border focus:border-accent'}`}
          aria-label={confirming ? t('home.pin.confirmTitle') : t('home.pin.label')}
          aria-describedby={errorMessage ? 'card-pin-error' : undefined}
          aria-invalid={errorMessage ? true : undefined}
          autoComplete="new-password"
          disabled={saving}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0 0 0 0"
          required
          type="password"
          value={value}
          onChange={(event) => onPinChange(event.target.value)}
        />
        {errorMessage ? <ModalFieldError id="card-pin-error" message={errorMessage} /> : null}
      </label>

      <ModalActions
        cancelContent={
          t(confirming ? 'common.actions.back' : 'common.actions.cancel')
        }
        cancelDisabled={saving}
        preventSaveFocus={shouldKeepPinInputFocused(state)}
        saveDisabled={saving}
        saveContent={
          saving ? <Loader label={t('home.pin.saving')} /> : t('common.actions.save')
        }
        onCancel={confirming ? onBack : onCancel}
        onSave={onSave}
      />
    </ModalShell>
  )
}

function pinRequestErrorMessage(
  rawMessage: string,
  t: ReturnType<typeof useAppTranslation>['t'],
): string {
  const message = rawMessage.trim()
  if (message === '' || message === 'Unable to update PIN. Try again.') {
    return t('home.cards.errors.pin')
  }

  const key = PIN_ERROR_KEYS[message as keyof typeof PIN_ERROR_KEYS]
  return key === undefined ? message : t(key)
}
