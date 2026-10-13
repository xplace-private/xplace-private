import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { Occupation } from '../model/onboarding-flow'

export interface OccupationGateway {
  list(search: string, signal?: AbortSignal): Promise<GatewayResult<readonly Occupation[]>>
}
