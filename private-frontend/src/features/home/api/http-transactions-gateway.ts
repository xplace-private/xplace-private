import type { ApiClient } from '../../../shared/api/api-client'
import { appI18n } from '../../../shared/i18n/app-i18n'
import type {
  DeclineReasonCategory,
  Transaction,
  TransactionsPage,
  TransactionState,
} from '../model/transaction'
import type { TransactionsGateway, TransactionsListInput } from './transactions-gateway'

const LIST_FAILURE = {
  ok: false as const,
  code: 'transactions-failed',
  message: 'Unable to load transactions. Try again.',
}

export function createHttpTransactionsGateway(apiClient: ApiClient): TransactionsGateway {
  return {
    async list(input) {
      try {
        const page = readListResponse(
          await apiClient.request(buildListPath(input), {
            authenticated: true,
            ...(input.signal === undefined ? {} : { signal: input.signal }),
          }),
        )
        return page === null ? LIST_FAILURE : { ok: true, data: page }
      } catch {
        return LIST_FAILURE
      }
    },
  }
}

function buildListPath(input: TransactionsListInput): string {
  const params = new URLSearchParams()
  params.set('page', String(input.page))
  params.set('page_size', String(input.pageSize))
  if (input.period !== undefined) {
    params.set('year', String(input.period.year))
    params.set('month', String(input.period.month))
  }
  return `cards/private/transactions/?${params.toString()}`
}

function readListResponse(value: unknown): TransactionsPage | null {
  if (!isRecord(value)) return null
  const { count, next, previous, results } = value
  if (!isNonNegativeInteger(count) || !Array.isArray(results) || count < results.length) return null
  if (next !== null && typeof next !== 'string') return null
  if (previous !== null && typeof previous !== 'string') return null
  const nextPage = readNextPage(next)
  if (next !== null && nextPage === null) return null
  const summary = readSummary(value.summary)
  if (summary === null) return null

  const transactions: Transaction[] = []
  for (const result of results) {
    const transaction = readTransaction(result)
    if (transaction === null) return null
    transactions.push(transaction)
  }

  return {
    count,
    nextPage,
    transactions,
    summary,
  }
}

function readSummary(value: unknown): TransactionsPage['summary'] | null {
  if (!isRecord(value)) return null
  const { year, month, transaction_count: transactionCount } = value
  const totalSpent = readDecimal(value.total_spent)
  const dueDate = readDateOnly(value.due_date)
  if (
    typeof year !== 'number' ||
    !Number.isSafeInteger(year) ||
    year < 1 ||
    typeof month !== 'number' ||
    !Number.isSafeInteger(month) ||
    month < 1 ||
    month > 12 ||
    !isNonNegativeInteger(transactionCount) ||
    totalSpent === null ||
    dueDate === null
  ) {
    return null
  }
  return {
    year,
    month,
    transactionCount,
    totalSpentCents: Number(totalSpent.replace('.', '')),
    dueDate,
  }
}

function readTransaction(value: unknown): Transaction | null {
  if (!isRecord(value)) return null
  const id = readNonEmptyString(value.id)
  const source = readNonEmptyString(value.source)
  const type = readNonEmptyString(value.type)
  const detailsType = readNonEmptyString(value.details_type)
  const detailsId = readNonEmptyString(value.details_id)
  const currency = readNonEmptyString(value.currency)?.toUpperCase() ?? null
  const timestamp = readDate(value.timestamp)
  const createdAt = readDate(value.created_at)
  const amount = readDecimal(value.amount)
  const rawState = readNonEmptyString(value.status)
  if (
    id === null ||
    source === null ||
    type === null ||
    detailsType === null ||
    detailsId === null ||
    currency === null ||
    amount === null ||
    rawState === null ||
    timestamp === null ||
    createdAt === null ||
    typeof value.is_credit !== 'boolean'
  ) {
    return null
  }

  const localAmount = readNullableDecimal(value.local_currency_amount)
  const localCurrency = readNullableString(value.local_currency)
  const cardLastFour = readNullableString(value.card_last4)
  if (localAmount === false || localCurrency === false || cardLastFour === false) return null

  const state: TransactionState =
    type === 'refund' && rawState === 'completed' ? 'refunded' : rawState
  const merchant = readNullableString(value.merchant_name)
  const category = readNullableString(value.merchant_category)
  const location = readNullableString(value.location)
  const declineReasonCategory = readDeclineReasonCategory(value.decline_reason_category)
  if (merchant === false || category === false || location === false) return null

  return {
    id,
    source,
    type,
    isCredit: value.is_credit,
    merchant: type === 'top_up' ? 'Payment received' : type === 'physical_card' ? 'Physical Card' : merchant,
    details: formatListDate(timestamp),
    amount: formatDecimalCurrency(currency, amount),
    amountCents: Number(amount.replace('.', '')),
    currency,
    ...(typeof localAmount === 'string' && typeof localCurrency === 'string'
      && (currency !== 'USD' || localCurrency.toUpperCase() !== 'USD')
      ? { convertedAmount: formatDecimalCurrency(localCurrency.toUpperCase(), localAmount) }
      : {}),
    state,
    category,
    date: formatDetailDate(timestamp),
    location,
    declineReasonCategory,
    card: cardLastFour === null ? null : `•••• ${cardLastFour}`,
    rate: null,
  }
}

function readDeclineReasonCategory(value: unknown): DeclineReasonCategory | null {
  switch (value) {
    case 'insufficient_funds':
    case 'limits':
    case 'blocked_merchant':
    case 'incorrect_card_data':
    case 'try_again':
      return value
    default:
      return null
  }
}

function readNextPage(value: string | null): number | null {
  if (value === null) return null
  try {
    const page = Number(new URL(value).searchParams.get('page'))
    return Number.isSafeInteger(page) && page > 0 ? page : null
  } catch {
    return null
  }
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function readDateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day
    ? value
    : null
}

function formatListDate(date: Date): string {
  const locale = displayLocale('en-GB')
  const day = date.toLocaleDateString(locale, { day: 'numeric', timeZone: 'UTC' })
  const month = date.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })
  return `${day} ${month} · ${formatTime(date)}`
}

function formatDetailDate(date: Date): string {
  const datePart = date.toLocaleDateString(displayLocale('en-GB'), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${datePart}, ${formatTime(date)}`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(displayLocale('en-GB'), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
}

function displayLocale(englishLocale: string): string {
  return appI18n.resolvedLanguage === 'en'
    ? englishLocale
    : appI18n.resolvedLanguage ?? englishLocale
}

function formatDecimalCurrency(currency: string, amount: string): string {
  const [integer = '0', fraction = ''] = amount.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${currency} ${grouped}.${fraction}`
}

function readDecimal(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d+\.\d{2}$/.test(value)) return null
  const cents = Number(value.replace('.', ''))
  return Number.isSafeInteger(cents) ? value : null
}

function readNullableDecimal(value: unknown): string | null | false {
  if (value === null) return null
  return readDecimal(value) ?? false
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readNullableString(value: unknown): string | null | false {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return false
  return value.trim().length > 0 ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
