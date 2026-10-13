export interface PaymentDetails {
  statement: {
    balance: string
    amountCents?: number | null
    loading?: boolean
    dateLoading?: boolean
    statementDate: string
  }
}
