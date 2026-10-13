import { useEffect } from 'react'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { FlowHeading } from '../../../shared/ui/flow-heading'
import { useAuthFlow } from '../auth-flow-provider'
import { authErrorMessage } from '../model/auth-error-message'
import { formatPhoneNumber } from '../../../shared/phone/phone-countries'
import { formatResendDuration } from '../model/resend-countdown'
import { AuthSubmitButton } from './auth-submit-button'

interface CodeStepProps {
  postAuthenticationPending?: boolean
}

/** Verification-code entry and authentication submission step. */
export function CodeStep({ postAuthenticationPending = false }: CodeStepProps) {
  const { t } = useAppTranslation()
  const {
    state,
    setCode,
    resendCode,
    verifyCode,
    tickResendCountdown,
    backToContact,
  } = useAuthFlow()
  const error =
    state.errors.code !== undefined
      ? t('auth.errors.codeRequired')
      : state.gatewayError !== null
        ? authErrorMessage(state.gatewayError, t)
        : null
  const hasError = error !== undefined && error !== null
  const pending = state.submission === 'pending'
  const controlsPending = pending || postAuthenticationPending
  const resending = pending && state.submissionKind === 'resend-code'
  const verifying =
    postAuthenticationPending ||
    (pending && state.submissionKind === 'verify-code')
  const resendAvailable = state.resendSeconds === 0
  const resendTime = formatResendDuration(state.resendSeconds, {
    hour: t('auth.code.hourShort'),
    minute: t('auth.code.minuteShort'),
    second: t('auth.code.secondShort'),
    separator: t('auth.code.unitSeparator'),
  })
  const destination = t('auth.code.sentTo', {
    phone: formatPhoneNumber(state.country, state.phone),
  })

  useEffect(() => {
    if (resendAvailable) return

    const timeout = window.setTimeout(tickResendCountdown, 1000)
    return () => window.clearTimeout(timeout)
  }, [resendAvailable, state.resendSeconds, tickResendCountdown])

  return (
    <section className="flex min-w-0 flex-col gap-8 px-4 py-8">
      <FlowHeading
        eyebrow={t('common.brandEyebrow')}
        title={t('auth.code.title')}
        description={destination}
      />

      <form
        className="flex min-w-0 flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault()
          void verifyCode()
        }}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-[10px] pt-[1.2px]">
            <label
              className="font-sans text-xs leading-5 font-light tracking-[1.6px] text-muted-foreground uppercase"
              htmlFor="verification-code"
            >
              {t('auth.code.label')}
            </label>
            <input
              className={`min-w-0 border-b bg-transparent pt-1 pb-[7px] font-sans text-2xl leading-9 font-light tracking-[12px] caret-primary outline-none disabled:opacity-100 ${
                hasError
                  ? 'border-destructive text-destructive placeholder:text-destructive focus:border-destructive'
                  : 'border-border text-foreground placeholder:text-secondary focus:border-accent'
              }`}
              id="verification-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={state.code}
              disabled={controlsPending}
              aria-invalid={hasError}
              aria-describedby={hasError ? 'verification-code-error' : undefined}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          {hasError && (
            <p
              className="text-xs leading-5 font-light text-destructive"
              id="verification-code-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <AuthSubmitButton
            disabled={controlsPending}
            loadingLabel={t('auth.code.verifying')}
            pending={verifying}
          />
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button
              className={resending ? undefined : 'disabled:opacity-100'}
              variant="outline"
              size="sm"
              textStyle="body"
              aria-label={
                resending
                  ? t('auth.code.requesting')
                  : resendAvailable
                    ? undefined
                    : t('auth.code.resendAvailableIn', { time: resendTime })
              }
              aria-busy={resending || undefined}
              disabled={controlsPending || !resendAvailable}
              onClick={() => void resendCode()}
            >
              {resendAvailable ? (
                t('auth.code.resend')
              ) : (
                t('auth.code.resendIn', { time: resendTime })
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              textStyle="body"
              disabled={controlsPending}
              onClick={backToContact}
            >
              {t('auth.code.differentNumber')}
            </Button>
          </div>
        </div>
      </form>
    </section>
  )
}
