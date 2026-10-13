import type { ReactNode } from 'react'

import { cn } from '../cn'
import { useAppTranslation } from '../i18n/app-i18n'
import { Button, type ButtonProps } from './button'

interface ModalActionsProps {
  cancelContent?: ReactNode
  cancelDisabled?: boolean
  saveDisabled?: boolean
  saveContent?: ReactNode
  saveClassName?: string
  saveTextStyle?: ButtonProps['textStyle']
  saveVariant?: ButtonProps['variant']
  preventSaveFocus?: boolean
  onCancel: () => void
  onSave: () => void
}

/** Shared two-button action row for modal forms. */
export function ModalActions({
  cancelContent,
  cancelDisabled = false,
  saveDisabled = false,
  saveContent,
  saveClassName,
  saveTextStyle = 'regular',
  saveVariant = 'default',
  preventSaveFocus = false,
  onCancel,
  onSave,
}: ModalActionsProps) {
  const { t } = useAppTranslation()

  return (
    <div className="flex min-w-0 gap-2">
      <Button
        className="flex-1 disabled:opacity-100"
        variant="outline"
        textStyle="regular"
        disabled={cancelDisabled}
        onClick={onCancel}
      >
        {cancelContent ?? t('common.actions.cancel')}
      </Button>
      <Button
        className={cn('flex-1 disabled:opacity-100', saveClassName)}
        variant={saveVariant}
        textStyle={saveTextStyle}
        disabled={saveDisabled}
        onPointerDown={preventSaveFocus ? (event) => event.preventDefault() : undefined}
        onClick={onSave}
      >
        {saveContent ?? t('common.actions.save')}
      </Button>
    </div>
  )
}
