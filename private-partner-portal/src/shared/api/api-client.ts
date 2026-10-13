import ky, { isHTTPError, isTimeoutError } from 'ky'

const RETRY_LIMIT = 10
const RETRY_BACKOFF_LIMIT_MS = 10_000
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD'])
const RETRY_STATUS_CODES = [408, 429, ...Array.from({ length: 100 }, (_, index) => index + 500)]

export interface ApiRequestOptions {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  json?: unknown
  headers?: HeadersInit
  signal?: AbortSignal | undefined
  authenticated?: boolean
  retry?: boolean
  expectedStatus?: number
}

export interface ApiClient {
  request(path: string, options?: ApiRequestOptions): Promise<unknown>
}

export class ApiRequestError extends Error {
  readonly kind: 'http' | 'network' | 'aborted' | 'invalid-response'
  readonly status: number | null
  readonly body: unknown

  constructor(
    kind: ApiRequestError['kind'],
    status: number | null,
    body: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.kind = kind
    this.status = status
    this.body = body
  }
}

export interface ApiClientOptions {
  baseUrl: string
  fetch?: typeof globalThis.fetch
  getCsrfToken?: () => Promise<string>
  onUnauthorized?: () => void
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599)
}

function retryEnabled(options: ApiRequestOptions): boolean {
  const method = options.method ?? 'GET'
  return options.retry ?? SAFE_RETRY_METHODS.has(method)
}

function retryMethods(options: ApiRequestOptions): string[] {
  if (options.retry) {
    return [(options.method ?? 'GET').toLowerCase()]
  }

  return Array.from(SAFE_RETRY_METHODS, (method) => method.toLowerCase())
}

function isUnsafeMethod(method: ApiRequestOptions['method']): boolean {
  return method !== undefined && method !== 'GET' && method !== 'HEAD'
}

function createRequestUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const normalizedPath = path.replace(/^\/+/, '')
  return normalizedBase.startsWith('/')
    ? `${normalizedBase}/${normalizedPath}`
    : new URL(normalizedPath, `${normalizedBase}/`).href
}

function resolveRequestUrl(url: string): string {
  if (url.startsWith('/') && typeof globalThis.location === 'undefined') {
    return new URL(url, 'http://localhost').href
  }

  return url
}

function isAborted(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function readErrorBody(response: Response): Promise<unknown> {
  try {
    const body = await response.clone().text()
    return body === '' ? null : body
  } catch {
    return null
  }
}

async function toApiRequestError(error: unknown): Promise<ApiRequestError> {
  if (error instanceof ApiRequestError) {
    return error
  }

  if (isAborted(error)) {
    return new ApiRequestError('aborted', null, null, 'Request was aborted')
  }

  if (isHTTPError(error)) {
    return new ApiRequestError(
      'http',
      error.response.status,
      await readErrorBody(error.response),
      `Request failed with status ${error.response.status}`,
    )
  }

  if (isTimeoutError(error)) {
    return new ApiRequestError('network', null, null, 'Network request failed')
  }

  return new ApiRequestError('network', null, null, 'Network request failed')
}

export function createApiClient(clientOptions: ApiClientOptions): ApiClient {
  return {
    async request(path, requestOptions = {}) {
      const headers = new Headers(requestOptions.headers)

      try {
        if (
          isUnsafeMethod(requestOptions.method) &&
          !headers.has('X-CSRFToken') &&
          clientOptions.getCsrfToken !== undefined
        ) {
          headers.set('X-CSRFToken', await clientOptions.getCsrfToken())
        }

        const response = await ky(
          resolveRequestUrl(createRequestUrl(clientOptions.baseUrl, path)),
          {
            method: requestOptions.method ?? 'GET',
            headers,
            credentials: 'include',
            ...(requestOptions.json === undefined ? {} : { json: requestOptions.json }),
            ...(requestOptions.signal === undefined
              ? {}
              : { signal: requestOptions.signal }),
            ...(clientOptions.fetch === undefined
              ? {}
              : { fetch: clientOptions.fetch }),
            retry: retryEnabled(requestOptions)
              ? {
                  limit: RETRY_LIMIT,
                  methods: retryMethods(requestOptions),
                  statusCodes: RETRY_STATUS_CODES.filter(shouldRetryStatus),
                  afterStatusCodes: [],
                  backoffLimit: RETRY_BACKOFF_LIMIT_MS,
                  retryOnTimeout: true,
                  delay: (attempt) =>
                    Math.min(300 * 2 ** (attempt - 1), RETRY_BACKOFF_LIMIT_MS),
                  jitter: true,
                }
              : 0,
          },
        )

        if (requestOptions.expectedStatus !== undefined && response.status !== requestOptions.expectedStatus) {
          throw new ApiRequestError('invalid-response', response.status, null, 'Unexpected response status')
        }

        if (requestOptions.method === 'HEAD' || response.status === 204) {
          return null
        }

        try {
          return await response.json<unknown>()
        } catch (error) {
          if (isAborted(error)) throw error
          throw new ApiRequestError(
            'invalid-response',
            response.status,
            null,
            'Response was not valid JSON',
          )
        }
      } catch (error) {
        if (
          requestOptions.authenticated &&
          isHTTPError(error) &&
          error.response.status === 401
        ) {
          clientOptions.onUnauthorized?.()
        }

        throw await toApiRequestError(error)
      }
    },
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError
}

export function getApiErrorCode(error: unknown): string | null {
  if (!isApiRequestError(error) || typeof error.body !== 'string') return null
  try {
    const body: unknown = JSON.parse(error.body)
    return typeof body === 'object' && body !== null && !Array.isArray(body) && 'error' in body && typeof body.error === 'string' ? body.error : null
  } catch { return null }
}
