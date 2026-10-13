import QRCode from 'qrcode'

/** Generates a scannable QR image containing exactly the supplied deposit address. */
export function createPaymentQrCode(address: string) {
  const themeColors =
    typeof document === 'undefined'
      ? undefined
      : {
          dark: getComputedStyle(document.documentElement)
            .getPropertyValue('--qr-foreground')
            .trim(),
          light: getComputedStyle(document.documentElement)
            .getPropertyValue('--qr-background')
            .trim(),
        }

  return QRCode.toDataURL(address, {
    color: themeColors,
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 172,
  })
}
