import {
  isApiRequestError,
  type ApiClient,
} from '../../../shared/api/api-client'
import type {
  AdminReviewStatus,
  Applicant,
  RainApplicantStatus,
  SumsubApplicantStatus,
} from '../model/applicant'
import type { ApplicantGateway } from './applicant-gateway'

const FAILURE = {
  ok: false as const,
  code: 'applicant-failed' as const,
  message: 'Unable to load applicant. Try again.',
}

export function createHttpApplicantGateway(apiClient: ApiClient): ApplicantGateway {
  return {
    async get(signal) {
      try {
        const applicant = readApplicantResponse(
          await apiClient.request('cards/applicant/detail/', {
            authenticated: true,
            retry: false,
            signal,
          }),
        )

        return applicant === null ? FAILURE : { ok: true, data: applicant }
      } catch (error) {
        if (isApiRequestError(error) && error.status === 404) {
          return { ok: true, data: null }
        }

        return FAILURE
      }
    },
  }
}

function readApplicantResponse(value: unknown): Applicant | null {
  if (!isRecord(value)) return null

  return readApplicant(value.applicant)
}

function readApplicant(value: unknown): Applicant | null {
  if (!isRecord(value)) return null

  const {
    id,
    first_name: firstName,
    last_name: lastName,
    gender,
    sumsub_id: sumsubId,
    status,
    admin_review_status: adminReviewStatus,
    rain_approved: rainApproved,
    rain_status: rainStatus,
  } = value
  if (
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id < 0 ||
    (firstName !== undefined && firstName !== null && typeof firstName !== 'string') ||
    (lastName !== null && typeof lastName !== 'string') ||
    (gender !== null && gender !== 'male' && gender !== 'female') ||
    (sumsubId !== null && typeof sumsubId !== 'string') ||
    !isSumsubApplicantStatus(status) ||
    !isAdminReviewStatus(adminReviewStatus) ||
    typeof rainApproved !== 'boolean' ||
    !isRainApplicantStatus(rainStatus)
  ) {
    return null
  }

  return { id, ...(firstName === undefined ? {} : { firstName }), lastName, gender, sumsubId, status, adminReviewStatus, rainApproved, rainStatus }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSumsubApplicantStatus(value: unknown): value is SumsubApplicantStatus {
  return (
    value === 'not_started' ||
    value === 'pending' ||
    value === 'approved' ||
    value === 'temporary_rejected' ||
    value === 'rejected'
  )
}

function isAdminReviewStatus(value: unknown): value is AdminReviewStatus {
  return (
    value === 'not_required' ||
    value === 'pending' ||
    value === 'approved' ||
    value === 'declined'
  )
}

function isRainApplicantStatus(value: unknown): value is RainApplicantStatus {
  return (
    value === 'approved' ||
    value === 'pending' ||
    value === 'needsInformation' ||
    value === 'needsVerification' ||
    value === 'manualReview' ||
    value === 'denied' ||
    value === 'locked' ||
    value === 'canceled'
  )
}
