import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createApiClient, type ApiClient } from '../shared/api/api-client'

import {
  createPartnerBrandingPath,
  parseThemeConfig,
  resolveThemeSource,
} from './theme-config'

vi.mock('../shared/api/api-client', () => ({ createApiClient: vi.fn() }))
vi.mock('../shared/api/app-env', () => ({
  appEnv: { apiBaseUrl: 'https://api.example.test' },
}))

const configMetadata = {
  version: 1,
} as const

const darkTheme = {
  logo_url: '/assets/auth/xplace-logo.svg',
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
}

describe('parseThemeConfig', () => {
  test.each(['/assets/partners/ww/favicon.svg', 'https://back.x.place/media/favicon.png'])(
    'accepts the partner favicon URL %s',
    (faviconUrl) => {
      const config = {
        ...configMetadata,
        favicon_url: faviconUrl,
        'dark-theme': darkTheme,
        'light-theme': {},
      }
      expect(parseThemeConfig(config, () => true)).toEqual(config)
    },
  )

  test('accepts one complete theme and one empty theme', () => {
    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          'dark-theme': darkTheme,
          'light-theme': {},
        },
        () => true,
      ),
    ).toEqual({
      ...configMetadata,
      'dark-theme': darkTheme,
      'light-theme': {},
    })
  })

  test('rejects incomplete themes and two empty themes', () => {
    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          'dark-theme': { background: '#000000' },
          'light-theme': {},
        },
        () => true,
      ),
    ).toBeNull()
    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          'dark-theme': {},
          'light-theme': {},
        },
        () => true,
      ),
    ).toBeNull()
  })

  test('requires the header visibility flag in every non-empty theme', () => {
    const themeWithoutPrivateHeader: Record<string, unknown> = { ...darkTheme }
    delete themeWithoutPrivateHeader.showPrivateOnHeader

    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          'dark-theme': themeWithoutPrivateHeader,
          'light-theme': {},
        },
        () => true,
      ),
    ).toBeNull()
  })

  test('requires the header stroke flag in every non-empty theme', () => {
    const themeWithoutHeaderStroke: Record<string, unknown> = { ...darkTheme }
    delete themeWithoutHeaderStroke.showHeaderStroke

    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          'dark-theme': themeWithoutHeaderStroke,
          'light-theme': {},
        },
        () => true,
      ),
    ).toBeNull()
  })

  test('requires the reverse header buttons flag in every non-empty theme', () => {
    const themeWithoutReverseHeaderButtons: Record<string, unknown> = { ...darkTheme }
    delete themeWithoutReverseHeaderButtons.reverseHeaderButtons

    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          'dark-theme': themeWithoutReverseHeaderButtons,
          'light-theme': {},
        },
        () => true,
      ),
    ).toBeNull()
  })

  test.each([undefined, 2])('rejects unsupported config version %s', (version) => {
    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          version,
          'dark-theme': darkTheme,
          'light-theme': {},
        },
        () => true,
      ),
    ).toBeNull()
  })

  test.each([
    undefined,
    '/assets/auth/xplace-logo.svg',
    'https://cdn.example.com/xplace-logo.svg',
  ])('accepts optional theme logo URL %s', (logoUrl) => {
    const theme: Record<string, unknown> = { ...darkTheme }
    if (logoUrl === undefined) delete theme.logo_url
    else theme.logo_url = logoUrl

    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          'dark-theme': theme,
          'light-theme': {},
        },
        () => true,
      ),
    ).toEqual({
      ...configMetadata,
      'dark-theme': theme,
      'light-theme': {},
    })
  })

  test.each([
    '/assets/auth/xplace-logo.svg',
    'http://back-stage.x.place/media/partner_branding/logos/XPlace.svg',
  ])('uses top-level logo URL %s when the theme logo is empty', (logoUrl) => {
    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          logo_url: logoUrl,
          'dark-theme': { ...darkTheme, logo_url: '' },
          'light-theme': {},
        },
        () => true,
      ),
    ).toEqual({
      ...configMetadata,
      'dark-theme': { ...darkTheme, logo_url: logoUrl },
      'light-theme': {},
    })
  })

  test.each([null, 42])('rejects invalid theme logo URL %s', (logoUrl) => {
    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          'dark-theme': { ...darkTheme, logo_url: logoUrl },
          'light-theme': {},
        },
        () => true,
      ),
    ).toBeNull()
  })

  test('accepts a null top-level logo without falling back to a theme logo', () => {
    const themeWithoutLogo: Record<string, unknown> = { ...darkTheme }
    delete themeWithoutLogo.logo_url

    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          logo_url: null,
          'dark-theme': darkTheme,
          'light-theme': {},
        },
        () => true,
      ),
    ).toEqual({
      ...configMetadata,
      'dark-theme': themeWithoutLogo,
      'light-theme': {},
    })
  })

  test('rejects an invalid top-level logo URL', () => {
    expect(
      parseThemeConfig(
        {
          ...configMetadata,
          logo_url: 42,
          'dark-theme': darkTheme,
          'light-theme': {},
        },
        () => true,
      ),
    ).toBeNull()
  })
})

describe('partner branding', () => {
  afterEach(() => vi.unstubAllGlobals())

  test.each([
    ['wise-wolves.x.place', 'partner-branding/?partner=ww'],
    [
      'private-wise-wolves.stage.kube-main.x.place',
      'partner-branding/?partner=ww',
    ],
    ['x.place', 'partner-branding/?partner=xplace'],
    [
      'private-frontend.stage.kube-main.x.place',
      'partner-branding/?partner=xplace',
    ],
  ])('selects the backend config for %s', (hostname, expectedPath) => {
    expect(createPartnerBrandingPath(hostname)).toBe(expectedPath)
  })

  test.each([
    ['development', 'localhost', '', 'local'],
    ['staging', '127.0.0.1', '?foo=bar', 'local'],
    ['development', 'localhost', '?theme=backend', 'backend-fresh'],
    ['staging', '127.0.0.1', '?foo=bar&theme=backend', 'backend-fresh'],
    ['staging', 'wise-wolves.stage.x.place', '', 'backend'],
    ['staging', 'xplace.stage.x.place', '?theme=backend', 'backend'],
    ['production', 'localhost', '', 'backend'],
  ])(
    'resolves %s on %s with query %s to %s',
    (mode, hostname, search, expected) => {
      expect(resolveThemeSource(mode, hostname, search)).toBe(expected)
    },
  )
})

describe('theme startup', () => {
  let initializeTheme: () => Promise<void>
  const request = vi.fn<ApiClient['request']>()
  const storage = {
    getItem: vi.fn<Storage['getItem']>(),
    setItem: vi.fn<Storage['setItem']>(),
  }
  const properties = new Map<string, string>()
  const iconAttributes = new Map<string, string>()
  const serverConfig = {
    version: 1,
    'dark-theme': { ...darkTheme, logo_url: 'https://cdn.example.test/brand.svg' },
    'light-theme': {},
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    vi.stubEnv('MODE', 'staging')
    properties.clear()
    iconAttributes.clear()
    iconAttributes.set('href', '/favicon.svg')
    iconAttributes.set('type', 'image/svg+xml')
    storage.getItem.mockReset().mockReturnValue(null)
    storage.setItem.mockReset()
    request.mockReset().mockRejectedValue(new Error('Offline'))
    vi.mocked(createApiClient).mockReturnValue({ request })
    vi.stubGlobal('CSS', { supports: () => true })
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {},
        style: {
          colorScheme: 'dark',
          setProperty: (name: string, value: string) => properties.set(name, value),
          removeProperty: (name: string) => properties.delete(name),
        },
      },
      querySelector: (selector: string) => selector === 'link[rel="icon"]' ? {
        setAttribute: (name: string, value: string) => iconAttributes.set(name, value),
        removeAttribute: (name: string) => iconAttributes.delete(name),
      } : null,
    })
    vi.stubGlobal('window', {
      location: { hostname: 'x.place', search: '' },
      localStorage: storage,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      dispatchEvent: vi.fn(),
      matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() }),
    })
    const themeModule = await import('./theme-config')
    initializeTheme = themeModule.initializeTheme
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  test('applies and caches a successful first response without scheduling retries', async () => {
    request.mockResolvedValue(serverConfig)

    await initializeTheme()

    expect(request).toHaveBeenCalledExactlyOnceWith(
      'partner-branding/?partner=xplace',
      { signal: expect.any(AbortSignal), retry: false },
    )
    expect(document.documentElement.dataset.logoUrl).toBe(serverConfig['dark-theme'].logo_url)
    expect(storage.setItem.mock.calls.map(([key, value]) => [key, JSON.parse(value)]))
      .toEqual([['xplace.theme-config.v1', serverConfig]])
    expect(vi.getTimerCount()).toBe(0)
  })

  test('applies and caches the favicon from the hostname-selected partner config', async () => {
    window.location.hostname = 'private-wise-wolves.stage.x.place'
    const config = { ...serverConfig, favicon_url: 'https://back.x.place/media/ww.png' }
    request.mockResolvedValue(config)

    await initializeTheme()

    expect(request).toHaveBeenCalledExactlyOnceWith(
      'partner-branding/?partner=ww',
      { signal: expect.any(AbortSignal), retry: false },
    )
    expect(iconAttributes.get('href')).toBe(config.favicon_url)
    expect(iconAttributes.has('type')).toBe(false)
    expect(storage.setItem.mock.calls.map(([key, value]) => [key, JSON.parse(value)]))
      .toEqual([['xplace.theme-config.v1', config]])
  })

  test.each([undefined, null, '', 42, 'not a URL', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>'])(
    'restores the default favicon for %s without discarding the partner theme',
    async (faviconUrl) => {
      iconAttributes.set('href', '/previous-partner.svg')
      request.mockResolvedValue({ ...serverConfig, favicon_url: faviconUrl })

      await initializeTheme()

      expect(iconAttributes.get('href')).toBe('/favicon.svg')
      expect(document.documentElement.dataset.logoUrl).toBe(serverConfig['dark-theme'].logo_url)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  test('restores a cached favicon and resets it when a refreshed config removes it', async () => {
    const cachedConfig = { ...serverConfig, favicon_url: '/assets/partners/ww/favicon.svg' }
    storage.getItem.mockReturnValue(JSON.stringify(cachedConfig))

    await initializeTheme()
    await vi.advanceTimersByTimeAsync(0)
    expect(iconAttributes.get('href')).toBe(cachedConfig.favicon_url)

    request.mockResolvedValue(serverConfig)
    await vi.advanceTimersByTimeAsync(3_000)

    expect(iconAttributes.get('href')).toBe('/favicon.svg')
    expect(vi.getTimerCount()).toBe(0)
  })

  test.each([
    ['x.place', 'dark', '#000000', 'true', 'https://back-stage.x.place/media/partner_branding/logos/2026/09/XPlace.svg'],
    ['private-wise-wolves.stage.x.place', 'light', '#FFFFFF', 'false', 'https://backend.stage.kube-main.x.place/media/partner_branding/logos/2026/09/ww-logo.svg'],
  ])('opens %s with its brand fallback after one failure', async (hostname, scheme, background, showPrivate, logoUrl) => {
    window.location.hostname = hostname

    await initializeTheme()

    expect(request).toHaveBeenCalledTimes(1)
    expect(document.documentElement.style.colorScheme).toBe(scheme)
    expect(properties.get('--background')).toBe(background)
    expect(document.documentElement.dataset.logoUrl).toBe(logoUrl)
    expect(document.documentElement.dataset.showPrivateOnHeader).toBe(showPrivate)
    expect(window.matchMedia).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
  })

  test('unblocks startup after the first three-second timeout', async () => {
    request.mockImplementationOnce((_path, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
    }))
    let ready = false
    const startup = initializeTheme().then(() => { ready = true })

    await vi.advanceTimersByTimeAsync(2_999)
    expect(ready).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await startup

    expect(ready).toBe(true)
    expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(document.documentElement.dataset.logoUrl).toContain('/XPlace.svg')
    expect(storage.setItem).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2_999)
    expect(request).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(request).toHaveBeenCalledTimes(2)
  })

  test.each(['not json', '{"version":2}', '{"version":1,"dark-theme":{},"light-theme":{}}'])(
    'falls back when cached data %s and the first response are invalid', async (cached) => {
      storage.getItem.mockReturnValue(cached)
      request.mockResolvedValue({ version: 1, 'dark-theme': { background: '#123456' }, 'light-theme': {} })

      await initializeTheme()

      expect(document.documentElement.dataset.logoUrl).toContain('/XPlace.svg')
      expect(storage.setItem).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(1)
    },
  )

  test('backs off exponentially up to a minute, then applies recovery and stops', async () => {
    await initializeTheme()
    let attempts = 1

    for (const delay of [3_000, 6_000, 12_000, 24_000, 48_000, 60_000, 60_000]) {
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(request).toHaveBeenCalledTimes(attempts)
      await vi.advanceTimersByTimeAsync(1)
      attempts += 1
      expect(request).toHaveBeenCalledTimes(attempts)
      expect(storage.setItem).not.toHaveBeenCalled()
    }

    request.mockResolvedValue(serverConfig)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(document.documentElement.dataset.logoUrl).toBe(serverConfig['dark-theme'].logo_url)
    expect(storage.setItem.mock.calls.map(([key, value]) => [key, JSON.parse(value)]))
      .toEqual([['xplace.theme-config.v1', serverConfig]])
    expect(window.dispatchEvent).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(request).toHaveBeenCalledTimes(attempts + 1)
  })

  test('keeps the cached theme during failed refreshes and retries in the background', async () => {
    storage.getItem.mockReturnValue(JSON.stringify(serverConfig))

    await initializeTheme()
    await vi.advanceTimersByTimeAsync(0)

    expect(document.documentElement.dataset.logoUrl).toBe(serverConfig['dark-theme'].logo_url)
    expect(storage.setItem).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(request).toHaveBeenCalledTimes(2)

    const updatedConfig = {
      ...serverConfig,
      'dark-theme': { ...serverConfig['dark-theme'], background: '#123456' },
    }
    request.mockResolvedValue(updatedConfig)
    await vi.advanceTimersByTimeAsync(5_999)
    expect(properties.get('--background')).toBe('#000000')
    await vi.advanceTimersByTimeAsync(1)

    expect(properties.get('--background')).toBe('#123456')
    expect(storage.setItem.mock.calls.map(([key, value]) => [key, JSON.parse(value)]))
      .toEqual([['xplace.theme-config.v1', updatedConfig]])
    expect(vi.getTimerCount()).toBe(0)
  })

  test('still applies backend branding when storage reads and writes fail', async () => {
    storage.getItem.mockImplementation(() => { throw new Error('Storage unavailable') })
    storage.setItem.mockImplementation(() => { throw new Error('Storage unavailable') })
    request.mockResolvedValue(serverConfig)

    await initializeTheme()

    expect(document.documentElement.dataset.logoUrl).toBe(serverConfig['dark-theme'].logo_url)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('local backend mode ignores the cache, falls back, and stores the eventual response', async () => {
    window.location.hostname = 'localhost'
    window.location.search = '?theme=backend'
    storage.getItem.mockReturnValue(JSON.stringify(serverConfig))

    await initializeTheme()

    expect(storage.getItem).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.logoUrl).toContain('/XPlace.svg')
    request.mockResolvedValue(serverConfig)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(document.documentElement.dataset.logoUrl).toBe(serverConfig['dark-theme'].logo_url)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  test('local mock mode keeps local assets and does not request or cache branding', async () => {
    window.location.hostname = 'localhost'

    await initializeTheme()

    expect(document.documentElement.dataset.logoUrl).toBe('/assets/auth/ww-logo.svg')
    expect(request).not.toHaveBeenCalled()
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
