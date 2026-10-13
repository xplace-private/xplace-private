import { expect, test, vi } from 'vitest'

import { createHttpCsrfTokenProvider } from './http-csrf-token-provider'

test('loads one validated CSRF token for repeated requests', async () => {
  const request = vi.fn().mockResolvedValue({ csrf_token: 'csrf-token-1' })
  const provider = createHttpCsrfTokenProvider({ request })

  await expect(provider.getToken()).resolves.toBe('csrf-token-1')
  await expect(provider.getToken()).resolves.toBe('csrf-token-1')

  expect(request).toHaveBeenCalledOnce()
  expect(request).toHaveBeenCalledWith('users/web/auth/csrf/')
})

test('reloads the CSRF token after the session rotates it', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ csrf_token: 'before-login' })
    .mockResolvedValueOnce({ csrf_token: 'after-login' })
  const provider = createHttpCsrfTokenProvider({ request })

  await expect(provider.getToken()).resolves.toBe('before-login')
  provider.invalidate()
  await expect(provider.getToken()).resolves.toBe('after-login')

  expect(request).toHaveBeenCalledTimes(2)
})

test.each([null, {}, { csrf_token: '' }, { csrf_token: 42 }])(
  'rejects a malformed CSRF response %#',
  async (body) => {
    const provider = createHttpCsrfTokenProvider({
      request: () => Promise.resolve(body),
    })

    await expect(provider.getToken()).rejects.toThrow('Invalid CSRF response')
  },
)
