import { describe, expect, test, vi } from 'vitest'

import { ApiRequestError } from '../../../shared/api/api-client'
import { createHttpApplicantGateway } from './http-applicant-gateway'

const response = {
  applicant: {
    id: 41,
    last_name: 'Morgan',
    gender: 'female',
    sumsub_id: 'sumsub-41',
    status: 'pending',
    admin_review_status: 'pending',
    rain_approved: false,
    rain_status: 'manualReview',
  },
  cards: [],
  kyc_link: null,
}

const failure = {
  ok: false,
  code: 'applicant-failed',
  message: 'Unable to load applicant. Try again.',
}

describe('createHttpApplicantGateway', () => {
  test('loads the nested authenticated applicant and forwards the abort signal', async () => {
    const signal = new AbortController().signal
    const request = vi.fn().mockResolvedValue(response)

    await expect(createHttpApplicantGateway({ request }).get(signal)).resolves.toEqual({
      ok: true,
      data: {
        id: 41,
        lastName: 'Morgan',
        gender: 'female',
        sumsubId: 'sumsub-41',
        status: 'pending',
        adminReviewStatus: 'pending',
        rainApproved: false,
        rainStatus: 'manualReview',
      },
    })
    expect(request).toHaveBeenCalledWith('cards/applicant/detail/', {
      authenticated: true,
      retry: false,
      signal,
    })
  })

  test('maps only an HTTP 404 to an absent applicant', async () => {
    const gateway = createHttpApplicantGateway({
      request: () =>
        Promise.reject(new ApiRequestError('http', 404, null, 'Request failed')),
    })

    await expect(gateway.get()).resolves.toEqual({ ok: true, data: null })
  })

  test('preserves a missing applicant gender as null', async () => {
    const request = vi.fn().mockResolvedValue({
      ...response,
      applicant: { ...response.applicant, gender: null },
    })

    await expect(createHttpApplicantGateway({ request }).get()).resolves.toMatchObject({
      ok: true,
      data: { gender: null },
    })
  })

  test('returns a safe failure when the request rejects for a network error', async () => {
    const gateway = createHttpApplicantGateway({
      request: () => Promise.reject(new Error('network unavailable')),
    })

    await expect(gateway.get()).resolves.toEqual(failure)
  })

  test.each([
    ['Sumsub status', { status: 'unknown' }],
    ['admin review status', { admin_review_status: 'unknown' }],
    ['Rain status', { rain_status: 'unknown' }],
    ['gender', { gender: 'unknown' }],
  ])('returns a safe failure for an unsupported %s', async (_field, applicant) => {
    const gateway = createHttpApplicantGateway({
      request: () => Promise.resolve({ ...response, applicant: { ...response.applicant, ...applicant } }),
    })

    await expect(gateway.get()).resolves.toEqual(failure)
  })

  test('returns a safe failure when the nested applicant is missing', async () => {
    const gateway = createHttpApplicantGateway({
      request: () => Promise.resolve({ cards: [], kyc_link: null }),
    })

    await expect(gateway.get()).resolves.toEqual(failure)
  })
})

test('reads applicant first name for physical-card orders', async () => {
  const request = vi.fn().mockResolvedValue({ ...response, applicant: { ...response.applicant, first_name: 'Jane' } })
  await expect(createHttpApplicantGateway({ request }).get()).resolves.toMatchObject({ ok: true, data: { firstName: 'Jane', lastName: 'Morgan' } })
})
