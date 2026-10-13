import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { formatShortDate } from '../../shared/format-short-date'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Button } from '../../shared/ui/button'
import { copyToClipboard } from '../../shared/copy-to-clipboard'
import { InfoBanner } from '../../shared/ui/info-banner'
import { SectionDivider } from '../../shared/ui/section-divider'
import { SectionHeader } from '../../shared/ui/section-header'
import { TokenIcon } from '../../shared/ui/token-icon'
import {
  showCardActivatedToast,
  showCardFreezedToast,
  showCardIssuedToast,
  showCardPinUpdatedToast,
  showCardRenamedToast,
  showCardUnfreezedToast,
} from './card-notifications'
import { CardDetails } from './components/card-details'
import { CardActivationModal } from './components/card-activation-modal'
import { CardHero } from './components/card-hero'
import { CardManagementPanel } from './components/card-management-panel'
import { CardPinModal } from './components/card-pin-modal'
import { GettingStartedSection } from './components/getting-started-section'
import { NewCardModal } from './components/new-card-modal'
import { PhysicalCardDeliveryModal } from './components/physical-card-delivery-modal'
import { RenameCardModal } from './components/rename-card-modal'
import { PaymentPlanStartModal } from './components/payment-plan-start-modal'
import { PaymentPlanDetailsModal } from './components/payment-plan-details-modal'
import { PaymentPlansSection } from './components/payment-plans-section'
import { SettlePaymentPlanModal } from './components/settle-payment-plan-modal'
import { TransactionDetailModal } from './components/transaction-detail-modal'
import {
  TransactionList,
  TransactionListSkeleton,
  type Transaction,
} from './components/transaction-list'
import { YourCards } from './components/your-cards'
import {
  cardCollectionReducer,
  createCardCollectionState,
  isCardActivationValid,
  type CardDetailsData,
  type HomeCard,
} from './model/card-collection'
import {
  cardDetailsVisibilityReducer,
  createCardDetailsVisibilityState,
} from './model/card-details-visibility'
import {
  formatUsd,
  isPayOverTimeEligible,
  type PaymentPlan,
} from './model/payment-plan'
import type { PrivateBalance } from './api/private-balance-gateway'
import type { CardsGateway } from './api/cards-gateway'
import type { PhysicalCardFlow } from './use-physical-card-order'
import { recentTransactions } from './transaction-data'
import { usePaymentPlanStart, type StartPaymentPlan } from './use-payment-plan-start'
import {
  usePaymentPlanSettlement,
  type SettlePaymentPlan,
} from './use-payment-plan-settlement'

interface StatPanelProps {
  className: string
  icon: string
  primary: ReactNode
  children: ReactNode
}

function StatPanel({ className, icon, primary, children }: StatPanelProps) {
  return (
    <section
      className={`row-start-1 row-span-2 grid min-w-0 grid-rows-subgrid gap-y-4 border border-border bg-card px-4 pt-4 pb-[21px] ${className}`}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <TokenIcon className="size-5 text-secondary" src={icon} />
        {primary}
      </div>
      {children}
    </section>
  )
}

function StatValue({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <strong className="text-[21px] leading-none font-bold tracking-[-0.8px] whitespace-nowrap">
        {children}
      </strong>
      <span className="relative flex items-center gap-1 text-[11px] leading-[14px] font-light text-secondary">
        {label}
      </span>
    </div>
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function daysUntilStatement(dueDate: string): number {
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.max(0, Math.round((utcDate(dueDate).getTime() - today) / DAY_MS))
}

interface HomeScreenProps {
  activatePhysicalCard?: CardsGateway['activatePhysical']
  physicalCard?: PhysicalCardFlow | null | undefined
  balance?: PrivateBalance | undefined
  balanceError?: string | undefined
  cardholderLastName?: string | undefined
  cardholderTitle?: 'Mr' | 'Ms' | undefined
  transactions?: readonly Transaction[]
  transactionsLoading?: boolean | undefined
  transactionsError?: string | undefined
  cards?: readonly HomeCard[]
  cardsError?: string | undefined
  plans?: readonly PaymentPlan[]
  paymentPlansError?: string | undefined
  settlePlan?: SettlePaymentPlan | undefined
  startPlan?: StartPaymentPlan | undefined
  onPayNow?: () => void
  onViewAll?: () => void
  onSignOut?: () => void
  onRetryCards?: () => void
  onRetryBalance?: () => void
  onRetryTransactions?: () => void
  selectedCardId?: string | null | undefined
  onSelectCard?: ((cardId: string) => void) | undefined
  issueVirtualCard?: (
    name: string,
    signal?: AbortSignal,
  ) => Promise<GatewayResult>
  renameCard?: (
    cardId: string,
    name: string,
    signal?: AbortSignal,
  ) => Promise<GatewayResult<{ name: string }>>
  setCardFrozen?: (
    cardId: string,
    frozen: boolean,
    signal?: AbortSignal,
  ) => Promise<GatewayResult>
  changeCardPin?: (
    cardId: string,
    pin: string,
    signal?: AbortSignal,
  ) => Promise<GatewayResult>
  getCardDetails?: (
    cardId: string,
    expiration: string,
    signal?: AbortSignal,
  ) => Promise<GatewayResult<CardDetailsData>>
}

const EMPTY_CARDS: readonly HomeCard[] = []
export function HomeContentFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 pt-6 pb-4">
      {children}
    </div>
  )
}

/** Account home populated state with an API-ready activity boundary. */
export function HomeScreen({
  physicalCard,
  balance,
  balanceError,
  cardholderLastName,
  cardholderTitle,
  transactions = recentTransactions,
  transactionsLoading = false,
  transactionsError,
  cards = EMPTY_CARDS,
  cardsError,
  plans = [],
  paymentPlansError,
  settlePlan,
  startPlan,
  onPayNow,
  onViewAll,
  onSignOut,
  onRetryCards,
  onRetryBalance,
  onRetryTransactions,
  selectedCardId,
  onSelectCard,
  issueVirtualCard,
  activatePhysicalCard,
  renameCard,
  setCardFrozen,
  changeCardPin,
  getCardDetails,
}: HomeScreenProps) {
  const { i18n, t } = useAppTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  const dueDate = balance?.dueDate ?? null
  const statementDays = dueDate === null ? null : daysUntilStatement(dueDate)
  const formattedDueDate =
    dueDate === null ? null : formatShortDate(dueDate, language)
  const availableToSpend =
    balance === undefined
      ? t('common.notAvailable')
      : formatUsd(balance.availableToSpendCents, language)
  const dueThisPeriod =
    balance === undefined
      ? t('common.notAvailable')
      : formatUsd(balance.dueThisPeriodCents, language)
  const hasTransactions = transactions.length > 0
  const hasDebt = balance !== undefined && (
    balance.dueThisPeriodCents > 0 ||
    balance.overdue.some((period) => period.amountCents > 0)
  )
  const hasInitialTransactionsError =
    transactionsError !== undefined && transactions.length === 0
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [dueDateInfoOpen, setDueDateInfoOpen] = useState(false)
  const paymentPlanStart = usePaymentPlanStart(startPlan)
  const paymentPlanSettlement = usePaymentPlanSettlement(settlePlan)
  const [cardDetailsVisibility, dispatchCardDetailsVisibility] = useReducer(
    cardDetailsVisibilityReducer,
    undefined,
    createCardDetailsVisibilityState,
  )
  const [cardCollection, dispatchCardCollection] = useReducer(
    cardCollectionReducer,
    cards,
    createCardCollectionState,
  )
  const [freezePendingCardId, setFreezePendingCardId] = useState<string | null>(null)
  const [physicalCardPreparing, setPhysicalCardPreparing] = useState(false)
  const [newCardIssueError, setNewCardIssueError] = useState<string | null>(null)
  const [cardStatusFailure, setCardStatusFailure] = useState<{
    cardId: string
    message: string
  } | null>(null)
  const [remoteCardDetails, setRemoteCardDetails] = useState<{
    cardId: string
    data: CardDetailsData
  } | null>(null)
  const [detailsLoadingCardId, setDetailsLoadingCardId] = useState<string | null>(null)
  const [detailsFailure, setDetailsFailure] = useState<{
    cardId: string
    message: string
  } | null>(null)
  const detailsRequestRef = useRef<AbortController | null>(null)
  const freezeRequestRef = useRef<AbortController | null>(null)
  const issueCardRequestRef = useRef<AbortController | null>(null)
  const activationRequestRef = useRef<AbortController | null>(null)
  const selectedCard =
    cardCollection.cards.find(
      (card) => card.id === (selectedCardId ?? cardCollection.selectedCardId),
    ) ??
    cardCollection.cards[0]
  const newCardFlow = cardCollection.newCard
  const renameCardFlow = cardCollection.renameCard
  const renameCardEntity =
    renameCardFlow.status === 'closed'
      ? undefined
      : cardCollection.cards.find((card) => card.id === renameCardFlow.cardId)
  const cardPinFlow = cardCollection.cardPin
  const cardActivationFlow = cardCollection.cardActivation
  const pinCard =
    cardPinFlow.status === 'closed'
      ? undefined
      : cardCollection.cards.find((card) => card.id === cardPinFlow.cardId)
  const pinBackendId = pinCard?.backendId
  const selectedCardDetails =
    selectedCard?.details ??
    (remoteCardDetails !== null && remoteCardDetails.cardId === selectedCard?.id
      ? remoteCardDetails.data
      : null)
  const cardStatusError =
    cardStatusFailure !== null && cardStatusFailure.cardId === selectedCard?.id
      ? cardStatusFailure.message
      : null
  const detailsError =
    detailsFailure !== null && detailsFailure.cardId === selectedCard?.id
      ? detailsFailure.message
      : null
  const paymentPlansByTransactionId = new Map(
    plans.map((plan) => [plan.transactionId, plan]),
  )
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId)
  const settlementPlan = plans.find((plan) => plan.id === paymentPlanSettlement.planId)

  const canPayOverTime = (transaction: Transaction) =>
    startPlan !== undefined &&
    isPayOverTimeEligible(transaction, paymentPlansByTransactionId.has(transaction.id))

  useEffect(() => {
    dispatchCardCollection({ type: 'replace-cards', cards })
  }, [cards])

  useEffect(() => {
    return () => detailsRequestRef.current?.abort()
  }, [])

  useEffect(
    () => () => {
      freezeRequestRef.current?.abort()
      issueCardRequestRef.current?.abort()
      activationRequestRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (!cardDetailsVisibility.visible) return

    const timer = window.setTimeout(() => {
      if (cardDetailsVisibility.remainingSeconds <= 1) {
        setRemoteCardDetails(null)
      }
      dispatchCardDetailsVisibility({ type: 'tick' })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [cardDetailsVisibility.remainingSeconds, cardDetailsVisibility.visible])

  const submitNewCard = () => {
    if (newCardFlow.status !== 'editing' || issueCardRequestRef.current !== null) return

    setNewCardIssueError(null)
    if (newCardFlow.cardType === 'Physical' && newCardFlow.name.trim()) {
      if (!physicalCard) { setNewCardIssueError('Unable to issue card. Try again.'); return }
      const controller = new AbortController()
      issueCardRequestRef.current = controller
      setPhysicalCardPreparing(true)
      void physicalCard.open(newCardFlow.name.trim(), controller.signal).then((opened) => {
        if (controller.signal.aborted) return
        issueCardRequestRef.current = null
        setPhysicalCardPreparing(false)
        if (opened) dispatchCardCollection({ type: 'close-new-card' })
        else setNewCardIssueError(t('home.delivery.errors.request'))
      })
      return
    }
    dispatchCardCollection({ type: 'submit-new-card' })
    if (
      newCardFlow.cardType !== 'Virtual' ||
      !newCardFlow.name.trim()
    ) {
      return
    }
    if (!issueVirtualCard) {
      setNewCardIssueError('Unable to issue card. Try again.')
      dispatchCardCollection({ type: 'new-card-issue-failed' })
      return
    }

    const controller = new AbortController()
    issueCardRequestRef.current = controller
    void issueVirtualCard(newCardFlow.name.trim(), controller.signal).then((result) => {
      if (controller.signal.aborted) return

      issueCardRequestRef.current = null
      if (!result.ok) {
        setNewCardIssueError(result.message)
        dispatchCardCollection({ type: 'new-card-issue-failed' })
        return
      }

      dispatchCardCollection({ type: 'new-card-issue-succeeded' })
      showCardIssuedToast()
    })
  }

  useEffect(() => {
    if (renameCardFlow.status !== 'saving') return

    if (!renameCard || !renameCardEntity?.backendId) {
      dispatchCardCollection({
        type: 'rename-card-save-failed',
        message: 'Unable to rename card. Try again.',
      })
      return
    }

    let active = true
    const controller = new AbortController()
    void renameCard(
      renameCardEntity.backendId,
      renameCardFlow.name,
      controller.signal,
    ).then((result) => {
      if (!active) return
      if (!result.ok) {
        dispatchCardCollection({
          type: 'rename-card-save-failed',
          message: result.message,
        })
        return
      }
      dispatchCardCollection({ type: 'rename-card-saved', name: result.data.name })
      showCardRenamedToast()
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [renameCard, renameCardEntity?.backendId, renameCardFlow])

  useEffect(() => {
    if (cardPinFlow.status !== 'saving') return

    if (pinBackendId === null) {
      const timer = window.setTimeout(() => {
        dispatchCardCollection({ type: 'card-pin-saved' })
        showCardPinUpdatedToast()
      }, 1000)

      return () => window.clearTimeout(timer)
    }

    let active = true
    if (!changeCardPin || !pinBackendId) {
      dispatchCardCollection({
        type: 'card-pin-save-failed',
        message: 'Unable to update PIN. Try again.',
      })
      return
    }

    const controller = new AbortController()
    void changeCardPin(pinBackendId, cardPinFlow.pin, controller.signal).then((result) => {
      if (!active) return
      if (!result.ok) {
        dispatchCardCollection({ type: 'card-pin-save-failed', message: result.message })
        return
      }

      dispatchCardCollection({ type: 'card-pin-update-confirmed' })
      showCardPinUpdatedToast()
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [cardPinFlow, changeCardPin, pinBackendId])

  const submitCardActivation = async () => {
    if (cardActivationFlow.status !== 'editing' || activationRequestRef.current) return
    dispatchCardCollection({ type: 'submit-card-activation' })
    if (!isCardActivationValid(cardActivationFlow.lastFour, cardActivationFlow.expiry)) return
    const card = cardCollection.cards.find((item) => item.id === cardActivationFlow.cardId)
    const controller = new AbortController()
    activationRequestRef.current = controller
    try {
      const result = card && activatePhysicalCard
        ? await activatePhysicalCard(card, cardActivationFlow.lastFour, cardActivationFlow.expiry, controller.signal)
        : { ok: false as const, message: 'home.activation.errors.request' }
      if (controller.signal.aborted) return
      dispatchCardCollection(result.ok
        ? { type: 'card-activation-succeeded', card: result.data }
        : { type: 'card-activation-failed', message: result.message })
      if (result.ok) showCardActivatedToast()
    } catch {
      if (!controller.signal.aborted) dispatchCardCollection({ type: 'card-activation-failed', message: 'home.activation.errors.request' })
    } finally {
      if (activationRequestRef.current === controller) activationRequestRef.current = null
    }
  }

  const copyCardValue = (value: string) => {
    void copyToClipboard(value, navigator.clipboard)
  }

  const toggleSelectedCardFreeze = async () => {
    if (!selectedCard || freezePendingCardId !== null) return

    const frozen = selectedCard.status === 'Active'
    if (selectedCard.backendId === null) {
      dispatchCardCollection({ type: 'set-card-frozen', cardId: selectedCard.id, frozen })
      if (frozen) showCardFreezedToast()
      else showCardUnfreezedToast()
      return
    }
    if (!setCardFrozen) {
      setCardStatusFailure({
        cardId: selectedCard.id,
        message: 'Unable to update card status. Try again.',
      })
      return
    }

    setFreezePendingCardId(selectedCard.id)
    setCardStatusFailure(null)
    const controller = new AbortController()
    freezeRequestRef.current = controller
    const result = await setCardFrozen(selectedCard.backendId, frozen, controller.signal)
    if (controller.signal.aborted) return

    freezeRequestRef.current = null
    setFreezePendingCardId(null)
    if (!result.ok) {
      setCardStatusFailure({ cardId: selectedCard.id, message: result.message })
      return
    }

    if (frozen) showCardFreezedToast()
    else showCardUnfreezedToast()
  }

  const toggleSelectedCardDetails = async () => {
    if (!selectedCard || detailsLoadingCardId !== null) return

    if (cardDetailsVisibility.visible) {
      detailsRequestRef.current?.abort()
      detailsRequestRef.current = null
      setRemoteCardDetails(null)
      setDetailsFailure(null)
      dispatchCardDetailsVisibility({ type: 'hide' })
      return
    }

    if (selectedCard.details) {
      dispatchCardDetailsVisibility({ type: 'toggle' })
      return
    }

    if (!selectedCard.backendId || !selectedCard.expiration || !getCardDetails) {
      setDetailsFailure({
        cardId: selectedCard.id,
        message: 'Unable to load card details. Try again.',
      })
      return
    }

    const controller = new AbortController()
    detailsRequestRef.current = controller
    setDetailsLoadingCardId(selectedCard.id)
    setDetailsFailure(null)
    const result = await getCardDetails(
      selectedCard.backendId,
      selectedCard.expiration,
      controller.signal,
    )
    if (controller.signal.aborted) return

    detailsRequestRef.current = null
    setDetailsLoadingCardId(null)
    if (!result.ok) {
      setDetailsFailure({ cardId: selectedCard.id, message: result.message })
      return
    }

    setRemoteCardDetails({ cardId: selectedCard.id, data: result.data })
    dispatchCardDetailsVisibility({ type: 'toggle' })
  }

  const selectCard = (cardId: string) => {
    detailsRequestRef.current?.abort()
    detailsRequestRef.current = null
    setRemoteCardDetails(null)
    setDetailsLoadingCardId(null)
    setDetailsFailure(null)
    setCardStatusFailure(null)
    dispatchCardDetailsVisibility({ type: 'hide' })
    dispatchCardCollection({ type: 'select-card', cardId })
    onSelectCard?.(cardId)
  }

  const openSettlementConfirmation = (planId: string) => {
    setSelectedPlanId(null)
    paymentPlanSettlement.open(planId)
  }

  return (
    <HomeContentFrame>
      {selectedCard ? (
        <div className="min-w-0" data-layout-slot="card">
          <CardHero
            card={selectedCard}
            detailsLoading={detailsLoadingCardId === selectedCard.id}
            detailsVisible={cardDetailsVisibility.visible}
            onToggleDetails={() => void toggleSelectedCardDetails()}
          />
        </div>
      ) : null}

      {detailsError ? (
        <InfoBanner variant="warning">{t('home.cards.errors.details')}</InfoBanner>
      ) : null}

      {balanceError ? (
        <InfoBanner variant="warning">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span>{t('home.statement.loadError')}</span>
            {onRetryBalance ? (
              <Button variant="outline" size="sm" onClick={onRetryBalance}>
                {t('common.actions.retry')}
              </Button>
            ) : null}
          </div>
        </InfoBanner>
      ) : null}

      {cardDetailsVisibility.visible && selectedCardDetails ? (
        <div id="card-details">
          <CardDetails
            details={selectedCardDetails}
            remainingSeconds={cardDetailsVisibility.remainingSeconds}
            onCopy={copyCardValue}
          />
        </div>
      ) : null}

      {dueDate !== null && formattedDueDate !== null ? (
        <div className="min-w-0" data-layout-slot="banner">
          <InfoBanner variant="neutral">
            <p>
              {statementDays === 0
                ? t('home.statement.today')
                : t('home.statement.days', { count: statementDays })}
            </p>
            <p className="font-light text-secondary">
              {t('home.statement.dueSummary', {
                amount: dueThisPeriod,
                date: formattedDueDate,
              })}
            </p>
          </InfoBanner>
        </div>
      ) : null}

      <div
        className="grid min-w-0 grid-cols-2 gap-x-2"
        data-layout-slot="stats"
      >
        <StatPanel
          className="col-start-1"
          icon="/assets/home/balance.svg"
          primary={
            <StatValue label={t('home.statement.available')}>{availableToSpend}</StatValue>
          }
        >
          <div className="border-t border-border pt-4">
            <StatValue
              label={
                formattedDueDate === null
                  ? t('home.statement.period')
                  : t('home.statement.periodDue', { date: formattedDueDate })
              }
            >
              {dueThisPeriod}
            </StatValue>
          </div>
        </StatPanel>
        <StatPanel
          className="col-start-2"
          icon="/assets/home/calendar.svg"
          primary={
            <StatValue
              label={
                <>
                  <span>{t('home.statement.dueDate')}</span>
                  <Button
                    className="-m-2 shrink-0 p-2 text-secondary"
                    variant="ghost"
                    size="back"
                    textStyle="body"
                    aria-label={t('home.statement.dueDateInfoLabel')}
                    aria-controls="due-date-info"
                    aria-expanded={dueDateInfoOpen}
                    onClick={() => setDueDateInfoOpen((open) => !open)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setDueDateInfoOpen(false)
                    }}
                  >
                    <TokenIcon className="size-3.5 text-secondary" src="/assets/home/info.svg" />
                  </Button>
                  {dueDateInfoOpen ? (
                    <span
                      className="absolute top-full right-0 z-20 mt-1 w-[270px] border border-border bg-primary-foreground px-4 py-3 text-left text-xs leading-5 font-light text-secondary normal-case"
                      id="due-date-info"
                    >
                      {t('home.statement.dueDateInfo')}
                    </span>
                  ) : null}
                </>
              }
            >
              {formattedDueDate ?? t('common.notAvailable')}
            </StatValue>
          }
        >
          {hasDebt ? (
            <div className="min-w-0 border-t border-border pt-[14px]">
              <Button
                className="w-full"
                variant="default"
                size="md"
                textStyle="strong"
                aria-label={t('home.statement.makePayment')}
                onClick={onPayNow}
              >
                <span className="min-w-0 truncate">{t('home.statement.payNow')}</span>
              </Button>
            </div>
          ) : null}
        </StatPanel>
      </div>

      {selectedCard ? (
        <div className="min-w-0" data-layout-slot="management">
          <CardManagementPanel
            card={selectedCard}
            cardholderLastName={cardholderLastName}
            cardholderTitle={cardholderTitle}
            freezePending={freezePendingCardId === selectedCard.id}
            onActivate={() => dispatchCardCollection({ type: 'open-card-activation', cardId: selectedCard.id })}
            onFreezeToggle={() => void toggleSelectedCardFreeze()}
            onRename={() => dispatchCardCollection({ type: 'open-rename-card', cardId: selectedCard.id })}
            onPin={() => dispatchCardCollection({ type: 'open-card-pin', cardId: selectedCard.id })}
          />
        </div>
      ) : null}
      {cardStatusError ? (
        <InfoBanner variant="warning">{t('home.cards.errors.status')}</InfoBanner>
      ) : null}

      {selectedCard ? (
        <div className="min-w-0" data-layout-slot="getting-started">
          <GettingStartedSection
            appleWalletAdded={false}
            canOrderPhysical={cardCollection.cards.length < 3}
            hasPhysicalCard={cardCollection.cards.some((card) => card.kind === 'Physical')}
            onOrderPhysical={() => dispatchCardCollection({ type: 'open-physical-card', name: physicalCard?.name || 'Travel' })}
          />
        </div>
      ) : null}

      <SectionDivider />

      <SectionHeader
        action={
          <Button
            className={hasTransactions ? undefined : 'disabled:opacity-0'}
            variant="outline"
            size="compact"
            textStyle="body"
            disabled={!hasTransactions}
            onClick={onViewAll}
          >
            {t('common.actions.viewAll')}
          </Button>
        }
      >
        {t('home.activity')}
      </SectionHeader>
      {paymentPlansError ? (
        <InfoBanner variant="warning">
          {t('home.paymentPlans.errors.load')}
        </InfoBanner>
      ) : null}
      {transactionsError ? (
        <InfoBanner variant="warning">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span>{t('transactions.errors.load')}</span>
            {onRetryTransactions ? (
              <Button variant="outline" size="sm" onClick={onRetryTransactions}>
                {t('common.actions.retry')}
              </Button>
            ) : null}
          </div>
        </InfoBanner>
      ) : null}
      {transactionsLoading ? (
        <TransactionListSkeleton rows={5} />
      ) : hasInitialTransactionsError ? null : (
        <TransactionList
          canPayOverTime={canPayOverTime}
          paymentPlansByTransactionId={paymentPlansByTransactionId}
          transactions={transactions}
          onSelect={setSelectedTransaction}
        />
      )}

      {plans.length > 0 ? (
        <>
          <SectionDivider />
          <PaymentPlansSection plans={plans} onSelect={setSelectedPlanId} />
        </>
      ) : null}

      <SectionDivider />

      <YourCards
        cards={cardCollection.cards}
        error={cardsError}
        selectedCardId={selectedCardId ?? cardCollection.selectedCardId}
        onNew={() => dispatchCardCollection({ type: 'open-new-card' })}
        onRetry={onRetryCards}
        onSelect={selectCard}
      />

      <InfoBanner variant="warning">
        {t('home.concierge.cardholderInfo')}
      </InfoBanner>

      <SectionDivider />

      <section className="flex min-w-0 flex-col gap-2">
        <SectionHeader>{t('home.concierge.title')}</SectionHeader>
        <p className="text-xs leading-5 font-light text-secondary">
          {t('home.concierge.description')}
        </p>
        <div className="flex min-w-0 gap-2 py-4">
          <Button
            className="flex-1"
            variant="outline"
            size="support"
            textStyle="body-light"
            asChild
          >
            <a href="https://wa.me/971554570290" target="_blank" rel="noopener noreferrer">
              <span className="min-w-0 truncate">{t('home.concierge.message')}</span>
            </a>
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            size="support"
            textStyle="body-light"
            asChild
          >
            <a href="https://wa.me/971554570290" target="_blank" rel="noopener noreferrer">
              <span className="min-w-0 truncate">{t('home.concierge.limitReview')}</span>
            </a>
          </Button>
        </div>
      </section>

      <div className="py-4">
        <Button
          className="w-full"
          variant="outline"
          size="lg"
          textStyle="regular"
          onClick={onSignOut}
        >
          {t('common.actions.signOut')}
        </Button>
      </div>

      {selectedTransaction ? (
        <TransactionDetailModal
          canPayOverTime={canPayOverTime(selectedTransaction)}
          paymentPlan={paymentPlansByTransactionId.get(selectedTransaction.id)}
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onPayOverTime={() => {
            setSelectedTransaction(null)
            paymentPlanStart.open(selectedTransaction)
          }}
        />
      ) : null}

      {paymentPlanStart.transaction ? (
        <PaymentPlanStartModal
          error={paymentPlanStart.error}
          isSubmitting={paymentPlanStart.isSubmitting}
          transaction={paymentPlanStart.transaction}
          onClose={paymentPlanStart.close}
          onStart={(term) => void paymentPlanStart.start(term)}
        />
      ) : null}

      {selectedPlan && settlePlan ? (
        <PaymentPlanDetailsModal
          plan={selectedPlan}
          onClose={() => setSelectedPlanId(null)}
          onSettle={() => openSettlementConfirmation(selectedPlan.id)}
        />
      ) : null}

      {settlementPlan && settlePlan ? (
        <SettlePaymentPlanModal
          error={paymentPlanSettlement.error}
          isSubmitting={paymentPlanSettlement.isSubmitting}
          plan={settlementPlan}
          onCancel={paymentPlanSettlement.close}
          onConfirm={() => void paymentPlanSettlement.settle()}
        />
      ) : null}

      {newCardFlow.status === 'editing' ||
      (newCardFlow.status === 'issuing' && newCardFlow.cardType === 'Virtual') ? (
        <NewCardModal
          name={newCardFlow.name}
          cardType={newCardFlow.cardType}
          status={physicalCardPreparing ? 'loading' : newCardFlow.status}
          validationAttempted={
            newCardFlow.status === 'editing' ? newCardFlow.validationAttempted : false
          }
          requestError={newCardIssueError ?? undefined}
          onTypeChange={(cardType) => {
            setNewCardIssueError(null)
            dispatchCardCollection({ type: 'select-new-card-type', cardType })
          }}
          onNameChange={(name) => {
            setNewCardIssueError(null)
            dispatchCardCollection({ type: 'change-new-card-name', name })
          }}
          onCancel={() => {
            setNewCardIssueError(null)
            dispatchCardCollection({ type: 'close-new-card' })
          }}
          onSave={submitNewCard}
        />
      ) : null}

      {physicalCard?.isOpen ? <PhysicalCardDeliveryModal flow={physicalCard} /> : null}

      {renameCardFlow.status !== 'closed' ? (
        <RenameCardModal
          name={renameCardFlow.name}
          status={renameCardFlow.status}
          error={
            renameCardFlow.status === 'editing'
              ? (renameCardFlow.error ?? undefined)
              : undefined
          }
          onNameChange={(name) =>
            dispatchCardCollection({ type: 'change-rename-card-name', name })
          }
          onCancel={() => dispatchCardCollection({ type: 'close-rename-card' })}
          onSave={() => dispatchCardCollection({ type: 'submit-rename-card' })}
        />
      ) : null}

      {cardActivationFlow.status === 'editing' || cardActivationFlow.status === 'activating' ? (
        <CardActivationModal
          loading={cardActivationFlow.status === 'activating'}
          error={cardActivationFlow.error}
          expiry={cardActivationFlow.expiry}
          lastFour={cardActivationFlow.lastFour}
          validationAttempted={cardActivationFlow.validationAttempted}
          onCancel={() => dispatchCardCollection({ type: 'close-card-activation' })}
          onExpiryChange={(value) =>
            dispatchCardCollection({ type: 'change-card-activation-expiry', value })
          }
          onLastFourChange={(value) =>
            dispatchCardCollection({ type: 'change-card-activation-last-four', value })
          }
          onSubmit={() => void submitCardActivation()}
        />
      ) : null}

      {cardPinFlow.status !== 'closed' && pinCard ? (
        <CardPinModal
          cardName={pinCard.name}
          hasPin={pinCard.hasPin}
          state={cardPinFlow}
          onPinChange={(pin) =>
            dispatchCardCollection({
              type:
                cardPinFlow.status === 'entering'
                  ? 'change-card-pin'
                  : 'change-card-pin-confirmation',
              pin,
            })
          }
          onBack={() => dispatchCardCollection({ type: 'return-card-pin' })}
          onCancel={() => dispatchCardCollection({ type: 'close-card-pin' })}
          onSave={() => {
            if (cardPinFlow.status === 'entering') {
              dispatchCardCollection({ type: 'advance-card-pin' })
              return
            }

            dispatchCardCollection({ type: 'save-card-pin' })
          }}
        />
      ) : null}
    </HomeContentFrame>
  )
}
