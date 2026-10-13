import type { GatewayResult } from '../../../shared/api/gateway-result'

export interface EurDebtQuote {
  /** EUR per USD (USDC is credited 1:1), including provider fees. */
  fxRate: string
  amountEurCents: number
  amountUsdCents: number
}

export interface EurDebtGateway {
  get(signal?: AbortSignal): Promise<GatewayResult<EurDebtQuote>>
}
