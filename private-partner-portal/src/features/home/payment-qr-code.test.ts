import { expect, test } from 'vitest'

import { createPaymentQrCode } from './payment-qr-code'

test('generates a real 172px PNG QR and regenerates it for a different deposit address', async () => {
  const first = await createPaymentQrCode('So1aNaXP1cePr1vAteDemo7yqW3kZ9mDepos7ADDRnotreal')
  const second = await createPaymentQrCode('0x1234567890123456789012345678901234567890')
  expect(first).toMatch(/^data:image\/png;base64,/)
  expect(second).toMatch(/^data:image\/png;base64,/)
  expect(first).not.toBe(second)
  const png = Buffer.from(first.split(',')[1]!, 'base64')
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(172)
  expect(png.readUInt32BE(20)).toBe(172)
})

test('rejects an empty deposit address instead of producing an unrelated QR', async () => {
  await expect(createPaymentQrCode('')).rejects.toThrow()
})
