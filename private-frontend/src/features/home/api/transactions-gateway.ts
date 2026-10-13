import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { TransactionsPage } from '../model/transaction'

export interface TransactionsListInput {
  page: number
  pageSize: number
  period?: { year: number; month: number }
  signal?: AbortSignal
}

export interface TransactionsGateway {
  list(input: TransactionsListInput): Promise<GatewayResult<TransactionsPage>>
}
