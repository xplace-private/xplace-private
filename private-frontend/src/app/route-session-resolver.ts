import type { AuthSessionStatus } from '../features/auth/api/browser-auth-session-store'
import { isTwoFactorRequirement } from '../features/auth/api/authenticator-gateway'
import type { CurrentUser } from '../features/auth/api/current-user-gateway'
import {
  CurrentUserQueryError,
  currentUserQueryOptions,
} from '../features/auth/current-user-query'
import {
  APPLICANT_QUERY_KEY,
  applicantQueryOptions,
} from '../features/verification/applicant-query'
import type { Applicant } from '../features/verification/model/applicant'
import { privateBalanceQueryOptions } from '../features/home/private-balance-query'
import type { AppRuntime } from './app-runtime'
import { resolveApplicantRoute } from './applicant-route-policy'
import type { RouteAccess } from './router-context'

const SESSION_RECOVERY_MESSAGE = 'Unable to restore session. Try again.'

export type RouteSessionDecision =
  | { kind: 'allow'; access: RouteAccess }
  | {
      kind: 'redirect'
      to: '/' | '/authenticator' | '/onboarding' | '/verification' | '/home'
    }

function anonymousDecision(pathname: string): RouteSessionDecision {
  return pathname === '/'
    ? { kind: 'allow', access: { status: 'anonymous' } }
    : { kind: 'redirect', to: '/' }
}

function authenticatedDecision(
  pathname: string,
  user: CurrentUser,
  applicant: Applicant | null,
): RouteSessionDecision {
  const destination = resolveApplicantRoute(pathname, applicant)
  return destination === null
    ? {
        kind: 'allow',
        access: { status: 'authenticated', user, applicant },
      }
    : { kind: 'redirect', to: destination }
}

function recoveryDecision(message: string): RouteSessionDecision {
  return { kind: 'allow', access: { status: 'recovery-error', message } }
}

function isSameSession(
  runtime: AppRuntime,
  generation: number,
  status: AuthSessionStatus,
): boolean {
  return (
    runtime.sessionGeneration.isCurrent(generation) &&
    runtime.authSessionStore.readStatus() === status
  )
}

export async function resolveRouteSession(
  runtime: AppRuntime,
  pathname: string,
): Promise<RouteSessionDecision> {
  for (;;) {
    const generation = runtime.sessionGeneration.read()
    const sessionStatus = runtime.authSessionStore.readStatus()
    if (sessionStatus === 'anonymous') return anonymousDecision(pathname)
    if (isTwoFactorRequirement(sessionStatus)) {
      return pathname === '/authenticator'
        ? { kind: 'allow', access: { status: 'two-factor-required', requirement: sessionStatus } }
        : { kind: 'redirect', to: '/authenticator' }
    }
    let resolvedUser: CurrentUser | null = null

    try {
      const [user] = await Promise.all([
        runtime.queryClient.fetchQuery(
          currentUserQueryOptions(runtime.currentUserGateway),
        ),
        pathname === '/home'
          ? runtime.queryClient
              .ensureQueryData({
                ...privateBalanceQueryOptions(runtime.privateBalanceGateway),
                revalidateIfStale: true,
              })
              .catch(() => undefined)
          : pathname === '/payment'
            ? runtime.queryClient
                .ensureQueryData(
                  privateBalanceQueryOptions(runtime.privateBalanceGateway),
                )
                .catch(() => undefined)
          : Promise.resolve(undefined),
      ])
      resolvedUser = user
      if (!isSameSession(runtime, generation, sessionStatus)) continue

      const applicant = await runtime.queryClient.fetchQuery(
        applicantQueryOptions(runtime.applicantGateway),
      )
      if (!isSameSession(runtime, generation, sessionStatus)) {
        if (
          runtime.queryClient.getQueryData<Applicant | null>(
            APPLICANT_QUERY_KEY,
          ) === applicant
        ) {
          runtime.queryClient.removeQueries({
            queryKey: APPLICANT_QUERY_KEY,
            exact: true,
          })
        }
        continue
      }

      return authenticatedDecision(pathname, resolvedUser, applicant)
    } catch (error: unknown) {
      if (!isSameSession(runtime, generation, sessionStatus)) continue
      if (runtime.authSessionStore.readStatus() === 'anonymous') {
        return anonymousDecision(pathname)
      }
      if (error instanceof CurrentUserQueryError) {
        if (isTwoFactorRequirement(error.code)) {
          runtime.authSessionStore.requireTwoFactor(error.code)
          continue
        }
        return recoveryDecision(SESSION_RECOVERY_MESSAGE)
      }
      const cachedApplicant =
        runtime.queryClient.getQueryData<Applicant | null>(
          APPLICANT_QUERY_KEY,
        )
      if (resolvedUser !== null && cachedApplicant !== undefined) {
        return authenticatedDecision(pathname, resolvedUser, cachedApplicant)
      }
      throw error
    }
  }
}
