import { useRef, useState } from 'react'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { useAppTranslation } from '../../shared/i18n/app-i18n'

/** Keeps duplicate submissions and expected failures inside the auth feature. */
export function useAuthAction(onSessionChanged: () => Promise<void>) {
  const { t } = useAppTranslation()
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<Extract<GatewayResult, { ok: false }> | null>(null)

  async function run(action: () => Promise<GatewayResult>) {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setFailure(null)

    try {
      const result = await action()
      if (!result.ok) {
        setFailure({ ...result, message: t(`auth.errors.${result.code}`, { defaultValue: result.message }) })
        if (result.code === 'session') await onSessionChanged()
        return
      }
      await onSessionChanged()
    } catch {
      setFailure({ ok: false, code: 'unexpected', message: t('common.errors.unexpected') })
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return { pending, error: failure?.message ?? null, errorCode: failure?.code ?? null, run, clearError: () => setFailure(null) }
}
