export type SumsubApplicantStatus =
  | 'not_started'
  | 'pending'
  | 'approved'
  | 'temporary_rejected'
  | 'rejected'

export type RainApplicantStatus =
  | 'approved'
  | 'pending'
  | 'needsInformation'
  | 'needsVerification'
  | 'manualReview'
  | 'denied'
  | 'locked'
  | 'canceled'

export type AdminReviewStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'declined'

export type ApplicantGender = 'male' | 'female'

export interface Applicant {
  id: number
  firstName?: string | null
  lastName?: string | null
  gender: ApplicantGender | null
  sumsubId: string | null
  status: SumsubApplicantStatus
  adminReviewStatus: AdminReviewStatus
  rainApproved: boolean
  rainStatus: RainApplicantStatus
}

export type VerificationViewState =
  | 'continue'
  | 'under-review'
  | 'account-pending'
  | 'completed'
  | 'rejected'

export function deriveVerificationViewState(
  applicant: Applicant,
  submitted: boolean,
): VerificationViewState {
  if (
    applicant.status === 'rejected' ||
    applicant.adminReviewStatus === 'declined' ||
    applicant.rainStatus === 'denied' ||
    applicant.rainStatus === 'locked' ||
    applicant.rainStatus === 'canceled'
  ) {
    return 'rejected'
  }
  if (
    applicant.status === 'approved' &&
    applicant.adminReviewStatus === 'approved' &&
    applicant.rainApproved &&
    applicant.rainStatus === 'approved'
  ) {
    return 'completed'
  }
  if (applicant.status === 'approved') return 'account-pending'
  if (submitted) return 'under-review'
  if (
    applicant.status === 'not_started' ||
    applicant.status === 'temporary_rejected'
  ) {
    return 'continue'
  }
  return 'under-review'
}
