import type { GatewayResult } from '../../../shared/api/gateway-result'
import type {
  AccountPurpose,
  MonthlySpend,
  Occupation,
  YearlyIncome,
} from '../model/onboarding-flow'

export interface SubmitApplicantInput {
  occupation: Occupation
  yearlyIncome: YearlyIncome
  monthlySpend: MonthlySpend
  accountPurpose: AccountPurpose
}

export interface Agreement {
  agreementType: string
  agreementName: string
  accepted: boolean
  documentVersion: string | null
  acceptedAt: string | null
}

export interface OnboardingGateway {
  listAgreements(signal?: AbortSignal): Promise<GatewayResult<readonly Agreement[]>>
  submitApplicant(
    input: SubmitApplicantInput,
    agreements: readonly Agreement[],
  ): Promise<GatewayResult>
}
