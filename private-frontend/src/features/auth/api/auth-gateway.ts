import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { TwoFactorRequirement } from './authenticator-gateway'

type GatewayFailure = Extract<GatewayResult, { ok: false }>

export type OtpRequestResult =
  | {
      ok: true
      data: {
        challengeId: string
        expiresInSeconds: number
        resendAfterSeconds: number
      }
    }
  | (GatewayFailure & { retryAfterSeconds?: number })

export interface AuthGateway {
  requestCode(input: { phone: string }): Promise<OtpRequestResult>
  verifyOtp(
    input: { challengeId: string; code: string },
  ): Promise<GatewayResult<{ isNew: boolean; isPrivate: boolean; twoFactorRequirement: TwoFactorRequirement | null }>>
  signOut(): Promise<void>
}

/** Converts unexpected gateway rejections into a user-safe typed failure. */
export function mapUnexpectedAuthError(
  error: unknown,
): Extract<GatewayResult, { ok: false }> {
  void error

  return {
    ok: false,
    code: 'unexpected-error',
    message: 'Unable to continue. Try again.',
  }
}
