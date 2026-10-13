import { createHttpPhysicalCardGateway, type PhysicalCardGateway } from '../features/home/api/http-physical-card-gateway'
import { PHYSICAL_ORDERS_QUERY_KEY } from '../features/home/use-physical-card-order'
import { hashKey, QueryClient } from '@tanstack/react-query'

import {
  browserAuthSessionStore,
  type AuthSessionStore,
} from '../features/auth/api/browser-auth-session-store'
import type { AuthGateway } from '../features/auth/api/auth-gateway'
import type { AuthenticatorGateway } from '../features/auth/api/authenticator-gateway'
import { createHttpAuthenticatorGateway } from '../features/auth/api/http-authenticator-gateway'
import { AUTHENTICATOR_SETUP_QUERY_KEY } from '../features/auth/authenticator-query'
import { createHttpCsrfTokenProvider } from '../features/auth/api/http-csrf-token-provider'
import { createHttpCurrentUserGateway } from '../features/auth/api/http-current-user-gateway'
import { createHttpWhatsAppAuthGateway } from '../features/auth/api/http-whatsapp-auth-gateway'
import type { CurrentUser, CurrentUserGateway } from '../features/auth/api/current-user-gateway'
import { CURRENT_USER_QUERY_KEY } from '../features/auth/current-user-query'
import { createHttpCardsGateway } from '../features/home/api/http-cards-gateway'
import { createHttpPrivateBalanceGateway } from '../features/home/api/http-private-balance-gateway'
import { createHttpTransactionsGateway } from '../features/home/api/http-transactions-gateway'
import type { CardsGateway } from '../features/home/api/cards-gateway'
import type { PrivateBalanceGateway } from '../features/home/api/private-balance-gateway'
import { CARDS_QUERY_KEY } from '../features/home/cards-query'
import { PRIVATE_BALANCE_QUERY_KEY } from '../features/home/private-balance-query'
import type { TransactionsGateway } from '../features/home/api/transactions-gateway'
import { TRANSACTIONS_QUERY_KEY } from '../features/home/transactions-query'
import { createHttpOccupationGateway } from '../features/onboarding/api/http-occupation-gateway'
import { createHttpOnboardingGateway } from '../features/onboarding/api/http-onboarding-gateway'
import type { OccupationGateway } from '../features/onboarding/api/occupation-gateway'
import type { OnboardingGateway } from '../features/onboarding/api/onboarding-gateway'
import { AGREEMENTS_QUERY_KEY } from '../features/onboarding/onboarding-flow-provider'
import { createHttpApplicantGateway } from '../features/verification/api/http-applicant-gateway'
import { createHttpSumsubTokenGateway } from '../features/verification/api/http-sumsub-token-gateway'
import type { ApplicantGateway } from '../features/verification/api/applicant-gateway'
import { APPLICANT_QUERY_KEY } from '../features/verification/applicant-query'
import type { SumsubTokenGateway } from '../features/verification/api/sumsub-token-gateway'
import { SUMSUB_TOKEN_QUERY_KEY } from '../features/verification/sumsub-token-query'
import {
  browserVerificationSessionStore,
  type VerificationSessionStore,
} from '../features/verification/verification-session-store'
import { createHttpDepositsGateway } from '../features/payment/api/http-deposits-gateway'
import type { DepositsGateway } from '../features/payment/api/deposits-gateway'
import { DEPOSITS_QUERY_KEY } from '../features/payment/deposits-query'
import { createHttpEurDebtGateway } from '../features/payment/api/http-eur-debt-gateway'
import type { EurDebtGateway } from '../features/payment/api/eur-debt-gateway'
import { EUR_DEBT_QUERY_KEY } from '../features/payment/eur-debt-query'
import { appEnv } from '../shared/api/app-env'
import { createApiClient } from '../shared/api/api-client'
import { createApiBaseUrls } from '../shared/api/api-base-urls'
import { reportApiRequestError, setSentryUser } from './sentry'
import { resolvePartner } from './theme-config'
import {
  createSessionGeneration,
  type SessionGeneration,
} from './session-generation'

export interface AppRuntime {
  queryClient: QueryClient
  authSessionStore: AuthSessionStore
  verificationSessionStore: VerificationSessionStore
  sessionGeneration: SessionGeneration
  authGateway: AuthGateway
  authenticatorGateway: AuthenticatorGateway
  currentUserGateway: CurrentUserGateway
  physicalCardGateway: PhysicalCardGateway
  cardsGateway: CardsGateway
  privateBalanceGateway: PrivateBalanceGateway
  depositsGateway: DepositsGateway
  eurDebtGateway: EurDebtGateway
  transactionsGateway: TransactionsGateway
  occupationGateway: OccupationGateway
  onboardingGateway: OnboardingGateway
  applicantGateway: ApplicantGateway
  sumsubTokenGateway: SumsubTokenGateway
  clearSession(): void
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})
const sessionGeneration = createSessionGeneration()

function clearIdentityQueries(client: QueryClient) {
  void client.cancelQueries({ queryKey: CURRENT_USER_QUERY_KEY })
  client.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
  void client.cancelQueries({ queryKey: APPLICANT_QUERY_KEY })
  client.removeQueries({ queryKey: APPLICANT_QUERY_KEY })
}

function clearAllSessionQueries(client: QueryClient) {
  clearIdentityQueries(client)
  void client.cancelQueries({ queryKey: AUTHENTICATOR_SETUP_QUERY_KEY })
  client.removeQueries({ queryKey: AUTHENTICATOR_SETUP_QUERY_KEY })
  void client.cancelQueries({ queryKey: PHYSICAL_ORDERS_QUERY_KEY })
  client.removeQueries({ queryKey: PHYSICAL_ORDERS_QUERY_KEY })
  void client.cancelQueries({ queryKey: DEPOSITS_QUERY_KEY })
  client.removeQueries({ queryKey: DEPOSITS_QUERY_KEY })
  void client.cancelQueries({ queryKey: EUR_DEBT_QUERY_KEY })
  client.removeQueries({ queryKey: EUR_DEBT_QUERY_KEY })
  void client.cancelQueries({ queryKey: CARDS_QUERY_KEY })
  client.removeQueries({ queryKey: CARDS_QUERY_KEY })
  void client.cancelQueries({ queryKey: TRANSACTIONS_QUERY_KEY })
  client.removeQueries({ queryKey: TRANSACTIONS_QUERY_KEY })
  void client.cancelQueries({ queryKey: PRIVATE_BALANCE_QUERY_KEY })
  client.removeQueries({ queryKey: PRIVATE_BALANCE_QUERY_KEY })
  void client.cancelQueries({ queryKey: SUMSUB_TOKEN_QUERY_KEY })
  client.removeQueries({ queryKey: SUMSUB_TOKEN_QUERY_KEY })
  void client.cancelQueries({ queryKey: AGREEMENTS_QUERY_KEY })
  client.removeQueries({ queryKey: AGREEMENTS_QUERY_KEY })
}

const authSessionStore: AuthSessionStore = {
  readStatus: browserAuthSessionStore.readStatus,
  subscribe: browserAuthSessionStore.subscribe,
  markAuthenticated() {
    if (browserAuthSessionStore.readStatus() !== 'authenticated') {
      sessionGeneration.advance()
      clearAllSessionQueries(queryClient)
      browserVerificationSessionStore.clear()
    }
    browserAuthSessionStore.markAuthenticated()
  },
  requireTwoFactor(requirement) {
    if (browserAuthSessionStore.readStatus() !== requirement) {
      sessionGeneration.advance()
      clearAllSessionQueries(queryClient)
      browserVerificationSessionStore.clear()
    }
    browserAuthSessionStore.requireTwoFactor(requirement)
  },
  clear() {
    if (browserAuthSessionStore.readStatus() !== 'anonymous') {
      sessionGeneration.advance()
      clearAllSessionQueries(queryClient)
      browserVerificationSessionStore.clear()
    }
    browserAuthSessionStore.clear()
  },
}

const stopObservingSentryUser = queryClient.getQueryCache().subscribe(({ query }) => {
  if (query.queryHash !== hashKey(CURRENT_USER_QUERY_KEY)) return
  const user = authSessionStore.readStatus() === 'anonymous'
    ? undefined
    : queryClient.getQueryData<CurrentUser>(CURRENT_USER_QUERY_KEY)
  setSentryUser(user ?? null)
})
import.meta.hot?.dispose(stopObservingSentryUser)

function clearSession() {
  authSessionStore.clear()
}

if (appEnv.apiBaseUrl === null) {
  throw new Error('VITE_API_BASE_URL is required')
}

const apiBaseUrls = createApiBaseUrls(appEnv.apiBaseUrl)
const csrfClient = createApiClient({
  baseUrl: apiBaseUrls.v1,
  onRequestError: reportApiRequestError,
})
const csrfTokenProvider = createHttpCsrfTokenProvider(csrfClient)
const v1Client = createApiClient({
  baseUrl: apiBaseUrls.v1,
  getCsrfToken: csrfTokenProvider.getToken,
  onUnauthorized: clearSession,
  onRequestError: reportApiRequestError,
})
const v2Client = createApiClient({
  baseUrl: apiBaseUrls.v2,
  getCsrfToken: csrfTokenProvider.getToken,
  onUnauthorized: clearSession,
  onRequestError: reportApiRequestError,
})

export const appRuntime: AppRuntime = {
  queryClient,
  authSessionStore,
  verificationSessionStore: browserVerificationSessionStore,
  sessionGeneration,
  authGateway: createHttpWhatsAppAuthGateway(
    v1Client,
    csrfTokenProvider,
    () => resolvePartner(window.location.hostname),
  ),
  authenticatorGateway: createHttpAuthenticatorGateway(v1Client),
  currentUserGateway: createHttpCurrentUserGateway(v1Client),
  physicalCardGateway: createHttpPhysicalCardGateway(v1Client),
  cardsGateway: createHttpCardsGateway(v1Client),
  privateBalanceGateway: createHttpPrivateBalanceGateway(v1Client),
  depositsGateway: createHttpDepositsGateway(v1Client),
  eurDebtGateway: createHttpEurDebtGateway(v1Client),
  transactionsGateway: createHttpTransactionsGateway(v1Client),
  occupationGateway: createHttpOccupationGateway(v1Client),
  onboardingGateway: createHttpOnboardingGateway(v2Client, v1Client),
  applicantGateway: createHttpApplicantGateway(v1Client),
  sumsubTokenGateway: createHttpSumsubTokenGateway(v1Client),
  clearSession,
}
