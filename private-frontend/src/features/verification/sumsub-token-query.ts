import type { SumsubToken, SumsubTokenGateway } from './api/sumsub-token-gateway'

export const SUMSUB_TOKEN_QUERY_KEY = ['verification', 'sumsub-token'] as const

export class SumsubTokenQueryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SumsubTokenQueryError'
    this.code = code
  }
}

export async function loadSumsubToken(
  gateway: SumsubTokenGateway,
  signal?: AbortSignal,
): Promise<SumsubToken> {
  const result = await gateway.get(signal)
  if (result.ok) return result.data

  throw new SumsubTokenQueryError(result.code, result.message)
}
