import { expect, test, vi } from 'vitest'

import viteConfig from '../../vite.config'

test('generates private source maps only for authenticated Sentry builds', async () => {
  if (typeof viteConfig !== 'function') {
    throw new Error('Expected a mode-aware Vite config')
  }
  try {
    for (const token of ['', 'test-token']) {
      vi.stubEnv('SENTRY_AUTH_TOKEN', token)
      const config = await viteConfig({
        command: 'build',
        mode: 'production',
        isSsrBuild: false,
        isPreview: false,
      })
      expect(config.build?.sourcemap).toBe(token ? 'hidden' : false)
    }
  } finally {
    vi.unstubAllEnvs()
  }
})

test('development API proxies supply an origin trusted by local Django', async () => {
  if (typeof viteConfig !== 'function') {
    throw new Error('Expected a mode-aware Vite config')
  }

  const config = await viteConfig({
    command: 'serve',
    mode: 'development',
    isSsrBuild: false,
    isPreview: false,
  })
  const apiProxy = config.server?.proxy?.['/api']
  const v2Proxy = config.server?.proxy?.['/api/v2']

  expect(apiProxy).toMatchObject({
    headers: { Origin: 'https://back.x.place' },
  })
  expect(v2Proxy).toMatchObject({
    headers: { Origin: 'https://back.x.place' },
  })
})
