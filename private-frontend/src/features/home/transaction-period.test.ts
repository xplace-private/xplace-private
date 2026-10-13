import { expect, test } from 'vitest'

import {
  currentTransactionPeriod,
  transactionPeriodsSince,
} from './transaction-period'

test('builds every calendar month from the earliest card through the current month', () => {
  const now = new Date(2026, 8, 3)

  expect(transactionPeriodsSince(new Date(2026, 6, 20), now)).toEqual([
    { year: 2026, month: 9 },
    { year: 2026, month: 8 },
    { year: 2026, month: 7 },
  ])
  expect(currentTransactionPeriod(now)).toEqual({ year: 2026, month: 9 })
})

test('crosses year boundaries and keeps only current month for an unknown date', () => {
  const now = new Date(2026, 1, 2)

  expect(transactionPeriodsSince(new Date(2025, 11, 31), now)).toEqual([
    { year: 2026, month: 2 },
    { year: 2026, month: 1 },
    { year: 2025, month: 12 },
  ])
  expect(transactionPeriodsSince(undefined, now)).toEqual([
    { year: 2026, month: 2 },
  ])
})
