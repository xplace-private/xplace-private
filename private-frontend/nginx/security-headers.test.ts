import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

test('allows Sentry connections and Sumsub subdomain frames', () => {
  const config = readFileSync(new URL('./default.conf', import.meta.url), 'utf8')
  const policy = config.match(
    /add_header Content-Security-Policy "(.*?)" always;/,
  )?.[1]

  expect(policy).toMatch(
    /(?:^|; )connect-src [^;]* https:\/\/o4509822456692736\.ingest\.us\.sentry\.io(?: |;)/,
  )
  expect(policy).toContain("frame-src 'self' https://*.sumsub.com;")
})

test('allows Sumsub iframe permissions without opening other origins', () => {
  const headers = readFileSync(
    new URL('./security-headers.conf', import.meta.url),
    'utf8',
  )
  const policy = headers.match(
    /add_header Permissions-Policy (["'])(.*?)\1 always;/,
  )?.[2]

  expect(policy).toBe(
    'camera=(self "https://api.sumsub.com" "https://in.sumsub.com"), microphone=(self "https://api.sumsub.com" "https://in.sumsub.com"), geolocation=(self "https://api.sumsub.com" "https://in.sumsub.com"), clipboard-write=(self "https://api.sumsub.com"), hid=(self "https://api.sumsub.com"), payment=()',
  )
})
