export interface TransactionPeriod {
  year: number
  month: number
}

export function currentTransactionPeriod(now = new Date()): TransactionPeriod {
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function transactionPeriodsSince(
  createdAt: Date | undefined,
  now = new Date(),
): readonly TransactionPeriod[] {
  const current = currentTransactionPeriod(now)
  if (createdAt === undefined || createdAt > now) return [current]

  const periods: TransactionPeriod[] = []
  let { year, month } = current
  const first = createdAt.getFullYear() * 12 + createdAt.getMonth()
  while (year * 12 + month - 1 >= first) {
    periods.push({ year, month })
    month -= 1
    if (month === 0) {
      year -= 1
      month = 12
    }
  }
  return periods
}

export function isSameTransactionPeriod(
  left: TransactionPeriod,
  right: TransactionPeriod,
): boolean {
  return left.year === right.year && left.month === right.month
}
