import type { GatewayResult } from '../../../shared/api/gateway-result'

export interface SumsubToken {
  token: string
  userId: string
}

export interface SumsubTokenGateway {
  get(signal?: AbortSignal): Promise<GatewayResult<SumsubToken>>
}
