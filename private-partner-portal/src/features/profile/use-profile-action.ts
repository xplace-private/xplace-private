import { useRef, useState } from 'react'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { useAppTranslation } from '../../shared/i18n/app-i18n'

export function useProfileAction(onSessionChanged: () => Promise<void>) {
  const { t } = useAppTranslation()
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Extract<GatewayResult, { ok: false }> | null>(null)

  async function run(request: () => Promise<GatewayResult>, onSuccess: () => void | Promise<void>) {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError(null)
    try {
      const result = await request()
      if (!result.ok) {
        setError({ ...result, message: t(`profile.errors.${result.code}`, { defaultValue: t(`auth.errors.${result.code}`, { defaultValue: result.message }) }) })
        if (result.code === 'session') await onSessionChanged()
      } else {
        await onSuccess()
      }
    } catch {
      setError({ ok: false, code: 'unexpected', message: t('common.errors.unexpected') })
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return { pending, error, run, clearError: () => setError(null) }
}
