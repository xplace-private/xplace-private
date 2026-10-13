import type { ApiClient } from '../../../shared/api/api-client'

export interface CsrfTokenProvider {
  getToken(): Promise<string>
  invalidate(): void
}

export function createHttpCsrfTokenProvider(
  apiClient: ApiClient,
): CsrfTokenProvider {
  let tokenRequest: Promise<string> | null = null

  return {
    getToken() {
      tokenRequest ??= loadCsrfToken(apiClient).catch((error: unknown) => {
        tokenRequest = null
        throw error
      })
      return tokenRequest
    },
    invalidate() {
      tokenRequest = null
    },
  }
}

async function loadCsrfToken(apiClient: ApiClient): Promise<string> {
  const body = await apiClient.request('users/web/auth/csrf/')
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Invalid CSRF response')
  }

  const token = (body as Record<string, unknown>).csrf_token
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('Invalid CSRF response')
  }

  return token
}
