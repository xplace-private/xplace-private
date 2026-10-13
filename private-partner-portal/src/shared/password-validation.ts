/** Checks observable password rules; the server also rejects common and current passwords. */
export function isValidPassword(password: string): boolean {
  return Array.from(password).length >= 8 && !/^\p{Decimal_Number}+$/u.test(password)
}
