import { ApiRequestError, createApiClient, getApiErrorCode, isApiRequestError, type ApiClient, type ApiClientOptions } from './api-client'

interface CsrfApiClientOptions extends Omit<ApiClientOptions, 'getCsrfToken'> {
  csrfPath: string
}

/** Caches CSRF requests and refreshes a rejected token on the next explicit request. */
export function createCsrfApiClient({ csrfPath, ...options }: CsrfApiClientOptions): ApiClient {
  let token: Promise<string> | null = null
  const client = createApiClient({ ...options, getCsrfToken() {
    token ??= client.request(csrfPath, { retry: false }).then(value => {
      if (typeof value !== 'object' || value === null || !('csrf_token' in value) || typeof value.csrf_token !== 'string' || !value.csrf_token) {
        throw new ApiRequestError('invalid-response', null, null, 'Invalid CSRF response')
      }
      return value.csrf_token
    }).catch((error: unknown) => { token = null; throw error })
    return token
  } })

  return { async request(path, requestOptions) {
    try { return await client.request(path, requestOptions) }
    catch (error) {
      if (isApiRequestError(error) && error.status === 403 && getApiErrorCode(error)?.startsWith('CSRF Failed:')) token = null
      throw error
    }
  } }
}
