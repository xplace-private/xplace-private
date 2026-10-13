import { useId, useState, type InputHTMLAttributes } from 'react'
import { toast } from 'sonner'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { isValidPassword } from '../../shared/password-validation'
import { Button } from '../../shared/ui/button'
import { InfoBanner } from '../../shared/ui/info-banner'
import { Input } from '../../shared/ui/input'
import { Loader } from '../../shared/ui/loader'
import { ModalShell } from '../../shared/ui/modal-shell'
import type { ProfileGateway } from './api/profile-gateway'
import { useProfileAction } from './use-profile-action'

function PasswordField({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error: string | null | undefined }) {
  const id = useId()
  return <label className="flex min-w-0 flex-col" htmlFor={id}>
    <span id={`${id}-label`} className="text-xs leading-5 font-light tracking-[1.6px] text-secondary uppercase">{label}</span>
    <Input {...props} id={id} required aria-labelledby={`${id}-label`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className="text-2xl leading-9 placeholder:text-base max-sm:text-[max(16px,1.5rem)]" />
    {error ? <span id={`${id}-error`} role="alert" className="mt-2 text-xs leading-5 text-destructive">{error}</span> : null}
  </label>
}

interface ChangePasswordModalProps {
  gateway: ProfileGateway
  onSessionChanged: () => Promise<void>
  onChanged: () => void
  onClose: () => void
  returnFocusElement: HTMLElement | null
}

export function ChangePasswordModal({ gateway, onSessionChanged, onChanged, onClose, returnFocusElement }: ChangePasswordModalProps) {
  const { t } = useAppTranslation()
  const action = useProfileAction(onSessionChanged)
  const [validation, setValidation] = useState<Record<string, string>>({})
  const [code, setCode] = useState('')
  const fieldError = (name: string, serverCodes: string[]) => validation[name] ?? (action.error && serverCodes.includes(action.error.code) ? action.error.message : null)
  const generalError = action.error && !['currentPassword', 'invalidPassword', 'incorrectCode', 'usedCode'].includes(action.error.code) ? action.error.message : null

  function clearField(name: string) {
    setValidation(previous => { const next = { ...previous }; delete next[name]; return next })
    action.clearError()
  }

  return <ModalShell ariaLabel={t('profile.password.title')} onClose={onClose} closeDisabled={action.pending} returnFocusElement={returnFocusElement} overlayClassName="backdrop-blur-[8px]" panelClassName="max-w-[400px] p-5 font-sans shadow-xs sm:p-[31px]">
    <form noValidate aria-busy={action.pending} className="flex min-w-0 flex-col gap-6" onSubmit={event => {
      event.preventDefault()
      if (action.pending) return
      const form = event.currentTarget
      const values = new FormData(form)
      const currentPassword = String(values.get('currentPassword') ?? '')
      const password = String(values.get('password') ?? '')
      const confirmation = String(values.get('confirmation') ?? '')
      const errors: Record<string, string> = {}
      if (!currentPassword) errors.currentPassword = t('common.errors.required')
      if (!isValidPassword(password) || password === currentPassword) errors.password = t('auth.errors.password')
      if (confirmation !== password) errors.confirmation = t('auth.errors.confirmation')
      if (!/^[0-9]{6}$/.test(code)) errors.code = t('auth.errors.incorrectCode')
      setValidation(errors)
      action.clearError()
      const firstError = Object.keys(errors)[0]
      if (firstError) { form.querySelector<HTMLInputElement>(`[name="${firstError}"]`)?.focus(); return }
      void action.run(() => gateway.changePassword({ currentPassword, password, code }), () => {
        toast.success(t('profile.password.changed'))
        onChanged()
        onClose()
      })
    }}>
      <div className="text-center">
        <h2 className="text-xl font-bold leading-8">{t('profile.password.title')}</h2>
        <p className="mt-1 text-xs leading-5 tracking-[0.4px] text-secondary">{t('profile.password.description')}</p>
      </div>
      <fieldset disabled={action.pending} className="flex min-w-0 flex-col gap-6">
        <PasswordField name="currentPassword" type="password" autoComplete="current-password" label={t('profile.password.currentPassword')} placeholder={t('profile.password.currentPlaceholder')} error={fieldError('currentPassword', ['currentPassword'])} onChange={() => clearField('currentPassword')} />
        <PasswordField name="password" type="password" autoComplete="new-password" label={t('profile.password.newPassword')} placeholder={t('profile.password.newPlaceholder')} error={fieldError('password', ['invalidPassword'])} onChange={() => { clearField('password'); clearField('confirmation') }} />
        <PasswordField name="confirmation" type="password" autoComplete="new-password" label={t('profile.password.confirmPassword')} placeholder={t('profile.password.confirmPlaceholder')} error={fieldError('confirmation', [])} onChange={() => clearField('confirmation')} />
        <PasswordField name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} label={t('auth.twoFactor.code')} placeholder={t('auth.placeholders.code')} error={fieldError('code', ['incorrectCode', 'usedCode'])} value={code} onChange={event => { setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6)); clearField('code') }} />
      </fieldset>
      <InfoBanner variant="warning">
        <p className="font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-normal leading-5">{t('profile.password.requirementsTitle')}</p>
        <p className="mt-1 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-light leading-5">{t('profile.password.requirements')}</p>
      </InfoBanner>
      {generalError ? <p role="alert" className="text-xs leading-5 text-destructive">{generalError}</p> : null}
      <div className="flex min-w-0 flex-col gap-2">
        <Button type="submit" textStyle="strong" className="min-h-9 w-full max-sm:whitespace-normal" disabled={action.pending}>{action.pending ? <Loader /> : null}{t('profile.password.submit')}</Button>
        <Button variant="outline" textStyle="strong" className="h-9 w-full" disabled={action.pending} onClick={onClose}>{t('common.actions.close')}</Button>
      </div>
    </form>
  </ModalShell>
}
