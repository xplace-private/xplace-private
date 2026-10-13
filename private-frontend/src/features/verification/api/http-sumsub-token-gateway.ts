import type { ApiClient } from '../../../shared/api/api-client'
import type { SumsubTokenGateway } from './sumsub-token-gateway'

const failure = {
  ok: false as const,
  code: 'sumsub-token-failed' as const,
  message: 'Something went wrong. Please try again.',
}

export function createHttpSumsubTokenGateway(
  apiClient: ApiClient,
): SumsubTokenGateway {
  return {
    async get(signal) {
      try {
        const token = readTokenResponse(
          await apiClient.request('sumsub/access-token/', {
            authenticated: true,
            method: 'POST',
            retry: 2,
            signal,
          }),
        )

        return token === null ? failure : { ok: true, data: token }
      } catch {
        return failure
      }
    },
  }
}

function readTokenResponse(value: unknown): { token: string; userId: string } | null {
  if (!isRecord(value)) return null

  const { token, userId } = value
  if (
    typeof token !== 'string' ||
    token.trim() === '' ||
    typeof userId !== 'string' ||
    userId.trim() === ''
  ) {
    return null
  }

  return { token, userId }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
