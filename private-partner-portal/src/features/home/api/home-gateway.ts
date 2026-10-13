import type { GatewayResult } from '../../../shared/api/gateway-result'

export const clientStatuses = ['active', 'onboarding', 'partner-review', 'limit-review', 'overdue', 'suspended', 'offboarding-pending', 'closed', 'contact-support'] as const

export type ClientStatus = typeof clientStatuses[number]
export const clientFilterStatuses = ['active', 'onboarding', 'limit-review', 'overdue', 'suspended'] as const
export type ClientFilterStatus = typeof clientFilterStatuses[number]
export type ClientCounts = Record<ClientFilterStatus | 'all', number> & Partial<Record<ClientStatus, number>>

export interface ClientPaymentRail {
  type: 'wire' | 'ach' | 'sepa' | 'swift'
  currency: 'USD' | 'EUR'
  thirdPartyAllowed: boolean | null
  fields: { name: 'identity' | 'accountName' | 'beneficiaryAddress' | 'bank' | 'bankAddress' | 'accountNumber' | 'routingNumber' | 'iban' | 'bic' | 'swift' | 'reference'; value: string }[]
}

export interface ClientPaymentDetails {
  /** API details still use approved fixtures for due date, policy, crypto and proof email. */
  source: 'api' | 'mock'
  currency: string
  statementOwed: number | null
  dueDate: string | null
  unpaidBalance: number | null
  amountToPay: number | null
  suspensionDate: string | null
  balanceAsOf: string | null
  monthlyLateFeePercent: number | null
  minimumLateFee: number | null
  bankRails: ClientPaymentRail[]
  eur: { usdRate: number | null; statementOwed: number | null } | null
  crypto: { depositAddress: string } | null
  proofEmail: string | null
}

export interface PartnerClient {
  id: string
  clientRef?: string | null
  email: string | null
  phone: string | null
  name: string | null
  registeredAt: string | null
  closedAt: string | null
  status: ClientStatus
  paymentDetails: ClientPaymentDetails | null
  partnerReviewDetails: { investableAssets: number; cashAssets: number; fileName: string; fileSize: number } | null
}

export interface ClientsQuery {
  search: string
  status: ClientStatus | 'all'
  page: number
  pageSize: number
}

export interface ClientsPage {
  items: PartnerClient[]
  total: number
  page: number
  pageSize: number
  /** Counts match search before applying the selected status. */
  counts: ClientCounts
}

export interface MonthlyVolume {
  month: string
  spend: number | null
  commission: number | null
}

export interface HomeOverview {
  partnerName: string | null
  currency: string
  spend: number | null
  commission: number | null
  availablePayout: number | null
  purchases: number | null
  completedPurchases: number | null
  pendingPurchases: number | null
  averagePurchase: number | null
  activeClients: number | null
  overdueClients: number | null
  suspendedClients: number | null
  monthly: MonthlyVolume[]
  commissionMonthly?: MonthlyVolume[]
}

/** HTTP adapters own response validation, safe failures and session expiry handling. */
export interface HomeGateway {
  getOverview(signal: AbortSignal): Promise<HomeOverview>
  getClients(query: ClientsQuery, signal: AbortSignal): Promise<ClientsPage>
  getClient(id: string, signal: AbortSignal): Promise<PartnerClient>
  uploadAumConfirmation(file: File, signal: AbortSignal, onProgress: (percent: number) => void): Promise<GatewayResult>
  submitPartnerReview(input: { clientId: string; investableAssets: number; cashAssets: number; file: File; confirmed: boolean }, signal: AbortSignal): Promise<GatewayResult>
}

export class HomeSessionError extends Error {
  constructor() {
    super('The dashboard requires a valid full session')
    this.name = 'HomeSessionError'
  }
}

export class ClientNotFoundError extends Error {
  constructor() {
    super('The client is unavailable')
    this.name = 'ClientNotFoundError'
  }
}
