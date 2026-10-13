import type { ApiClient } from '../../../shared/api/api-client'
import type { EurDebtGateway, EurDebtQuote } from './eur-debt-gateway'

const FAILURE = {
  ok: false as const,
  code: 'eur-debt-failed',
  message: 'Unable to load the EUR payment quote. Try again.',
}

export function createHttpEurDebtGateway(apiClient: ApiClient): EurDebtGateway {
  return {
    async get(signal) {
      try {
        const quote = readQuote(await apiClient.request('cards/private/eur-debt/', {
          authenticated: true,
          signal,
        }))
        return quote === null ? FAILURE : { ok: true, data: quote }
      } catch {
        return FAILURE
      }
    },
  }
}

function readQuote(value: unknown): EurDebtQuote | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  if (!('fx_rate' in value) || !('amount_eur' in value) || !('amount_usd' in value)) return null
  const { fx_rate, amount_eur, amount_usd } = value
  const amountEurCents = readCents(amount_eur)
  const amountUsdCents = readCents(amount_usd)
  if (
    typeof fx_rate !== 'string' || !/^\d{1,12}\.\d{8}$/.test(fx_rate) || Number(fx_rate) <= 0 ||
    amountEurCents === null || amountUsdCents === null
  ) return null
  return { fxRate: fx_rate, amountEurCents, amountUsdCents }
}

function readCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{1,10}\.\d{2}$/.test(value)) return null
  const cents = Number(value.replace('.', ''))
  return Number.isSafeInteger(cents) ? cents : null
}
