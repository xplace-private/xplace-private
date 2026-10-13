import { useState } from 'react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { isValidPassword } from '../../shared/password-validation'
import { Button } from '../../shared/ui/button'
import { InfoBanner } from '../../shared/ui/info-banner'
import type { AuthGateway, AuthSession } from './api/auth-gateway'
import { AuthenticatorForm } from './authenticator-form'
import { AuthSubmitButton } from './auth-submit-button'
import { AuthLayout } from './auth-layout'
import { AuthError, AuthField } from './auth-field'
import { useAuthAction } from './use-auth-action'
import { useAuthenticatorSetup } from './use-authenticator-setup'

interface AuthStepProps {
  gateway: AuthGateway
  onSessionChanged(): Promise<void>
}

interface AuthScreenProps extends AuthStepProps {
  session: Exclude<AuthSession, 'authenticated'>
  onForgotPassword?: () => void
}

/** The Figma authentication steps share one visual shell. */
export function AuthScreen({ session, ...props }: AuthScreenProps) {
  const { t } = useAppTranslation()
  const authenticatorSetup = useAuthenticatorSetup(props.gateway, session === 'authenticator-required', props.onSessionChanged)
  const title = session === 'anonymous' ? 'signIn' :
    session === 'authenticator-required' ? 'authenticator' :
      session === 'two-factor-required' ? 'twoFactor' : 'setPassword'

  return (
    <AuthLayout title={t(`auth.${title}.title`)} description={session !== 'authenticator-required' ? t(`auth.${title}.description`) : undefined} focusKey={session} texture={session !== 'password-required'}>
      {session === 'anonymous' ? <SignInStep {...props} /> :
        session === 'authenticator-required' || session === 'two-factor-required' ? <AuthenticatorStep setup={session === 'authenticator-required' ? authenticatorSetup : null} {...props} /> :
          <SetPasswordStep {...props} />}
    </AuthLayout>
  )
}
function SignInStep({ gateway, onSessionChanged, onForgotPassword }: AuthStepProps & { onForgotPassword?: () => void }) {
  const { t } = useAppTranslation()
  const { pending, error, run } = useAuthAction(onSessionChanged)

  return (
    <form className="flex min-w-0 flex-col gap-6" aria-busy={pending} onSubmit={(event) => {
      event.preventDefault()
      const values = new FormData(event.currentTarget)
      const email = String(values.get('email') ?? '').trim()
      const password = String(values.get('password') ?? '')
      void run(() => gateway.signIn({ email, password }))
    }}>
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-6">
        <AuthField label={t('auth.fields.email')} name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={t('auth.placeholders.email')} className="max-w-80" />
        <AuthField label={t('auth.fields.password')} name="password" type="password" autoComplete="current-password" placeholder={t('auth.placeholders.password')} className="max-w-80" />
      </fieldset>
      <AuthError message={error} />
      <AuthSubmitButton pending={pending} className="w-full" label={t('auth.signIn.title')} />
      <Button variant="ghost" size="back" textStyle="body-light" className="font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs leading-3" disabled={pending} onClick={onForgotPassword}>
        {t('auth.signIn.forgotPassword')}
      </Button>
    </form>
  )
}

function AuthenticatorStep({ gateway, onSessionChanged, setup }: AuthStepProps & { setup: ReturnType<typeof useAuthenticatorSetup> | null }) {
  const action = useAuthAction(onSessionChanged)
  return <AuthenticatorForm gateway={gateway} action={action} setup={setup} />
}

function SetPasswordStep({ gateway, onSessionChanged }: AuthStepProps) {
  const { t } = useAppTranslation()
  const { pending, error, run } = useAuthAction(onSessionChanged)
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmError, setConfirmError] = useState<string | undefined>()

  return (
    <form className="flex min-w-0 flex-col gap-6" aria-busy={pending} onSubmit={(event) => {
      event.preventDefault()
      const values = new FormData(event.currentTarget)
      const password = String(values.get('password') ?? '')
      const confirmation = String(values.get('confirmation') ?? '')
      const validPassword = isValidPassword(password)
      const matches = password === confirmation
      setPasswordError(validPassword ? undefined : t('auth.errors.password'))
      setConfirmError(matches ? undefined : t('auth.errors.confirmation'))
      if (!validPassword || !matches) {
        event.currentTarget.querySelector<HTMLInputElement>(`[name="${validPassword ? 'confirmation' : 'password'}"]`)?.focus()
        return
      }
      void run(() => gateway.setPassword({ password }))
    }}>
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-6">
        <AuthField label={t('auth.fields.newPassword')} name="password" type="password" autoComplete="new-password" placeholder={t('auth.placeholders.newPassword')} error={passwordError} onChange={() => { setPasswordError(undefined); setConfirmError(undefined) }} />
        <AuthField label={t('auth.fields.confirmPassword')} name="confirmation" type="password" autoComplete="new-password" placeholder={t('auth.placeholders.confirmPassword')} error={confirmError} onChange={() => setConfirmError(undefined)} />
      </fieldset>
      <InfoBanner variant="warning">
        <div className="flex flex-col gap-1 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs leading-5">
          <p className="font-normal">{t('auth.setPassword.requirementsTitle')}</p>
          <p>{t('auth.setPassword.requirements')}</p>
        </div>
      </InfoBanner>
      <AuthError message={error} />
      <AuthSubmitButton pending={pending} className="max-sm:min-h-9 max-sm:whitespace-normal" label={t('auth.setPassword.continue')} />
    </form>
  )
}
