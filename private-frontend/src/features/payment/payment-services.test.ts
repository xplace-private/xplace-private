import { describe, expect, test } from 'vitest'

import { createPaymentQrCode } from './payment-services'

describe('payment services', () => {
  test('generates a real QR data URL from the supplied wallet address', async () => {
    const firstQr = await createPaymentQrCode('wallet-one')
    const secondQr = await createPaymentQrCode('wallet-two')

    expect(firstQr).toMatch(/^data:image\/png;base64,/)
    expect(secondQr).toMatch(/^data:image\/png;base64,/)
    expect(firstQr).not.toBe(secondQr)
  })
})
