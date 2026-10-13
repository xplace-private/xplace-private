import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import { FlowHeading } from '../../shared/ui/flow-heading'
import type { GatewayResult } from '../../shared/api/gateway-result'
import type { AuthenticatorGateway, TwoFactorRequirement } from './api/authenticator-gateway'
import { authenticatorSetupQueryOptions } from './authenticator-query'
import { AuthenticatorCodeForm } from './components/authenticator-code-form'
import { AuthenticatorSetupControls } from './components/authenticator-setup'

interface AuthenticatorScreenProps {
  gateway: AuthenticatorGateway
  requirement: TwoFactorRequirement
  onCompleted(): Promise<void>
  onSignOut(): Promise<boolean>
}

export function AuthenticatorScreen({ gateway, requirement, onCompleted, onSignOut }: AuthenticatorScreenProps) {
  const { t } = useAppTranslation()
  const enrolling = requirement === 'totp_setup_required'
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<Extract<GatewayResult, { ok: false }> | null>(null)
  const active = useRef(true)
  const submitting = useRef(false)
  const setupQuery = useQuery({ ...authenticatorSetupQueryOptions(gateway), enabled: enrolling })
  const setupResult = setupQuery.data
  const setup = setupResult?.ok ? setupResult.data : null
  const setupFailure: Extract<GatewayResult, { ok: false }> | null = setupResult?.ok === false ? setupResult : null
  const setupLoading = enrolling && setupQuery.isPending
  const error = failure ?? setupFailure
  const errorMessage = error === null ? null
    : error.code === 'invalid_code' ? t('auth.authenticator.incorrectCode')
    : error.code === 'too_many_attempts' ? t('auth.authenticator.tooManyAttempts')
    : enrolling && !confirming ? t('auth.authenticator.setupError')
    : t('common.errors.unexpected')

  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  useEffect(() => {
    if (setupFailure?.code === 'session-changed') {
      void onCompleted().catch(() => {
        if (active.current) setFailure({ ok: false, code: 'unexpected', message: '' })
      })
    }
  }, [setupFailure, onCompleted])

  async function submit(code: string) {
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setFailure(null)
    try {
      const result = await gateway.verifyCode({ code, requirement })
      if (!active.current) return
      if (result.ok || result.code === 'session-changed') await onCompleted()
      else setFailure(result)
    } catch {
      if (active.current) setFailure({ ok: false, code: 'unexpected', message: '' })
    } finally {
      submitting.current = false
      if (active.current) setPending(false)
    }
  }

  async function signOut() {
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    try { await onSignOut() } finally {
      submitting.current = false
      if (active.current) setPending(false)
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-8 px-4 py-8">
      <FlowHeading
        eyebrow={enrolling ? t('auth.authenticator.eyebrow') : t('common.brandEyebrow')}
        title={enrolling ? t(confirming ? 'auth.authenticator.confirmTitle' : 'auth.authenticator.setupTitle') : t('auth.authenticator.loginTitle')}
        description={<span className="whitespace-pre-line">{enrolling ? t(confirming ? 'auth.authenticator.confirmDescription' : 'auth.authenticator.setupDescription') : t('auth.authenticator.loginDescription')}</span>}
      />
      {enrolling && !confirming ? (
        <>
          <AuthenticatorSetupControls setup={setup} pending={pending || setupLoading} failed={setupFailure !== null} />
          <div className="flex min-w-0 flex-col gap-2">
            {setupFailure ? (
              <>
                <p role="alert" className="text-xs leading-5 tracking-[0.4px] text-destructive">{errorMessage}</p>
                <Button variant="outline" size="lg" disabled={pending || setupQuery.isFetching} onClick={() => void setupQuery.refetch()}>{t('common.actions.retry')}</Button>
              </>
            ) : (
              <Button className="w-full" size="lg" textStyle="strong" disabled={pending || setup === null} onClick={() => setConfirming(true)}>{t('common.actions.continue')}</Button>
            )}
            <Button className="w-full" variant="outline" size="lg" textStyle="strong" disabled={pending} onClick={() => void signOut()}>{t('auth.authenticator.signOut')}</Button>
          </div>
        </>
      ) : (
        <AuthenticatorCodeForm error={errorMessage} codeError={error?.code === 'invalid_code'} pending={pending} confirming={enrolling} onSubmit={submit} onEdit={() => setFailure(null)} />
      )}
    </section>
  )
}
