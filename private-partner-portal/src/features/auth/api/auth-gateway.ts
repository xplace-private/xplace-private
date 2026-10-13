import type { GatewayResult } from '../../../shared/api/gateway-result'

export type AuthSession =
  | 'anonymous'
  | 'authenticator-required'
  | 'two-factor-required'
  | 'password-required'
  | 'authenticated'

export interface AuthenticatorSetup {
  secret: string
  uri: string
}

/**
 * Adapters return the authoritative session and safe user-facing error messages.
 * A `session` error requests a session refresh (for expiry or an outdated step).
 */
export interface AuthGateway {
  getSession(): Promise<AuthSession>
  signIn(input: { email: string; password: string }): Promise<GatewayResult>
  getAuthenticatorSetup(): Promise<GatewayResult<AuthenticatorSetup>>
  verifyAuthenticatorCode(input: { code: string }): Promise<GatewayResult>
  setPassword(input: { password: string }): Promise<GatewayResult>
  requestPasswordReset(input: { email: string }): Promise<GatewayResult>
  resetPassword(input: { token: string; password: string }): Promise<GatewayResult>
  signOut(): Promise<GatewayResult>
}
