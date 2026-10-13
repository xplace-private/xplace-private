import { describe, expect, test, vi } from 'vitest'

import type { SubmitApplicantInput } from './onboarding-gateway'
import { createHttpOnboardingGateway } from './http-onboarding-gateway'

const input: SubmitApplicantInput = {
  occupation: { id: 11, name: 'Accountant' },
  yearlyIncome: 'USD 50,000 – 100,000',
  monthlySpend: 'USD 1,000 – 5,000',
  accountPurpose: 'Personal spending',
}

describe('createHttpOnboardingGateway', () => {
  test('loads and validates the agreements returned for the current user', async () => {
    const request = vi.fn().mockResolvedValue([
      {
        agreement_type: 'e_sign_consent',
        agreement_name: 'E-sign Consent',
        accepted: false,
        document_version: null,
        accepted_at: null,
      },
      {
        agreement_type: 'account_opening_privacy',
        agreement_name: 'Account Opening Privacy Notice',
        accepted: true,
        document_version: 'v2',
        accepted_at: '2026-08-31T10:20:30Z',
      },
    ])
    const gateway = createHttpOnboardingGateway(
      { request: vi.fn() },
      { request },
    )

    await expect(gateway.listAgreements()).resolves.toEqual({
      ok: true,
      data: [
        {
          agreementType: 'e_sign_consent',
          agreementName: 'E-sign Consent',
          accepted: false,
          documentVersion: null,
          acceptedAt: null,
        },
        {
          agreementType: 'account_opening_privacy',
          agreementName: 'Account Opening Privacy Notice',
          accepted: true,
          documentVersion: 'v2',
          acceptedAt: '2026-08-31T10:20:30Z',
        },
      ],
    })
    expect(request).toHaveBeenCalledWith('cards/agreements/accept-all/', {
      authenticated: true,
      signal: undefined,
    })
  })

  test('rejects a malformed agreements response', async () => {
    const gateway = createHttpOnboardingGateway(
      { request: vi.fn() },
      {
        request: () =>
          Promise.resolve([
            {
              agreement_type: 'e_sign_consent',
              agreement_name: 'E-sign Consent',
              accepted: 'no',
              document_version: null,
              accepted_at: null,
            },
          ]),
      },
    )

    await expect(gateway.listAgreements()).resolves.toEqual({
      ok: false,
      code: 'agreements-failed',
      message: 'Unable to load agreements. Try again.',
    })
  })

  test('accepts every agreement returned by the API after saving the applicant', async () => {
    const applicantRequest = vi.fn().mockResolvedValue({})
    const agreementsRequest = vi.fn().mockResolvedValue([])
    const gateway = createHttpOnboardingGateway(
      { request: applicantRequest },
      { request: agreementsRequest },
    )

    await expect(
      gateway.submitApplicant(input, [
        {
          agreementType: 'e_sign_consent',
          agreementName: 'E-sign Consent',
          accepted: false,
          documentVersion: null,
          acceptedAt: null,
        },
        {
          agreementType: 'account_opening_privacy',
          agreementName: 'Account Opening Privacy Notice',
          accepted: true,
          documentVersion: 'v2',
          acceptedAt: '2026-08-31T10:20:30Z',
        },
      ]),
    ).resolves.toEqual({ ok: true })
    expect(agreementsRequest).toHaveBeenCalledWith(
      'cards/agreements/accept-all/',
      {
        authenticated: true,
        method: 'POST',
        retry: false,
        json: {
          agreements: [
            {
              agreement_type: 'e_sign_consent',
              document_version: 'v1',
            },
            {
              agreement_type: 'account_opening_privacy',
              document_version: 'v2',
            },
          ],
        },
      },
    )
    expect(applicantRequest.mock.invocationCallOrder[0]).toBeLessThan(
      agreementsRequest.mock.invocationCallOrder[0] ?? 0,
    )
  })

  test.each([
    ['Personal spending', 'personal'],
    ['Business expenses', 'business'],
    ['Investments', 'investments'],
    ['Something else', 'other'],
  ] as const)('submits %s with the API purpose %s', async (accountPurpose, purpose) => {
    const request = vi.fn().mockResolvedValue({})
    const gateway = createHttpOnboardingGateway({ request })

    await expect(
      gateway.submitApplicant({ ...input, accountPurpose }, []),
    ).resolves.toEqual({ ok: true })
    expect(request).toHaveBeenCalledWith('cards/applicant/', {
      authenticated: true,
      method: 'POST',
      retry: false,
      json: {
        occupation: 11,
        salary: 'USD 50,000 – 100,000',
        volume: 'USD 1,000 – 5,000',
        purpose,
      },
    })
  })

  test('returns a generic failure when the request rejects', async () => {
    const gateway = createHttpOnboardingGateway({
      request: () => Promise.reject(new Error('backend detail')),
    })

    await expect(gateway.submitApplicant(input, [])).resolves.toEqual({
      ok: false,
      code: 'applicant-submit-failed',
      message: 'Something went wrong. Please try again.',
    })
  })
})
