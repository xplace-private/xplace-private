import type { GatewayResult } from '../../../shared/api/gateway-result'

export type TwoFactorRequirement = 'totp_setup_required' | 'totp_required'

export interface AuthenticatorSetup {
  secret: string
  uri: string
}

export interface AuthenticatorGateway {
  getSetup(signal?: AbortSignal): Promise<GatewayResult<AuthenticatorSetup>>
  verifyCode(input: { code: string; requirement: TwoFactorRequirement }): Promise<GatewayResult>
}

export function isTwoFactorRequirement(value: unknown): value is TwoFactorRequirement {
  return value === 'totp_setup_required' || value === 'totp_required'
}
