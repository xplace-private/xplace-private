import { expect, test } from 'vitest'

import {
  deriveVerificationViewState,
  type Applicant,
} from './applicant'

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
  [{ status: 'not_started', rainApproved: false, rainStatus: 'pending' }, false, 'continue'],
  [
    { status: 'temporary_rejected', rainApproved: false, rainStatus: 'pending' },
    false,
    'continue',
  ],
  [{ status: 'not_started', rainApproved: false, rainStatus: 'pending' }, true, 'under-review'],
  [{ status: 'pending', rainApproved: false, rainStatus: 'pending' }, false, 'under-review'],
  [
    {
      status: 'approved',
      adminReviewStatus: 'pending',
      rainApproved: true,
      rainStatus: 'approved',
    },
    false,
    'account-pending',
  ],
  [
    {
      status: 'approved',
      adminReviewStatus: 'declined',
      rainApproved: true,
      rainStatus: 'approved',
    },
    false,
    'rejected',
  ],
  [
    { status: 'temporary_rejected', adminReviewStatus: 'pending' },
    false,
    'continue',
  ],
  [{ status: 'rejected', adminReviewStatus: 'pending' }, false, 'rejected'],
  [
    {
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: false,
      rainStatus: 'pending',
    },
    false,
    'account-pending',
  ],
  [
    {
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: false,
      rainStatus: 'manualReview',
    },
    false,
    'account-pending',
  ],
  [{ status: 'rejected', rainApproved: false, rainStatus: 'pending' }, false, 'rejected'],
  [{ status: 'approved', rainApproved: false, rainStatus: 'denied' }, false, 'rejected'],
  [
    {
      status: 'approved',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    },
    false,
    'completed',
  ],
  [
    {
      status: 'rejected',
      adminReviewStatus: 'approved',
      rainApproved: true,
      rainStatus: 'approved',
    },
    false,
    'rejected',
  ],
] as const)('derives %s with submitted=%s as %s', (fields, submitted, expected) => {
  expect(deriveVerificationViewState(applicant(fields), submitted)).toBe(expected)
})
