import { createApiBaseUrls } from '../shared/api/api-base-urls'
import { createApiClient, type ApiClient } from '../shared/api/api-client'
import { appEnv } from '../shared/api/app-env'
import { reportApiRequestError } from './sentry'

const THEME_CONFIG_KEY = 'xplace.theme-config.v1'
const REQUEST_TIMEOUT_MS = 3_000
const RETRY_DELAY_MS = 3_000
const MAX_RETRY_DELAY_MS = 60_000
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

const THEME_COLOR_NAMES = [
  'background',
  'foreground',
  'card',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'positive',
  'warning',
  'border',
  'popover',
  'popover-foreground',
  'ring',
  'card-number-shadow',
  'qr-background',
  'qr-foreground',
  'notice-accent',
  'notice-background',
] as const

type ThemeColorName = (typeof THEME_COLOR_NAMES)[number]
type ThemeColors = Partial<Record<ThemeColorName, string>> & {
  logo_url?: string
  'header-color'?: string | null
  showPrivateOnHeader?: boolean
  showHeaderStroke?: boolean
  reverseHeaderButtons?: boolean
}

export interface ThemeConfig {
  version: 1
  favicon_url?: string
  'dark-theme': ThemeColors
  'light-theme': ThemeColors
}

export function resolvePartner(hostname: string) {
  return hostname.includes('wise-wolves') ? 'ww' : 'xplace'
}

export function createPartnerBrandingPath(hostname: string): string {
  return `partner-branding/?partner=${resolvePartner(hostname)}`
}

export function resolveThemeSource(
  mode: string,
  hostname: string,
  search: string,
): 'local' | 'backend-fresh' | 'backend' {
  const isLocal =
    mode !== 'production' &&
    (hostname === 'localhost' || hostname === '127.0.0.1')

  if (!isLocal) return 'backend'
  return new URLSearchParams(search).get('theme') === 'backend'
    ? 'backend-fresh'
    : 'local'
}

const XPLACE_FALLBACK_THEME_CONFIG = {
  version: 1,
  'dark-theme': {
    logo_url: 'https://back-stage.x.place/media/partner_branding/logos/2026/09/XPlace.svg',
    showPrivateOnHeader: true,
    background: '#000000',
    foreground: '#FAFAFA',
    card: '#0A0A0A',
    primary: '#FFFFFF',
    'primary-foreground': '#171717',
    secondary: '#A3A3A3',
    'secondary-foreground': '#FAFAFA',
    muted: '#525252',
    'muted-foreground': '#A3A3A3',
    accent: '#C9BDA8',
    'accent-foreground': '#FAFAFA',
    destructive: '#FF6467',
    positive: '#7FB08A',
    warning: '#C9A86A',
    border: '#262626',
    popover: '#262626',
    'popover-foreground': '#FAFAFA',
    ring: '#737373',
    'card-number-shadow': 'color-mix(in srgb, #FFFFFF 95%, transparent)',
    'qr-background': '#FFFFFF',
    'qr-foreground': '#09090B',
    'notice-accent': '#C9BDA8',
    'notice-background': '#0A0A0A',
    'header-color': null,
    showHeaderStroke: true,
    reverseHeaderButtons: false,
  },
  'light-theme': {},
} satisfies ThemeConfig

const WW_FALLBACK_THEME_CONFIG = {
  version: 1,
  'dark-theme': {},
  'light-theme': {
    logo_url: 'https://backend.stage.kube-main.x.place/media/partner_branding/logos/2026/09/ww-logo.svg',
    showPrivateOnHeader: false,
    background: '#FFFFFF',
    foreground: '#0A0A0A',
    card: '#F6F7FB',
    primary: '#0F2B40',
    'primary-foreground': '#FAFAFA',
    secondary: '#737373',
    'secondary-foreground': '#0A0A0A',
    muted: '#737373',
    'muted-foreground': '#737373',
    accent: '#0F2B40',
    'accent-foreground': '#171717',
    destructive: '#B2402F',
    positive: '#4C6E53',
    warning: '#C9A86A',
    border: '#E3E8F1',
    popover: '#FFFFFF',
    'popover-foreground': '#0A0A0A',
    ring: '#737373',
    'card-number-shadow': 'color-mix(in srgb, #0F2B40 95%, transparent)',
    'qr-background': '#FFFFFF',
    'qr-foreground': '#0F2B40',
    'notice-accent': '#B2402F',
    'notice-background': '#FCECEB',
    'header-color': '#0F2B40',
    showHeaderStroke: false,
    reverseHeaderButtons: true,
  },
} satisfies ThemeConfig

const MOCK_THEME_CONFIG = {
  version: 1,
  'dark-theme': {
    ...XPLACE_FALLBACK_THEME_CONFIG['dark-theme'],
    logo_url: '/assets/auth/xplace-logo.svg',
  },
  'light-theme': {
    ...WW_FALLBACK_THEME_CONFIG['light-theme'],
    logo_url: '/assets/auth/ww-logo.svg',
  },
} satisfies ThemeConfig

type ColorSupport = (value: string) => boolean

let activeConfig: ThemeConfig | null = null
let darkScheme: MediaQueryList | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasColors(theme: ThemeColors): boolean {
  return Object.keys(theme).length > 0
}

function parseLogoUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return null
  return value.trim() || undefined
}

function parseFaviconUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const url = value.trim()
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return url
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : undefined
  } catch {
    return undefined
  }
}

function parseTheme(
  value: unknown,
  supportsColor: ColorSupport,
  defaultLogoUrl?: string,
  hideLogo = false,
): ThemeColors | null {
  if (!isRecord(value)) return null
  if (Object.keys(value).length === 0) return {}

  const theme: ThemeColors = {}
  if (!hideLogo) {
    const logoUrl = parseLogoUrl(value.logo_url)
    if (logoUrl === null) return null
    const resolvedLogoUrl = logoUrl ?? defaultLogoUrl
    if (resolvedLogoUrl !== undefined) theme.logo_url = resolvedLogoUrl
  }

  for (const name of THEME_COLOR_NAMES) {
    const color = value[name]
    if (typeof color !== 'string' || !supportsColor(color)) return null
    theme[name] = color
  }

  const headerColor = value['header-color']
  if (headerColor !== undefined) {
    if (
      headerColor !== null &&
      (typeof headerColor !== 'string' || !supportsColor(headerColor))
    ) {
      return null
    }
    theme['header-color'] = headerColor
  }

  if (typeof value.showHeaderStroke !== 'boolean') return null
  theme.showHeaderStroke = value.showHeaderStroke
  if (typeof value.reverseHeaderButtons !== 'boolean') return null
  theme.reverseHeaderButtons = value.reverseHeaderButtons
  if (typeof value.showPrivateOnHeader !== 'boolean') return null
  theme.showPrivateOnHeader = value.showPrivateOnHeader

  return theme
}

export function parseThemeConfig(
  value: unknown,
  supportsColor: ColorSupport = (color) => CSS.supports('color', color),
): ThemeConfig | null {
  if (!isRecord(value)) return null
  if (value.version !== 1) return null

  const hideLogo = value.logo_url === null
  const defaultLogoUrl = hideLogo ? undefined : parseLogoUrl(value.logo_url)
  if (defaultLogoUrl === null) return null

  const darkTheme = parseTheme(value['dark-theme'], supportsColor, defaultLogoUrl, hideLogo)
  const lightTheme = parseTheme(value['light-theme'], supportsColor, defaultLogoUrl, hideLogo)
  if (
    darkTheme === null ||
    lightTheme === null ||
    (!hasColors(darkTheme) && !hasColors(lightTheme))
  ) {
    return null
  }

  const faviconUrl = parseFaviconUrl(value.favicon_url)
  return {
    version: value.version,
    ...(faviconUrl === undefined ? {} : { favicon_url: faviconUrl }),
    'dark-theme': darkTheme,
    'light-theme': lightTheme,
  }
}

function selectTheme(config: ThemeConfig, prefersDark: boolean) {
  const hasDark = hasColors(config['dark-theme'])
  const useDark = hasDark && (!hasColors(config['light-theme']) || prefersDark)
  return useDark
    ? { colors: config['dark-theme'], scheme: 'dark' as const }
    : { colors: config['light-theme'], scheme: 'light' as const }
}

function applyActiveTheme(config: ThemeConfig, prefersDark: boolean) {
  const { colors, scheme } = selectTheme(config, prefersDark)
  const root = document.documentElement

  root.dataset.showPrivateOnHeader = String(colors.showPrivateOnHeader)
  root.dataset.showHeaderStroke = String(colors.showHeaderStroke !== false)
  root.dataset.reverseHeaderButtons = String(colors.reverseHeaderButtons === true)
  root.dataset.logoUrl = colors.logo_url ?? ''

  for (const name of THEME_COLOR_NAMES) {
    const color = colors[name]
    if (color !== undefined) root.style.setProperty(`--${name}`, color)
  }

  const headerColor = colors['header-color']
  if (headerColor === null || headerColor === undefined) {
    root.style.removeProperty('--header-color')
  } else {
    root.style.setProperty('--header-color', headerColor)
  }

  root.style.colorScheme = scheme
  document
    .querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
    ?.setAttribute('content', scheme)
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', colors.background ?? '#000000')
  window.dispatchEvent(new Event('themechange'))
}

function applyThemeConfig(config: ThemeConfig) {
  activeConfig = config
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  favicon?.setAttribute('href', config.favicon_url ?? '/favicon.svg')
  favicon?.removeAttribute('type')
  const usesSystemTheme =
    hasColors(config['dark-theme']) && hasColors(config['light-theme'])

  if (usesSystemTheme && darkScheme === null) {
    darkScheme = window.matchMedia(DARK_SCHEME_QUERY)
    darkScheme.addEventListener('change', ({ matches }) => {
      if (activeConfig !== null) applyActiveTheme(activeConfig, matches)
    })
  }

  applyActiveTheme(config, darkScheme?.matches ?? false)
}

function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readStoredThemeConfig(): ThemeConfig | null {
  try {
    const stored = getStorage()?.getItem(THEME_CONFIG_KEY)
    return stored === null || stored === undefined
      ? null
      : parseThemeConfig(JSON.parse(stored))
  } catch {
    return null
  }
}

function storeThemeConfig(config: ThemeConfig) {
  try {
    getStorage()?.setItem(THEME_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // Storage can be unavailable in private browsing or embedded WebViews.
  }
}

function createThemeClient(): ApiClient {
  if (appEnv.apiBaseUrl === null) {
    throw new Error('VITE_API_BASE_URL is required')
  }

  return createApiClient({
    baseUrl: createApiBaseUrls(appEnv.apiBaseUrl).v1,
    onRequestError: reportApiRequestError,
  })
}

async function requestThemeConfig(client: ApiClient): Promise<ThemeConfig> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const config = parseThemeConfig(
      await client.request(createPartnerBrandingPath(window.location.hostname), {
        signal: controller.signal,
        retry: false,
      }),
    )
    if (config === null) throw new Error('Theme config is invalid')
    return config
  } finally {
    window.clearTimeout(timeout)
  }
}

function acceptThemeConfig(config: ThemeConfig) {
  storeThemeConfig(config)
  applyThemeConfig(config)
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs))
}

async function refreshThemeConfig(client: ApiClient, delayMs = 0) {
  for (;;) {
    if (delayMs > 0) await waitForRetry(delayMs)
    try {
      acceptThemeConfig(await requestThemeConfig(client))
      return
    } catch {
      delayMs = delayMs === 0
        ? RETRY_DELAY_MS
        : Math.min(delayMs * 2, MAX_RETRY_DELAY_MS)
    }
  }
}

export async function initializeTheme(): Promise<void> {
  const source = resolveThemeSource(
    import.meta.env.MODE,
    window.location.hostname,
    window.location.search,
  )

  if (source === 'local') {
    applyThemeConfig(MOCK_THEME_CONFIG)
    return
  }

  const client = createThemeClient()
  const storedConfig = source === 'backend' ? readStoredThemeConfig() : null

  if (storedConfig !== null) {
    applyThemeConfig(storedConfig)
    void refreshThemeConfig(client)
    return
  }

  try {
    acceptThemeConfig(await requestThemeConfig(client))
  } catch {
    applyThemeConfig(
      resolvePartner(window.location.hostname) === 'ww'
        ? WW_FALLBACK_THEME_CONFIG
        : XPLACE_FALLBACK_THEME_CONFIG,
    )
    void refreshThemeConfig(client, RETRY_DELAY_MS)
  }
}
