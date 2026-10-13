import QRCode from 'qrcode'

/** Encodes exactly the displayed deposit address, using the Private payment QR settings. */
export function createPaymentQrCode(address: string) {
  return QRCode.toDataURL(address, { errorCorrectionLevel: 'M', margin: 0, width: 172 })
}
