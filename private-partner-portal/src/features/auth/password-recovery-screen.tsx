import { useState } from 'react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { isValidPassword } from '../../shared/password-validation'
import { Button } from '../../shared/ui/button'
import { InfoBanner } from '../../shared/ui/info-banner'
import type { AuthGateway } from './api/auth-gateway'
import { AuthError, AuthField } from './auth-field'
import { AuthLayout } from './auth-layout'
import { AuthSubmitButton } from './auth-submit-button'
import { useAuthAction } from './use-auth-action'

interface RecoveryProps {
  gateway: AuthGateway
  onBackToSignIn(): void
}

export function ForgotPasswordScreen({ gateway, onBackToSignIn }: RecoveryProps) {
  const { t } = useAppTranslation()
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const { pending, error, run } = useAuthAction(async () => {})
  const step = submittedEmail === null ? 'forgotPassword' : 'checkEmail'

  return (
    <AuthLayout title={t(`auth.${step}.title`)} description={t(`auth.${step}.description`)} focusKey={step}
      icon={submittedEmail !== null ? <span aria-hidden="true" className="grid size-6 place-items-center"><img src="/assets/auth/reset-request-received.svg" alt="" /></span> : undefined}>
      {submittedEmail === null ? <form className="flex min-w-0 flex-col gap-6" aria-busy={pending} onSubmit={(event) => {
        event.preventDefault()
        const values = new FormData(event.currentTarget)
        const email = String(values.get('email') ?? '').trim().toLowerCase()
        void run(async () => {
          const result = await gateway.requestPasswordReset({ email })
          if (result.ok) setSubmittedEmail(email)
          return result
        })
      }}>
        <fieldset disabled={pending} className="min-w-0">
          <AuthField recovery label={t('auth.fields.email')} name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={t('auth.placeholders.email')} />
        </fieldset>
        <AuthError message={error} />
        <AuthSubmitButton pending={pending} className="w-full" label={t('auth.forgotPassword.send')} />
        <BackToSignIn disabled={pending} onClick={onBackToSignIn} />
      </form> : <>
        <div className="flex min-w-0 flex-col gap-2 text-center">
          <p className="text-2xl leading-9 font-light text-primary [overflow-wrap:anywhere]">{submittedEmail}</p>
          <p className="text-xs leading-5 tracking-[0.4px] text-muted-foreground">{t('auth.checkEmail.delivery')}</p>
        </div>
        <BackToSignIn onClick={onBackToSignIn} />
      </>}
    </AuthLayout>
  )
}

export function ResetPasswordScreen({ gateway, token, onBackToSignIn, onPasswordReset }: RecoveryProps & { token: string | null; onPasswordReset(): Promise<void> }) {
  const { t } = useAppTranslation()
  const { pending, error, errorCode, run, clearError } = useAuthAction(onPasswordReset)
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmError, setConfirmError] = useState<string | undefined>()
  const invalidToken = token === null || errorCode === 'invalidToken'
  const fieldError = passwordError ?? (errorCode === 'invalidPassword' ? error ?? undefined : undefined)

  return (
    <AuthLayout title={t('auth.resetPassword.title')} description={t('auth.resetPassword.description')} focusKey="resetPassword">
      <form className="flex min-w-0 flex-col gap-6" aria-busy={pending} onSubmit={(event) => {
        event.preventDefault()
        if (invalidToken || pending) return
        const values = new FormData(event.currentTarget)
        const password = String(values.get('password') ?? '')
        const confirmation = String(values.get('confirmation') ?? '')
        const validPassword = isValidPassword(password)
        const matches = password === confirmation
        clearError()
        setPasswordError(validPassword ? undefined : t(Array.from(password).length < 8 ? 'auth.resetPassword.minimumLength' : 'auth.errors.password'))
        setConfirmError(matches ? undefined : t('auth.errors.confirmation'))
        if (!validPassword || !matches) {
          event.currentTarget.querySelector<HTMLInputElement>(`[name="${validPassword ? 'confirmation' : 'password'}"]`)?.focus()
          return
        }
        void run(() => gateway.resetPassword({ token, password }))
      }}>
        <fieldset disabled={pending || invalidToken} className="flex min-w-0 flex-col gap-6">
          <AuthField recovery label={t('auth.fields.newPassword')} name="password" type="password" autoComplete="new-password" placeholder={t('auth.placeholders.newPassword')} error={fieldError} onChange={() => { setPasswordError(undefined); setConfirmError(undefined); clearError() }} />
          <AuthField recovery label={t('auth.resetPassword.confirmPassword')} name="confirmation" type="password" autoComplete="new-password" placeholder={t('auth.placeholders.confirmPassword')} error={confirmError} onChange={() => setConfirmError(undefined)} />
        </fieldset>
        <InfoBanner variant="warning">
          <div className="flex flex-col gap-1 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs leading-5">
            <p className="font-normal">{t('auth.setPassword.requirementsTitle')}</p>
            <p>{t('auth.setPassword.requirements')}</p>
          </div>
        </InfoBanner>
        <AuthError message={invalidToken ? t('auth.errors.invalidToken') : errorCode === 'invalidPassword' ? null : error} />
        <AuthSubmitButton pending={pending} disabled={invalidToken} className="w-full" label={t('auth.resetPassword.title')} />
        <BackToSignIn disabled={pending} onClick={onBackToSignIn} />
      </form>
    </AuthLayout>
  )
}

function BackToSignIn({ onClick, disabled = false }: { onClick(): void; disabled?: boolean }) {
  const { t } = useAppTranslation()
  return <Button variant="ghost" size="back" textStyle="body-light" className="w-full font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs leading-3" disabled={disabled} onClick={onClick}>{t('auth.backToSignIn')}</Button>
}
