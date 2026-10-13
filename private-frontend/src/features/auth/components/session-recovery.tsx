import { useCallback, useRef, useState } from 'react'

import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { FlowHeading } from '../../../shared/ui/flow-heading'
import { Loader } from '../../../shared/ui/loader'

interface SessionRecoveryProps {
  message: string
  onRetry(): Promise<boolean>
  onSignOut(): void
}

/** Recovery controls for a stored session that could not be restored. */
export function SessionRecovery({
  onRetry,
  onSignOut,
}: SessionRecoveryProps) {
  const { t } = useAppTranslation()
  const [retryPending, setRetryPending] = useState(false)
  const retryPendingRef = useRef(false)

  const retry = useCallback(async () => {
    if (retryPendingRef.current) return

    retryPendingRef.current = true
    setRetryPending(true)
    try {
      await onRetry()
    } finally {
      retryPendingRef.current = false
      setRetryPending(false)
    }
  }, [onRetry])

  const signOut = useCallback(() => {
    if (!retryPendingRef.current) onSignOut()
  }, [onSignOut])

  return (
    <section className="flex min-w-0 flex-col gap-8 px-4 py-8">
      <FlowHeading
        eyebrow={t('common.brandEyebrow')}
        title={t('auth.recovery.title')}
        description={t('auth.recovery.description')}
      />
      <div className="flex min-w-0 flex-col gap-4">
        <Button
          className="relative w-full"
          variant="default"
          size="lg"
          textStyle="strong"
          disabled={retryPending}
          aria-busy={retryPending || undefined}
          onClick={() => void retry()}
        >
          {retryPending ? (
            <>
              <span className="invisible">{t('common.actions.retry')}</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader decorative />
              </span>
            </>
          ) : (
            t('common.actions.retry')
          )}
        </Button>
        <Button
          variant="outline"
          size="lg"
          textStyle="regular"
          disabled={retryPending}
          onClick={signOut}
        >
          {t('common.actions.signOut')}
        </Button>
      </div>
    </section>
  )
}
