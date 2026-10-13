import type { GatewayResult } from '../../../shared/api/gateway-result'

export interface PrivateOverdueBalance {
  dueDate: string
  amountCents: number
  closed: boolean
}

export interface PrivateBalance {
  availableToSpendCents: number
  spentThisPeriodCents: number
  dueThisPeriodCents: number
  outstandingDebtCents?: number | null
  dueDate: string | null
  overdue: readonly PrivateOverdueBalance[]
}

export interface PrivateBalanceGateway {
  get(signal?: AbortSignal): Promise<GatewayResult<PrivateBalance>>
}
