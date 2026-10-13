/** Transfer details of the mock payment gateway (src/features/home/api/mock-home-gateway.ts), as label and value rows. */
export const USD_TRANSFER = [
  ['Account name', 'Name Client'],
  ['Bank', 'Emirates NBD'],
  ['IBAN', 'AE070331234567890123456'],
  ['SWIFT', 'EBILEAD'],
] as const

export const EUR_TRANSFER = [
  ['Identity', 'Pontech Group L.L.C-FZ'],
  ['Bank', 'Emirates NBD'],
  ['IBAN', '110987654321'],
  ['BIC', 'SP29NWBK60161331926819'],
  ['Reference', 'XP-4417-8825'],
] as const

export const DEPOSIT_ADDRESS = 'So1aNaXP1cePr1vAteDemo7yqW3kZ9mDepos7ADDRnotreal'
export const PROOF_EMAIL = 'example@gmail.com'
export const STATEMENT_OWED = 'USD 499.88'
export const DUE_DATE = '5 Sep'

export const PROOF_TITLE = 'After paying your statement balance, please send proof of payment to the email address below.'
export const PROOF_DESCRIPTION =
  'Our team will review the payment and proceed with the next steps to settle the outstanding balance and reactivate card.'

/** U+2014 (em dash): what the portal renders for a missing (null) value, e.g. in the payment modal and in closed-client texts. */
export const UNKNOWN = '\u2014'
