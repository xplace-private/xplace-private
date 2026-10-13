import type { GatewayResult } from '../../../shared/api/gateway-result'

export interface CurrentUser {
  id: number
  username: string | null
  email: string | null
  avatar: string | null
}

export interface CurrentUserGateway {
  get(signal?: AbortSignal): Promise<GatewayResult<CurrentUser>>
}
