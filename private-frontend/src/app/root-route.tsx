import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import {
  AuthFlowProvider,
  useAuthFlow,
} from '../features/auth/auth-flow-provider'
import { SessionRecovery } from '../features/auth/components/session-recovery'
import { PhysicalCardProvider } from '../features/home/physical-card-provider'
import { CardsProvider } from '../features/home/cards-provider'
import { mockPaymentPlansGateway } from '../features/home/api/mock-payment-plans-gateway'
import { PaymentPlansProvider } from '../features/home/payment-plans-provider'
import { TransactionsProvider } from '../features/home/transactions-provider'
import { OnboardingFlowProvider } from '../features/onboarding/onboarding-flow-provider'
import {
  VerificationFlowProvider,
  useVerificationFlow,
} from '../features/verification/verification-flow-provider'
import { AppToaster } from '../shared/ui/app-toaster'
import { PrivatePageShell } from '../shared/ui/private-page-shell'
import { appRuntime } from './app-runtime'
import { resolveRouteSession } from './route-session-resolver'
import type { RouteAccess } from './router-context'

interface RouteAccessProps {
  routeAccess?: RouteAccess | undefined
}

function RouteContent({ routeAccess }: RouteAccessProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const router = useRouter()
  const { retrySession, session, signOut } = useAuthFlow()
  const { applicant, applicantError, applicantStatus } = useVerificationFlow()
  const retryRecovery = useCallback(async () => {
    const recovered = await retrySession()
    if (recovered) await router.invalidate()
    return recovered
  }, [retrySession, router])
  const recoveryMessage =
    routeAccess?.status === 'recovery-error'
      ? routeAccess.message
      : session.status === 'recovery-error'
        ? session.error
        : null

  let routeContent
  if (recoveryMessage !== null) {
    routeContent = (
      <SessionRecovery
        message={recoveryMessage}
        onRetry={retryRecovery}
        onSignOut={signOut}
      />
    )
  } else if (
    session.status === 'authenticated' &&
    applicantStatus === 'error' &&
    applicantError !== null
  ) {
    throw applicantError
  } else {
    routeContent = <Outlet />
  }

  return (
    <CardsProvider
      gateway={appRuntime.cardsGateway}
      sessionIdentity={
        session.status === 'authenticated' ? session.user.id : null
      }
      enabled={
        (pathname === '/home' &&
          (session.status === 'checking' ||
            session.status === 'authenticated')) ||
        (pathname === '/transactions' &&
          session.status === 'authenticated')
      }
    >
      <TransactionsProvider gateway={appRuntime.transactionsGateway}>
        <PaymentPlansProvider
          gateway={mockPaymentPlansGateway}
          enabled={session.status === 'authenticated'}
        >
          <PrivatePageShell fillContent={pathname !== '/authenticator'}>
            <PhysicalCardProvider
              enabled={session.status === 'authenticated'}
              gateway={appRuntime.physicalCardGateway}
              sessionKey={session.status === 'authenticated' ? String(session.user.id) : 'anonymous'}
              recipient={{ firstName: applicant?.firstName ?? null, lastName: applicant?.lastName ?? null }}
            >
              {routeContent}
            </PhysicalCardProvider>
          </PrivatePageShell>
        </PaymentPlansProvider>
      </TransactionsProvider>
    </CardsProvider>
  )
}

function AuthenticatedProviders({ routeAccess }: RouteAccessProps) {
  const { session } = useAuthFlow()
  const sessionIdentity = appRuntime.sessionGeneration.read()

  return (
    <VerificationFlowProvider
      applicantGateway={appRuntime.applicantGateway}
      tokenGateway={appRuntime.sumsubTokenGateway}
      sessionStore={appRuntime.verificationSessionStore}
      enabled={session.status === 'authenticated'}
      sessionActive={session.status !== 'anonymous'}
      sessionIdentity={sessionIdentity}
      isSessionIdentityCurrent={appRuntime.sessionGeneration.isCurrent}
    >
      <OnboardingFlowProvider
        gateway={appRuntime.onboardingGateway}
        occupationGateway={appRuntime.occupationGateway}
      >
        <RouteContent routeAccess={routeAccess} />
        <AppToaster />
      </OnboardingFlowProvider>
    </VerificationFlowProvider>
  )
}

/** Owns document-level behavior shared by every application route. */
export function RootRoute({ routeAccess }: RouteAccessProps) {
  const router = useRouter()
  const onSessionReady = useCallback(async () => {
    const decision = await resolveRouteSession(appRuntime, '/')
    if (decision.kind === 'redirect') {
      await router.navigate({ to: decision.to, replace: true })
      return
    }
    await router.invalidate()
  }, [router])

  useEffect(() => {
    const preventGestureZoom = (event: Event) => event.preventDefault()
    const preventPinchZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault()
      }
    }

    document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
    document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
    document.addEventListener('touchmove', preventPinchZoom, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', preventGestureZoom)
      document.removeEventListener('gesturechange', preventGestureZoom)
      document.removeEventListener('touchmove', preventPinchZoom)
    }
  }, [])

  return (
    <QueryClientProvider client={appRuntime.queryClient}>
      <AuthFlowProvider
        gateway={appRuntime.authGateway}
        currentUserGateway={appRuntime.currentUserGateway}
        sessionStore={appRuntime.authSessionStore}
        onSessionReady={onSessionReady}
      >
        <AuthenticatedProviders routeAccess={routeAccess} />
      </AuthFlowProvider>
    </QueryClientProvider>
  )
}
