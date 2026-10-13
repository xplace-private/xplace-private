import type { ApiClient } from '../../../shared/api/api-client'
import type { BankDeposit, BankInstructions, CryptoDeposit, CryptoInstructions, DepositChannels, DepositsGateway } from './deposits-gateway'

const FAILURE = {
  ok: false as const,
  code: 'deposits-failed',
  message: 'Unable to load bank details. Try again.',
}

export function createHttpDepositsGateway(apiClient: ApiClient): DepositsGateway {
  return {
    async list(signal) {
      try {
        const deposits = readDeposits(
          await apiClient.request('transfers/deposits/', {
            authenticated: true,
            retry: false,
            signal,
          }),
        )
        return deposits === null ? FAILURE : { ok: true, data: deposits }
      } catch {
        return FAILURE
      }
    },
  }
}

function readDeposits(value: unknown): DepositChannels | null {
  if (!Array.isArray(value)) return null
  const bank: BankDeposit[] = []
  const crypto: CryptoDeposit[] = []
  for (const row of value) {
    if (
      !isRecord(row) ||
      typeof row.provider !== 'string' ||
      typeof row.target_currency !== 'string'
    ) continue
    if ((row.provider !== 'iron' && row.provider !== 'bridge') || row.target_currency !== 'usdc') continue
    if (
      typeof row.id !== 'string' || row.id.trim() === '' ||
      typeof row.status !== 'string' ||
      typeof row.accepts_third_party_deposits !== 'boolean'
    ) continue

    const raw = row.deposit_instructions
    if (raw !== null && !isRecord(raw)) continue
    const sourceCurrency = readNullableString(row.source_currency)
    if (sourceCurrency === false) continue
    if (
      row.provider === 'bridge' && raw !== null &&
      raw.payment_rail !== 'swift' && raw.payment_rail !== 'crypto'
    ) continue
    const bankRail = raw !== null &&
      (raw.payment_rail === 'ach' || raw.payment_rail === 'wire' || raw.payment_rail === 'swift')
    if (
      sourceCurrency === 'usd' || (sourceCurrency === null && bankRail) ||
      (sourceCurrency === 'eur' && (raw === null || raw.payment_rail === 'sepa' || raw.payment_rail === 'swift'))
    ) {
      if (sourceCurrency === 'usd' && raw?.payment_rail === 'sepa') continue
      const instructions = raw === null ? null : readInstructions(raw)
      if (raw !== null && instructions === null) continue
      bank.push({
        id: row.id,
        status: row.status,
        sourceCurrency,
        acceptsThirdPartyDeposits: row.accepts_third_party_deposits,
        instructions,
      })
    } else if (sourceCurrency === 'usdc') {
      const instructions = raw === null ? null : readCryptoInstructions(raw)
      if (raw !== null && instructions === null) continue
      crypto.push({ id: row.id, status: row.status, instructions })
    }
  }
  return { bank, crypto }
}

function readCryptoInstructions(value: Record<string, unknown>): CryptoInstructions | null {
  if (
    value.payment_rail !== 'crypto' || value.type !== 'Ethereum' ||
    typeof value.address !== 'string' || value.address.trim() === ''
  ) return null
  return { address: value.address, asset: 'USDC', network: 'ERC-20' }
}

function readInstructions(value: Record<string, unknown>): BankInstructions | null {
  const {
    payment_rail, beneficiary_name, beneficiary_address,
    account_number, routing_number, bank_name, bank_address,
  } = value
  if (payment_rail === 'swift' || payment_rail === 'sepa') {
    const swiftBeneficiaryName = readNullableString(beneficiary_name)
    const swiftBeneficiaryAddress = readNullableString(beneficiary_address)
    const swiftBankName = readNullableString(bank_name)
    const swiftBankAddress = readNullableString(bank_address)
    const iban = readNullableString(value.iban)
    const bic = readNullableString(value.bic)
    const reference = readNullableString(value.reference)
    const swiftAccountNumber = readNullableString(account_number)
    if (
      swiftBeneficiaryName === false || swiftBeneficiaryAddress === false ||
      swiftBankName === false || swiftBankAddress === false ||
      iban === false || bic === false || reference === false || swiftAccountNumber === false
    ) return null
    if (payment_rail === 'sepa') {
      if (typeof beneficiary_name !== 'string' || typeof value.iban !== 'string') return null
      return {
        paymentRail: 'sepa',
        beneficiaryName: beneficiary_name,
        beneficiaryAddress: swiftBeneficiaryAddress,
        iban: value.iban,
        bic,
        bankName: swiftBankName,
        bankAddress: swiftBankAddress,
        reference,
      }
    }
    return {
      paymentRail: 'swift',
      beneficiaryName: swiftBeneficiaryName,
      beneficiaryAddress: swiftBeneficiaryAddress,
      accountNumber: swiftAccountNumber,
      iban,
      bic,
      bankName: swiftBankName,
      bankAddress: swiftBankAddress,
      reference,
    }
  }
  if (
    (payment_rail !== 'ach' && payment_rail !== 'wire') ||
    typeof beneficiary_name !== 'string' ||
    typeof account_number !== 'string' ||
    typeof routing_number !== 'string' ||
    !isNullableString(beneficiary_address) ||
    !isNullableString(bank_name) ||
    !isNullableString(bank_address)
  ) return null
  return {
    paymentRail: payment_rail,
    beneficiaryName: beneficiary_name,
    beneficiaryAddress: beneficiary_address,
    accountNumber: account_number,
    routingNumber: routing_number,
    bankName: bank_name,
    bankAddress: bank_address,
  }
}

function readNullableString(value: unknown): string | null | false {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value : false
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
