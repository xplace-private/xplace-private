import { useId, useState } from 'react'

import { cn } from '../../shared/cn'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import type { AuthGateway } from './api/auth-gateway'
import { AuthenticatorSetupControls } from './authenticator-setup'
import { AuthSubmitButton } from './auth-submit-button'
import type { useAuthAction } from './use-auth-action'
import type { useAuthenticatorSetup } from './use-authenticator-setup'

interface AuthenticatorFormProps {
  gateway: AuthGateway
  action: ReturnType<typeof useAuthAction>
  setup: ReturnType<typeof useAuthenticatorSetup> | null
}

export function AuthenticatorForm({ gateway, action, setup }: AuthenticatorFormProps) {
  const { t } = useAppTranslation()
  const { pending, error, errorCode, run, clearError } = action
  const id = useId()
  const [code, setCode] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionKind, setActionKind] = useState<'verify' | 'logout'>('verify')
  const codeError = actionKind === 'verify' && (errorCode === 'incorrectCode' || errorCode === 'usedCode')
  const fieldError = validationError ?? (codeError ? error : null)
  const setupError = setup?.result && !setup.result.ok ? t(`auth.errors.${setup.result.code}`, { defaultValue: setup.result.message || t('auth.authenticator.setupError') }) : null
  const generalError = (!codeError ? error : null) ?? setupError
  const setupFailed = setup?.result?.ok === false
  const setupLoading = setup !== null && setup.result === null

  return (
    <form className="flex min-w-0 flex-col gap-6" aria-busy={pending || setupLoading} onSubmit={(event) => {
      event.preventDefault()
      if (pending || (setup && !setup.result?.ok)) return
      setActionKind('verify')
      void run(() => gateway.verifyAuthenticatorCode({ code }))
    }}>
      {setup ? <>
        <ol className="flex min-w-0 flex-col gap-3">
          {[1, 2, 3, 4].map((step) => (
            <li key={step} className="flex min-w-0 items-start gap-4 text-muted-foreground">
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center border border-border text-[8px] leading-4 font-medium">{step}</span>
              <p className="min-w-0 text-xs leading-5 tracking-[0.4px]">{t(`auth.authenticator.step${step}`)}</p>
            </li>
          ))}
        </ol>
        <AuthenticatorSetupControls result={setup.result} pending={pending} retry={setup.retry} />
      </> : null}
      {!setupFailed ? <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-2.5 pt-[1.2px] font-['Helvetica_Neue',Helvetica,Arial,sans-serif] font-light">
          <label htmlFor={id} className="text-[10px] leading-[normal] tracking-[2.2px] text-[#4a4a4a] uppercase">{t('auth.twoFactor.code')}</label>
          <input id={id} name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} placeholder={t('auth.placeholders.code')} value={code} disabled={pending || setupLoading}
            aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? `${id}-error` : undefined}
            className={cn('h-[42px] w-full min-w-0 rounded-none border-0 border-b bg-transparent pt-1 pb-[15px] text-2xl leading-[22px] tracking-[12px] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-secondary/80', fieldError ? 'border-destructive text-destructive' : 'border-[#1c1c1c] text-white focus:border-accent', setupLoading && 'motion-safe:animate-pulse')}
            onChange={(event) => { setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setValidationError(null); if (actionKind === 'verify') clearError() }}
            onInvalid={(event) => { event.preventDefault(); setValidationError(t('auth.errors.incorrectCode')); event.currentTarget.focus() }}
          />
        </div>
        {fieldError ? <p id={`${id}-error`} role="alert" className="text-xs leading-5 tracking-[0.4px] text-destructive">{fieldError}</p> : null}
      </div> : null}
      <div className="flex min-w-0 flex-col gap-2">
        {!setupFailed ? <AuthSubmitButton pending={pending} disabled={setup !== null && !setup.result?.ok} label={t('common.actions.continue')} className={setupLoading ? 'motion-safe:animate-pulse' : ''} /> : null}
        <Button variant="outline" textStyle="strong" disabled={pending} onClick={() => {
          if (pending) return
          setValidationError(null)
          setActionKind('logout')
          void run(() => gateway.signOut())
        }}>{t('auth.signOut')}</Button>
        {generalError ? <p role="alert" className="text-xs leading-5 tracking-[0.4px] text-destructive">{generalError}</p> : null}
      </div>
    </form>
  )
}
