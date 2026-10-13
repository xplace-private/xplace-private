import {
  deriveVerificationViewState,
  type Applicant,
} from '../features/verification/model/applicant'

const homePaths = new Set(['/home', '/transactions', '/payment'])

export function resolveApplicantRoute(
  pathname: string,
  applicant: Applicant | null,
): '/onboarding' | '/verification' | '/home' | null {
  if (
    applicant === null ||
    applicant.sumsubId === null ||
    applicant.sumsubId.trim() === ''
  ) {
    return pathname === '/onboarding' ? null : '/onboarding'
  }
  const state = deriveVerificationViewState(applicant, false)
  if (state === 'completed') {
    return homePaths.has(pathname) ? null : '/home'
  }

  if (pathname === '/verification') return null
  if (pathname === '/verification/sumsub' && state === 'continue') return null
  return '/verification'
}
