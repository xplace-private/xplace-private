export type TransactionState = string
export type TransactionSource = string
export type TransactionType = string
export type DeclineReasonCategory =
  | 'insufficient_funds'
  | 'limits'
  | 'blocked_merchant'
  | 'incorrect_card_data'
  | 'try_again'

export const KNOWN_TRANSACTION_TYPES: ReadonlySet<string> = new Set([
  'card',
  'refund',
  'top_up',
  'physical_card',
  'bridge_transfer',
  'bridge_deposit',
  'iron_transfer',
  'iron_deposit',
])

export interface Transaction {
  id: string
  source: TransactionSource
  type: TransactionType
  isCredit: boolean
  merchant: string | null
  details: string
  amount: string
  amountCents: number
  currency: string
  convertedAmount?: string
  state: TransactionState
  category: string | null
  date: string | null
  location: string | null
  declineReasonCategory: DeclineReasonCategory | null
  card: string | null
  rate: string | null
}

export interface TransactionsPage {
  count: number
  nextPage: number | null
  transactions: readonly Transaction[]
  summary: TransactionSummary
}

export interface TransactionSummary {
  year: number
  month: number
  transactionCount: number
  totalSpentCents: number
  dueDate: string
}
