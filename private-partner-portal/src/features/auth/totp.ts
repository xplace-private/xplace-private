const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const stepMs = 30000

export function createTotpSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => alphabet.charAt(byte & 31)).join('')
}

/** Demo-only TOTP verifier. Production verification belongs to the server adapter. */
export async function totpCode(secret: string, time = Date.now()) {
  if (!/^[A-Z2-7]{32}$/.test(secret) || !Number.isFinite(time) || time < 0) throw new Error('Invalid TOTP input')
  const bytes: number[] = []
  let value = 0
  let bits = 0
  for (const char of secret) {
    value = (value << 5) | alphabet.indexOf(char)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 255)
      value &= (1 << bits) - 1
    }
  }
  const key = await crypto.subtle.importKey('raw', new Uint8Array(bytes), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const counter = new ArrayBuffer(8)
  new DataView(counter).setBigUint64(0, BigInt(Math.floor(time / stepMs)))
  const hash = new DataView(await crypto.subtle.sign('HMAC', key, counter))
  const offset = hash.getUint8(hash.byteLength - 1) & 15
  return String((hash.getUint32(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}

export async function findTotpStep(secret: string, code: string, time = Date.now()) {
  if (!/^[0-9]{6}$/.test(code)) return null
  const step = Math.floor(time / stepMs)
  for (const candidate of [step, step - 1, step + 1]) {
    if (candidate >= 0 && await totpCode(secret, candidate * stepMs) === code) return candidate
  }
  return null
}
