import type { ApiClient } from '../../../shared/api/api-client'
import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { AccountPurpose } from '../model/onboarding-flow'

import type {
  Agreement,
  OnboardingGateway,
  SubmitApplicantInput,
} from './onboarding-gateway'

const FAILURE: GatewayResult = {
  ok: false,
  code: 'applicant-submit-failed',
  message: 'Something went wrong. Please try again.',
}

const AGREEMENTS_FAILURE = {
  ok: false as const,
  code: 'agreements-failed',
  message: 'Unable to load agreements. Try again.',
}

// ponytail: GET has no current version for unaccepted documents; replace this when the API exposes one.
const DEFAULT_AGREEMENT_DOCUMENT_VERSION = 'v1'

function toApiPurpose(value: AccountPurpose) {
  switch (value) {
    case 'Personal spending':
      return 'personal'
    case 'Business expenses':
      return 'business'
    case 'Investments':
      return 'investments'
    case 'Something else':
      return 'other'
  }
}

export function createHttpOnboardingGateway(
  apiClient: ApiClient,
  agreementsApiClient: ApiClient = apiClient,
): OnboardingGateway {
  return {
    async listAgreements(signal) {
      try {
        const agreements = readAgreements(
          await agreementsApiClient.request('cards/agreements/accept-all/', {
            authenticated: true,
            signal,
          }),
        )

        return agreements === null
          ? AGREEMENTS_FAILURE
          : { ok: true, data: agreements }
      } catch {
        return AGREEMENTS_FAILURE
      }
    },
    async submitApplicant(input: SubmitApplicantInput, agreements) {
      try {
        await apiClient.request('cards/applicant/', {
          authenticated: true,
          method: 'POST',
          retry: false,
          json: {
            occupation: input.occupation.id,
            salary: input.yearlyIncome,
            volume: input.monthlySpend,
            purpose: toApiPurpose(input.accountPurpose),
          },
        })
        await agreementsApiClient.request('cards/agreements/accept-all/', {
          authenticated: true,
          method: 'POST',
          retry: false,
          json: {
            agreements: agreements.map((agreement) => ({
              agreement_type: agreement.agreementType,
              document_version:
                agreement.documentVersion ?? DEFAULT_AGREEMENT_DOCUMENT_VERSION,
            })),
          },
        })
        return { ok: true }
      } catch {
        return FAILURE
      }
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readAgreements(value: unknown): readonly Agreement[] | null {
  if (!Array.isArray(value)) return null

  const agreements: Agreement[] = []
  for (const agreement of value) {
    if (!isRecord(agreement)) return null

    const {
      agreement_type: agreementType,
      agreement_name: agreementName,
      accepted,
      document_version: documentVersion,
      accepted_at: acceptedAt,
    } = agreement
    if (
      typeof agreementType !== 'string' ||
      agreementType.trim() === '' ||
      typeof agreementName !== 'string' ||
      agreementName.trim() === '' ||
      typeof accepted !== 'boolean' ||
      (documentVersion !== null && typeof documentVersion !== 'string') ||
      (acceptedAt !== null && typeof acceptedAt !== 'string')
    ) {
      return null
    }

    agreements.push({
      agreementType,
      agreementName,
      accepted,
      documentVersion,
      acceptedAt,
    })
  }

  return agreements
}
