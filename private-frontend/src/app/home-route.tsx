import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

import { useAuthFlow } from '../features/auth/auth-flow-provider'
import { HomeScreen } from '../features/home/home-screen'
import { usePhysicalCard } from '../features/home/physical-card-provider'
import { useCards } from '../features/home/cards-provider'
import { HomeSessionSkeleton } from '../features/home/home-session-skeleton'
import { usePaymentPlans } from '../features/home/payment-plans-provider'
import { usePrivateBalance } from '../features/home/private-balance-query'
import { useTransactions } from '../features/home/transactions-provider'
import { useVerificationFlow } from '../features/verification/verification-flow-provider'
import { appRuntime } from './app-runtime'

export function HomeRoute() {
  const router = useRouter()
  const { session, signOut } = useAuthFlow()
  const { applicant } = useVerificationFlow()
  const cards = useCards()
  const physicalCard = usePhysicalCard()
  const balance = usePrivateBalance(
    appRuntime.privateBalanceGateway,
    session.status === 'authenticated',
  )
  const transactions = useTransactions({
    enabled: session.status === 'authenticated',
    pageSize: 5,
  })
  const { state: paymentPlansState, resetSession, settlePlan, startPlan } = usePaymentPlans()
  const paymentPlansReady =
    session.status === 'authenticated' && paymentPlansState.status === 'ready'
  const handleSignOut = useCallback(async () => {
    const signedOut = await signOut()
    if (!signedOut) return

    resetSession()
    transactions.resetSession()
    cards.resetSession()
    router.history.replace('/')
  }, [cards, resetSession, router.history, signOut, transactions])

  if (
    cards.status === 'loading' ||
    (session.status === 'authenticated' && balance.isPending)
  ) {
    return <HomeSessionSkeleton />
  }

  return (
    <HomeScreen
      physicalCard={physicalCard}
      balance={balance.isSuccess ? balance.data : undefined}
      balanceError={balance.isError ? balance.error.message : undefined}
      cardholderLastName={applicant?.lastName ?? undefined}
      cardholderTitle={
        applicant?.gender === 'male'
          ? 'Mr'
          : applicant?.gender === 'female'
            ? 'Ms'
            : undefined
      }
      cards={cards.status === 'ready' ? cards.cards : []}
      cardsError={cards.error ?? undefined}
      selectedCardId={cards.selectedCardId}
      transactions={transactions.status === 'ready' ? transactions.transactions : []}
      transactionsLoading={transactions.status === 'loading'}
      transactionsError={transactions.error ?? undefined}
      plans={paymentPlansState.plans}
      paymentPlansError={paymentPlansState.loadError ?? undefined}
      settlePlan={paymentPlansReady ? settlePlan : undefined}
      startPlan={paymentPlansReady ? startPlan : undefined}
      onPayNow={() => router.history.push('/payment')}
      onRetryBalance={() => void balance.refetch()}
      onRetryCards={cards.retry}
      onRetryTransactions={transactions.retry}
      onSelectCard={cards.selectCard}
      issueVirtualCard={cards.issueVirtual}
      activatePhysicalCard={cards.activatePhysical}
      renameCard={cards.rename}
      setCardFrozen={cards.setFrozen}
      changeCardPin={cards.changePin}
      getCardDetails={cards.getDetails}
      onViewAll={() => router.history.push('/transactions')}
      onSignOut={handleSignOut}
    />
  )
}
