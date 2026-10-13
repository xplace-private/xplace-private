export interface ApiBaseUrls {
  v1: string
  v2: string
}

export function createApiBaseUrls(apiBaseUrl: string): ApiBaseUrls {
  if (apiBaseUrl.startsWith('/')) {
    return { v1: apiBaseUrl, v2: `${apiBaseUrl.replace(/\/$/, '')}/v2` }
  }

  return {
    v1: new URL('api/v1/', apiBaseUrl).href.replace(/\/$/, ''),
    v2: new URL('api/v2/', apiBaseUrl).href.replace(/\/$/, ''),
  }
}
