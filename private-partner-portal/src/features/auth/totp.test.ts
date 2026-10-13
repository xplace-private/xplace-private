import { expect, test } from 'vitest'

import { createTotpSecret, findTotpStep, totpCode } from './totp'

// RFC 6238 SHA-1 vectors, reduced to the six digits used by the portal.
const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
test.each([
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
])('matches the RFC TOTP vector at %s seconds', async (seconds, expected) => {
  expect(await totpCode(secret, seconds * 1000)).toBe(expected)
})

test('accepts only six digits in the current or adjacent time steps', async () => {
  const now = 1234567890000
  for (const offset of [-1, 0, 1]) {
    expect(await findTotpStep(secret, await totpCode(secret, now + offset * 30000), now))
      .toBe(Math.floor(now / 30000) + offset)
  }
  expect(await findTotpStep(secret, await totpCode(secret, now - 60000), now)).toBeNull()
  for (const invalid of ['', '00592', '0059240', 'abcdef', '123456']) {
    expect(await findTotpStep(secret, invalid, now)).toBeNull()
  }
})

test('generates distinct 160-bit Base32 secrets and rejects malformed keys', async () => {
  const first = createTotpSecret()
  expect(first).toMatch(/^[A-Z2-7]{32}$/)
  expect(createTotpSecret()).not.toBe(first)
  await expect(totpCode('invalid', 59000)).rejects.toThrow()
})
