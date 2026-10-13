import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { Loader } from '../../shared/ui/loader'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { SumsubWebSdkView } from './sumsub-web-sdk-view'
import { useVerificationFlow } from './verification-flow-provider'

interface SumsubVerificationScreenProps {
  onExit(): void
}

const unexpectedFailureMessage = 'Something went wrong. Please try again.'

export function SumsubVerificationScreen({
  onExit,
}: SumsubVerificationScreenProps) {
  const { t } = useAppTranslation()
  const {
    token,
    prepareToken,
    refreshToken,
    clearToken,
    markSubmitted,
    markAttemptFailed,
  } = useVerificationFlow()
  const settled = useRef(false)
  const active = useRef(true)
  const lifecycleGeneration = useRef(0)

  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
      lifecycleGeneration.current += 1
    }
  }, [])

  const settle = useCallback(
    (result: 'submitted' | 'failed') => {
      if (!active.current || settled.current) return
      settled.current = true

      if (result === 'submitted') markSubmitted()
      else markAttemptFailed()
      clearToken()
      onExit()
    },
    [clearToken, markAttemptFailed, markSubmitted, onExit],
  )

  const exitFailedAttempt = useCallback(() => {
    settle('failed')
  }, [settle])

  useEffect(() => {
    if (settled.current || token !== null) return

    let active = true
    void prepareToken()
      .then((prepared) => {
        if (active && !prepared) exitFailedAttempt()
      })
      .catch(() => {
        if (active) exitFailedAttempt()
      })

    return () => {
      active = false
    }
  }, [exitFailedAttempt, prepareToken, token])

  const submit = useCallback(() => {
    settle('submitted')
  }, [settle])

  const refresh = useCallback(async () => {
    const generation = lifecycleGeneration.current
    try {
      return await refreshToken()
    } catch {
      if (lifecycleGeneration.current === generation) {
        exitFailedAttempt()
      }
      throw new Error(unexpectedFailureMessage)
    }
  }, [exitFailedAttempt, refreshToken])

  if (token === null) {
    return (
      <div className="flex min-w-0 max-w-full flex-1 items-center justify-center py-12">
        <Loader label={t('verification.preparing')} tone="light" />
      </div>
    )
  }

  return (
    <SumsubWebSdkView
      accessToken={token.token}
      onTokenExpired={refresh}
      onSubmitted={submit}
    />
  )
}
