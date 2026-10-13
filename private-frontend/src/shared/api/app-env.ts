export interface AppEnvInput {
  MODE: string
  VITE_API_BASE_URL?: string
  VITE_CROWDIN_DISTRIBUTION_HASH?: string
}

export interface AppEnv {
  mode: string
  apiBaseUrl: string | null
  crowdinDistributionHash: string | null
}

const REQUIRED_API_URL_MODES = new Set([
  'development',
  'dev',
  'staging',
  'production',
])

/** Reads public client configuration for the current Vite mode. */
export function readAppEnv(env: AppEnvInput): AppEnv {
  const apiBaseUrl = parseApiBaseUrl(env.VITE_API_BASE_URL, env.MODE)
  const crowdinDistributionHash =
    env.VITE_CROWDIN_DISTRIBUTION_HASH?.trim() || null

  if (apiBaseUrl === null && REQUIRED_API_URL_MODES.has(env.MODE)) {
    throw new Error(`VITE_API_BASE_URL is required for mode "${env.MODE}"`)
  }

  return { mode: env.MODE, apiBaseUrl, crowdinDistributionHash }
}

function parseApiBaseUrl(value: string | undefined, mode: string): string | null {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') {
    return null
  }

  const normalized = trimmed.replace(/\/+$/, '')

  if (
    mode === 'development' &&
    normalized.startsWith('/') &&
    !normalized.startsWith('//')
  ) {
    return normalized
  }

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must be an http or https URL')
  }

  return normalized
}

export const appEnv = readAppEnv(import.meta.env)
