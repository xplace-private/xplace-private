import type { CurrentUser } from '../features/auth/api/current-user-gateway'
import type { TwoFactorRequirement } from '../features/auth/api/authenticator-gateway'
import type { Applicant } from '../features/verification/model/applicant'
import type { AppRuntime } from './app-runtime'

export type RouteAccess =
  | { status: 'anonymous' }
  | { status: 'two-factor-required'; requirement: TwoFactorRequirement }
  | {
      status: 'authenticated'
      user: CurrentUser
      applicant: Applicant | null
    }
  | { status: 'recovery-error'; message: string }

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- TanStack Router context intentionally preserves the app runtime contract as an interface.
export interface AppRouterContext extends AppRuntime {}
