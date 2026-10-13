import { afterEach, expect, test, vi } from 'vitest'

import createViteConfig from './vite.config'

afterEach(() => vi.unstubAllEnvs())

test('exposes the local backend through the development server proxy', async () => {
  const config = await createViteConfig({
    command: 'serve',
    mode: 'development',
    isSsrBuild: false,
    isPreview: false,
  })
  const proxy = config.server?.proxy?.['/api']
  const v2Proxy = config.server?.proxy?.['/api/v2']
  expect(config.server?.proxy?.['/partner/portal/v1']).toMatchObject({
    target: 'http://localhost:8000',
    changeOrigin: true,
    headers: { Origin: 'https://back.x.place' },
  })

  expect(proxy).toMatchObject({
    target: 'http://localhost:8000',
    changeOrigin: true,
    headers: { Origin: 'https://back.x.place' },
  })

  if (typeof proxy !== 'object' || proxy === null) {
    throw new Error('Expected /api proxy options')
  }

  expect(proxy.rewrite?.('/api/users/register/phone/')).toBe(
    '/api/v1/users/register/phone/',
  )
  expect(v2Proxy).toMatchObject({
    target: 'http://localhost:8000',
    changeOrigin: true,
    headers: { Origin: 'https://back.x.place' },
  })
  if (typeof v2Proxy !== 'object' || v2Proxy === null) {
    throw new Error('Expected /api/v2 proxy options')
  }
  expect(v2Proxy.rewrite?.('/api/v2/transactions/')).toBe('/api/v2/transactions/')
})

test.each(['dev', 'staging', 'production'])('%s uses a configured API origin without the local proxy', async (mode) => {
  const env = { command: 'serve' as const, mode }
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
  const config = await createViteConfig(env)
  expect(config.server).toBeUndefined()

  vi.stubEnv('VITE_API_BASE_URL', ' ')
  expect(() => createViteConfig(env)).toThrow(`VITE_API_BASE_URL is required for mode "${mode}"`)
})


test('creates private source maps only for builds with a Sentry upload token', async () => {
  vi.stubEnv('SENTRY_AUTH_TOKEN', '')
  const env = { command: 'build' as const, mode: 'staging' }
  expect((await createViteConfig(env)).build?.sourcemap).toBe(false)
  vi.stubEnv('SENTRY_AUTH_TOKEN', 'test-token')
  expect((await createViteConfig(env)).build?.sourcemap).toBe('hidden')
  expect((await createViteConfig({ ...env, command: 'serve' })).build?.sourcemap).toBe(false)
})
