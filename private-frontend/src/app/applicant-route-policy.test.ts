import { expect, test } from 'vitest'

import type { Applicant } from '../features/verification/model/applicant'
import { resolveApplicantRoute } from './applicant-route-policy'

const baseApplicant: Applicant = {
  id: 41,
  gender: null,
  sumsubId: 'sumsub-41',
  status: 'not_started',
  adminReviewStatus: 'not_required',
  rainApproved: false,
  rainStatus: 'pending',
}

function applicant(fields: Partial<Applicant>): Applicant {
  return { ...baseApplicant, ...fields }
}

test.each([
  ['missing applicant', '/', null, '/onboarding'],
  ['missing Sumsub identifier', '/home', applicant({ sumsubId: null }), '/onboarding'],
  ['blank Sumsub identifier', '/home', applicant({ sumsubId: '  ' }), '/onboarding'],
  ['Rain boolean alone', '/', applicant({ rainApproved: true }), '/verification'],
  [
    'completed verification',
    '/verification',
    applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
    '/home',
  ],
  [
    'pending admin review',
    '/',
    applicant({ status: 'approved', adminReviewStatus: 'pending', rainApproved: true }),
    '/verification',
  ],
  [
    'declined admin review',
    '/',
    applicant({ status: 'approved', adminReviewStatus: 'declined', rainApproved: true }),
    '/verification',
  ],
  ['pending Home', '/home', applicant({ status: 'pending' }), '/verification'],
  [
    'Rain-pending Home',
    '/home',
    applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainStatus: 'pending',
    }),
    '/verification',
  ],
  ['pending verification', '/verification', applicant({ status: 'pending' }), null],
  ['not-started Sumsub', '/verification/sumsub', applicant({}), null],
  ['pending Sumsub', '/verification/sumsub', applicant({ status: 'pending' }), '/verification'],
  [
    'approved transactions',
    '/transactions',
    applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
    null,
  ],
  [
    'approved payment',
    '/payment',
    applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
    null,
  ],
  [
    'approved onboarding',
    '/onboarding',
    applicant({
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    }),
    '/home',
  ],
  ['terminal Sumsub verification', '/verification', applicant({ status: 'rejected' }), null],
  ['terminal Sumsub embed', '/verification/sumsub', applicant({ status: 'rejected' }), '/verification'],
  ['terminal Rain verification', '/verification', applicant({ rainStatus: 'denied' }), null],
  ['terminal Rain embed', '/verification/sumsub', applicant({ rainStatus: 'denied' }), '/verification'],
] as const)('routes %s to the allowed destination', (_case, pathname, value, expected) => {
  expect(resolveApplicantRoute(pathname, value)).toBe(expected)
})
