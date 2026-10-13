import { expect, test } from 'vitest'

import createViteConfig from './vite.config'

test('exposes the local backend through the development server proxy', async () => {
  const config = await createViteConfig({
    command: 'serve',
    mode: 'development',
    isSsrBuild: false,
    isPreview: false,
  })
  const proxy = config.server?.proxy?.['/api']
  const v2Proxy = config.server?.proxy?.['/api/v2']

  expect(proxy).toMatchObject({
    target: 'http://localhost:8000',
    changeOrigin: true,
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
  })
  if (typeof v2Proxy !== 'object' || v2Proxy === null) {
    throw new Error('Expected /api/v2 proxy options')
  }
  expect(v2Proxy.rewrite?.('/api/v2/transactions/')).toBe('/api/v2/transactions/')
})
