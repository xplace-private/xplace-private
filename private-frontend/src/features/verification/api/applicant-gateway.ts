import type { Applicant } from '../model/applicant'

export type ApplicantGatewayResult =
  | { ok: true; data: Applicant | null }
  | { ok: false; code: 'applicant-failed'; message: string }

export interface ApplicantGateway {
  get(signal?: AbortSignal): Promise<ApplicantGatewayResult>
}
