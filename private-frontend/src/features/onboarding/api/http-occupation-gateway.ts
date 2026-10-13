import type { ApiClient } from '../../../shared/api/api-client'
import type { Occupation } from '../model/onboarding-flow'

import type { OccupationGateway } from './occupation-gateway'

const FAILURE = {
  ok: false as const,
  code: 'occupations-failed',
  message: 'Unable to load occupations. Try again.',
}

export function createHttpOccupationGateway(apiClient: ApiClient): OccupationGateway {
  return {
    async list(search, signal) {
      const normalizedSearch = search.trim()
      const searchParameter =
        normalizedSearch === ''
          ? ''
          : `&search=${encodeURIComponent(normalizedSearch)}`

      try {
        const occupations = readOccupations(
          await apiClient.request(
            `cards/occupations/?limit=100${searchParameter}`,
            { authenticated: true, signal },
          ),
        )

        return occupations === null ? FAILURE : { ok: true, data: occupations }
      } catch {
        return FAILURE
      }
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isOptionalPageUrl(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function readOccupations(value: unknown): readonly Occupation[] | null {
  if (!isRecord(value)) return null

  const { count, next, previous, results } = value
  if (
    typeof count !== 'number' ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    !isOptionalPageUrl(next) ||
    !isOptionalPageUrl(previous) ||
    !Array.isArray(results)
  ) {
    return null
  }

  const occupations: Occupation[] = []

  for (const category of results) {
    if (!isRecord(category)) return null

    const { id, name, occupations: categoryOccupations } = category
    if (
      !isPositiveInteger(id) ||
      typeof name !== 'string' ||
      name.trim() === '' ||
      !Array.isArray(categoryOccupations)
    ) {
      return null
    }

    for (const occupation of categoryOccupations) {
      if (!isRecord(occupation)) return null

      const { id: occupationId, name: occupationName } = occupation
      if (
        !isPositiveInteger(occupationId) ||
        typeof occupationName !== 'string' ||
        occupationName.trim() === ''
      ) {
        return null
      }

      occupations.push({ id: occupationId, name: occupationName })
    }
  }

  return occupations
}
