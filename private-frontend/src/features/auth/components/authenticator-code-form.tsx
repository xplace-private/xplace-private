import { useId, useRef, useState } from 'react'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { cn } from '../../../shared/cn'
import { Button } from '../../../shared/ui/button'
import { AuthSubmitButton } from './auth-submit-button'

interface AuthenticatorCodeFormProps {
  error: string | null
  codeError: boolean
  pending: boolean
  confirming: boolean
  onSubmit(code: string): Promise<void>
  onEdit(): void
}

export function AuthenticatorCodeForm({ error, codeError, pending, confirming, onSubmit, onEdit }: AuthenticatorCodeFormProps) {
  const { t } = useAppTranslation()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const fieldError = localError ?? (codeError ? error : null)

  async function pasteCode() {
    try {
      const pasted = (await navigator.clipboard.readText()).replace(/\s/g, '')
      if (!/^[0-9]{6}$/.test(pasted)) {
        setLocalError(t('auth.authenticator.incorrectCode'))
      } else {
        setCode(pasted)
        setLocalError(null)
        onEdit()
      }
    } catch {
      setLocalError(t('auth.authenticator.pasteError'))
    }
    input.current?.focus()
  }

  return (
    <form className="flex min-w-0 flex-col gap-8" aria-busy={pending} noValidate onSubmit={(event) => {
      event.preventDefault()
      if (pending) return
      if (!/^[0-9]{6}$/.test(code)) {
        setLocalError(t('auth.authenticator.incorrectCode'))
        input.current?.focus()
        return
      }
      setLocalError(null)
      void onSubmit(code)
    }}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-col font-sans">
            <label htmlFor={id} className="text-xs leading-5 font-light tracking-[1.6px] text-muted-foreground uppercase">{t('auth.code.label')}</label>
            <input ref={input} id={id} name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} disabled={pending}
              aria-invalid={fieldError !== null} aria-describedby={fieldError ? `${id}-error` : undefined}
              className={cn('h-12 w-[320px] min-w-0 max-w-full rounded-none border-0 border-b bg-transparent py-1 text-2xl leading-9 font-light tracking-[8px] caret-primary outline-none disabled:opacity-100', fieldError ? 'border-destructive text-destructive placeholder:text-destructive focus:border-destructive' : 'border-border text-foreground placeholder:text-secondary focus:border-accent')}
              onChange={(event) => { setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setLocalError(null); onEdit() }}
            />
          </div>
          {fieldError ? <p id={`${id}-error`} role="alert" className="text-xs leading-5 tracking-[0.4px] text-destructive">{fieldError}</p> : null}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" textStyle="body" disabled={pending} onClick={() => void pasteCode()}>{t('auth.authenticator.paste')}</Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <AuthSubmitButton pending={pending} label={confirming ? t('auth.authenticator.verify') : t('common.actions.continue')} loadingLabel={t('auth.code.verifying')} />
        {error && !codeError ? <p role="alert" className="text-xs leading-5 tracking-[0.4px] text-destructive">{error}</p> : null}
      </div>
    </form>
  )
}
