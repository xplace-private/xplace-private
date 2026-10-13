import type { ApiClient } from '../../../shared/api/api-client'
import type {
  PrivateBalance,
  PrivateBalanceGateway,
  PrivateOverdueBalance,
} from './private-balance-gateway'

const FAILURE = {
  ok: false as const,
  code: 'private-balance-failed',
  message: 'Unable to load balance. Try again.',
}

export function createHttpPrivateBalanceGateway(
  apiClient: ApiClient,
): PrivateBalanceGateway {
  return {
    async get(signal) {
      try {
        const balance = readPrivateBalance(
          await apiClient.request('cards/private/balance/', {
            authenticated: true,
            signal,
          }),
        )
        return balance === null ? FAILURE : { ok: true, data: balance }
      } catch {
        return FAILURE
      }
    },
  }
}

function readPrivateBalance(value: unknown): PrivateBalance | null {
  if (!isRecord(value)) return null
  const availableToSpendCents = readCents(value.available_to_spend)
  const spentThisPeriodCents = readCents(value.spent_this_period)
  const dueThisPeriodCents = readCents(value.due_this_period)
  // Older deployments do not expose total debt; keep it explicitly unknown.
  const outstandingDebtCents = value.outstanding_debt === undefined || value.outstanding_debt === null
    ? null : readCents(value.outstanding_debt)
  const dueDate = readNullableDate(value.due_date)
  if (
    availableToSpendCents === null ||
    spentThisPeriodCents === null ||
    dueThisPeriodCents === null ||
    (value.outstanding_debt !== undefined && value.outstanding_debt !== null &&
      (outstandingDebtCents === null || outstandingDebtCents < 0)) ||
    dueDate === false ||
    !Array.isArray(value.overdue)
  ) {
    return null
  }

  const overdue: PrivateOverdueBalance[] = []
  for (const item of value.overdue) {
    const parsed = readOverdue(item)
    if (parsed === null) return null
    overdue.push(parsed)
  }

  return { availableToSpendCents, spentThisPeriodCents, dueThisPeriodCents, outstandingDebtCents, dueDate, overdue }
}

function readOverdue(value: unknown): PrivateOverdueBalance | null {
  if (!isRecord(value)) return null
  const dueDate = readDate(value.due_date)
  const amountCents = readCents(value.amount)
  return dueDate === null || amountCents === null || typeof value.closed !== 'boolean'
    ? null
    : { dueDate, amountCents, closed: value.closed }
}

function readCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^-?\d+\.\d{2}$/.test(value)) return null
  const cents = Number(value.replace('.', ''))
  return Number.isSafeInteger(cents) ? cents : null
}

function readNullableDate(value: unknown): string | null | false {
  return value === null ? null : readDate(value) ?? false
}

function readDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
    ? value
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
