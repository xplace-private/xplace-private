import type { GatewayResult } from '../../../shared/api/gateway-result'

interface BaseBankInstructions {
  beneficiaryAddress: string | null
  bankName: string | null
  bankAddress: string | null
}

export interface AchWireBankInstructions extends BaseBankInstructions {
  paymentRail: 'ach' | 'wire'
  beneficiaryName: string
  accountNumber: string
  routingNumber: string
}

export interface SwiftBankInstructions extends BaseBankInstructions {
  paymentRail: 'swift'
  beneficiaryName: string | null
  accountNumber: string | null
  iban: string | null
  bic: string | null
  reference: string | null
}

export interface SepaBankInstructions extends BaseBankInstructions {
  paymentRail: 'sepa'
  beneficiaryName: string
  iban: string
  bic: string | null
  reference: string | null
}

export type BankInstructions = AchWireBankInstructions | SwiftBankInstructions | SepaBankInstructions

export interface BankDeposit {
  id: string
  status: string
  sourceCurrency: string | null
  acceptsThirdPartyDeposits: boolean
  instructions: BankInstructions | null
}

export interface DepositsGateway {
  list(signal?: AbortSignal): Promise<GatewayResult<DepositChannels>>
}

export interface CryptoInstructions {
  address: string
  asset: 'USDC'
  network: 'ERC-20'
}

export interface CryptoDeposit {
  id: string
  status: string
  instructions: CryptoInstructions | null
}

export interface DepositChannels {
  bank: readonly BankDeposit[]
  crypto: readonly CryptoDeposit[]
}

export function isCryptoDepositReady(
  deposit: CryptoDeposit,
): deposit is CryptoDeposit & { instructions: CryptoInstructions } {
  return isReadyStatus(deposit.status) &&
    deposit.instructions !== null && deposit.instructions.address.trim() !== ''
}

export function isDepositReady(
  deposit: BankDeposit,
): deposit is BankDeposit & { instructions: BankInstructions } {
  const details = deposit.instructions
  if (!isReadyStatus(deposit.status) || details === null) return false
  if (details.paymentRail === 'swift') return true
  if (details.paymentRail === 'sepa') {
    return details.beneficiaryName.trim() !== '' && details.iban.trim() !== ''
  }
  return details.beneficiaryName.trim() !== '' &&
    details.accountNumber.trim() !== '' &&
    details.routingNumber.trim() !== ''
}

export function isDepositPending(deposit: BankDeposit): boolean {
  return deposit.status === 'Authorized' ||
    deposit.status === 'DepositAccountAdded' ||
    deposit.status === 'pending' ||
    (isReadyStatus(deposit.status) && !isDepositReady(deposit))
}

function isReadyStatus(status: string): boolean {
  return status === 'Approved' || status === 'activated' || status === 'active'
}
