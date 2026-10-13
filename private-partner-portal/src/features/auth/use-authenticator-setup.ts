import { useEffect, useState } from 'react'

import type { GatewayResult } from '../../shared/api/gateway-result'
import type { AuthGateway, AuthenticatorSetup } from './api/auth-gateway'

export function useAuthenticatorSetup(gateway: AuthGateway, enabled: boolean, onSessionChanged: () => Promise<void>) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ gateway: AuthGateway; attempt: number; result: GatewayResult<AuthenticatorSetup> } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void Promise.resolve().then(() => gateway.getAuthenticatorSetup()).then(async (result) => {
      if (!active) return
      setLoaded({ gateway, attempt, result })
      if (!result.ok && result.code === 'session') await onSessionChanged()
    }).catch(() => {
      if (active) setLoaded({ gateway, attempt, result: { ok: false, code: 'unexpected', message: '' } })
    })
    return () => { active = false }
  }, [gateway, enabled, attempt, onSessionChanged])
  const result = enabled && loaded?.gateway === gateway && loaded.attempt === attempt ? loaded.result : null
  return { result, retry: () => setAttempt((value) => value + 1) }
}
