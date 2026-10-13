export interface PartnerProfile {
  fullName: string | null
  email: string | null
  phone: string | null
  company: string | null
  partnerSlug: string | null
  mustChangePassword: boolean
  totpConfigured: boolean
}

export interface ProfileGateway {
  getProfile(signal: AbortSignal): Promise<PartnerProfile>
  changePassword(input: { currentPassword: string; password: string; code: string }): Promise<GatewayResult>
  revokeOtherSessions(): Promise<GatewayResult>
}
import type { GatewayResult } from '../../../shared/api/gateway-result'

export class ProfileSessionError extends Error {
  constructor() {
    super('The profile requires a valid full session')
    this.name = 'ProfileSessionError'
  }
}
