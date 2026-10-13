import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import type { CardsGateway } from './api/cards-gateway'
import type { GatewayResult } from '../../shared/api/gateway-result'
import { CARDS_QUERY_KEY, CardsQueryError, cardsQueryOptions } from './cards-query'
import type { CardDetailsData, HomeCard } from './model/card-collection'

type CardsStatus = 'idle' | 'loading' | 'ready' | 'error'

const ISSUE_REFRESH_FAILURE = {
  ok: false as const,
  code: 'card-issue-refresh-failed',
  message: 'Card issued, but the card list could not be refreshed. Try again.',
}

const ISSUE_CANCELED_FAILURE = {
  ok: false as const,
  code: 'card-issue-canceled',
  message: 'Unable to issue card. Try again.',
}

interface CardsValue {
  activatePhysical: CardsGateway['activatePhysical']
  status: CardsStatus
  cards: readonly HomeCard[]
  selectedCardId: string | null
  selectedCard: HomeCard | null
  error: string | null
  selectCard(cardId: string): void
  retry(): void
  resetSession(): void
  refreshPhysical(cardId: number, name: string | null, signal: AbortSignal): Promise<boolean>
  issueVirtual(name: string, signal?: AbortSignal): Promise<GatewayResult>
  rename(
    cardId: string,
    name: string,
    signal?: AbortSignal,
  ): Promise<GatewayResult<{ name: string }>>
  setFrozen(cardId: string, frozen: boolean, signal?: AbortSignal): Promise<GatewayResult>
  changePin(cardId: string, pin: string, signal?: AbortSignal): Promise<GatewayResult>
  getDetails(
    cardId: string,
    expiration: string,
    signal?: AbortSignal,
  ): Promise<GatewayResult<CardDetailsData>>
}

interface CardsProviderProps {
  gateway: CardsGateway
  enabled: boolean
  sessionIdentity?: string | number | null
  children: ReactNode
}

const CardsContext = createContext<CardsValue | null>(null)

export function CardsProvider({
  gateway,
  enabled,
  sessionIdentity = null,
  children,
}: CardsProviderProps) {
  const queryClient = useQueryClient()
  const query = useQuery({ ...cardsQueryOptions(gateway), enabled })
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const pendingIssueRef = useRef<{ cardId: string } | null>(null)
  const sessionIdentityRef = useRef(sessionIdentity)
  const sessionGenerationRef = useRef(0)
  const status: CardsStatus = !enabled && query.data === undefined
    ? 'idle'
    : query.isPending || query.isFetching
      ? 'loading'
      : query.isError
        ? 'error'
        : 'ready'
  const error =
    status === 'error'
      ? query.error instanceof CardsQueryError
        ? query.error.message
        : 'Unable to load cards. Try again.'
      : null
  const retry = useCallback(() => {
    void query.refetch()
  }, [query])
  const selectedCard =
    query.data?.find((card) => card.id === selectedCardId) ??
    query.data?.[0] ??
    null
  const selectCard = useCallback(
    (cardId: string) => {
      if (query.data?.some((card) => card.id === cardId)) setSelectedCardId(cardId)
    },
    [query.data],
  )
  useLayoutEffect(() => {
    if (sessionIdentityRef.current === sessionIdentity) return

    sessionIdentityRef.current = sessionIdentity
    sessionGenerationRef.current += 1
    pendingIssueRef.current = null
    setSelectedCardId(null)
  }, [sessionIdentity])
  const resetSession = useCallback(() => {
    sessionGenerationRef.current += 1
    pendingIssueRef.current = null
    setSelectedCardId(null)
    void queryClient.cancelQueries({ queryKey: CARDS_QUERY_KEY })
    queryClient.removeQueries({ queryKey: CARDS_QUERY_KEY })
  }, [queryClient])
  const issueVirtual = useCallback(
    async (name: string, signal?: AbortSignal): Promise<GatewayResult> => {
      const sessionGeneration = sessionGenerationRef.current
      let pendingIssue = pendingIssueRef.current
      if (pendingIssue === null) {
        const result = await gateway.issueVirtual(name, signal)
        if (!result.ok) return result
        if (sessionGeneration !== sessionGenerationRef.current) {
          return ISSUE_CANCELED_FAILURE
        }

        pendingIssue = { cardId: result.data.cardId }
        pendingIssueRef.current = pendingIssue
      }

      const refreshed = await gateway.list(signal)
      if (sessionGeneration !== sessionGenerationRef.current) {
        return ISSUE_CANCELED_FAILURE
      }
      if (!refreshed.ok) return ISSUE_REFRESH_FAILURE

      const issuedCard = refreshed.data.find(
        (card) => card.backendId === pendingIssue.cardId,
      )
      queryClient.setQueryData<readonly HomeCard[]>(CARDS_QUERY_KEY, refreshed.data)
      if (issuedCard === undefined) return ISSUE_REFRESH_FAILURE

      pendingIssueRef.current = null
      setSelectedCardId(issuedCard.id)
      return { ok: true }
    },
    [gateway, queryClient],
  )
  const rename = useCallback(
    async (cardId: string, name: string, signal?: AbortSignal) => {
      const result = await gateway.rename(cardId, name, signal)
      if (!result.ok) return result

      queryClient.setQueryData<readonly HomeCard[]>(CARDS_QUERY_KEY, (cards) =>
        cards?.map((card) =>
          card.backendId === cardId ? { ...card, name: result.data.name } : card,
        ),
      )
      return result
    },
    [gateway, queryClient],
  )
  const setFrozen = useCallback(
    async (cardId: string, frozen: boolean, signal?: AbortSignal) => {
      const result = await gateway.setFrozen(cardId, frozen, signal)
      if (!result.ok) return result

      queryClient.setQueryData<readonly HomeCard[]>(CARDS_QUERY_KEY, (cards) =>
        cards?.map((card) =>
          card.backendId === cardId
            ? { ...card, status: frozen ? ('Frozen' as const) : ('Active' as const) }
            : card,
        ),
      )
      return result
    },
    [gateway, queryClient],
  )
  const changePin = useCallback(
    async (cardId: string, pin: string, signal?: AbortSignal) => {
      const generation = sessionGenerationRef.current
      const result = await gateway.changePin(cardId, pin, signal)
      if (signal?.aborted || generation !== sessionGenerationRef.current) {
        return { ok: false as const, code: 'card-pin-canceled', message: 'Unable to update PIN. Try again.' }
      }
      if (!result.ok) return result

      queryClient.setQueryData<readonly HomeCard[]>(CARDS_QUERY_KEY, (cards) =>
        cards?.map((card) =>
          card.backendId === cardId ? { ...card, hasPin: true } : card,
        ),
      )
      return result
    },
    [gateway, queryClient],
  )
  const getDetails = useCallback(
    (cardId: string, expiration: string, signal?: AbortSignal) =>
      gateway.getDetails(cardId, expiration, signal),
    [gateway],
  )
  const activatePhysical = useCallback<CardsGateway['activatePhysical']>(async (card, lastFour, expiry, signal) => {
    const generation = sessionGenerationRef.current
    const result = await gateway.activatePhysical(card, lastFour, expiry, signal)
    if (signal?.aborted || generation !== sessionGenerationRef.current) {
      return { ok: false, code: 'card-activation-canceled', message: 'home.activation.errors.request' }
    }
    if (!result.ok) return result
    queryClient.setQueryData<readonly HomeCard[]>(CARDS_QUERY_KEY, (cards) =>
      cards?.map((current) => current.id === card.id
        ? { ...current, ...result.data, name: current.name } : current),
    )
    return result
  }, [gateway, queryClient])
  const refreshPhysical = useCallback(async (cardId: number, name: string | null, signal: AbortSignal) => {
    const generation = sessionGenerationRef.current
    const before = queryClient.getQueryData<readonly HomeCard[]>(CARDS_QUERY_KEY)
    const result = await gateway.list(signal)
    if (signal.aborted || generation !== sessionGenerationRef.current || !result.ok) throw new Error('Unable to refresh cards')
    const card = result.data.find((item) => item.id === String(cardId) && item.kind === 'Physical')
    if (!card?.backendId) throw new Error('Issued card is not available yet')
    // Preserve successful card actions completed while the list request was pending.
    // ponytail: O(n²) merge for a small card list; use ID maps if card counts grow.
    queryClient.setQueryData<readonly HomeCard[]>(CARDS_QUERY_KEY, (current) => {
      const changed = current?.filter((item) => item !== before?.find((old) => old.id === item.id)) ?? []
      return [
        ...result.data.map((item) => changed.find((newer) => newer.id === item.id) ?? item),
        ...changed.filter((item) => !result.data.some((listed) => listed.id === item.id)),
      ]
    })
    let renamed = true
    if (name && card.name !== name) {
      const result = await gateway.rename(card.backendId, name, signal)
      if (signal.aborted || generation !== sessionGenerationRef.current) throw new Error('Session ended')
      renamed = result.ok
      if (result.ok) queryClient.setQueryData<readonly HomeCard[]>(CARDS_QUERY_KEY, (cards) =>
        cards?.map((item) => item.id === card.id ? { ...item, name: result.data.name } : item),
      )
    }
    setSelectedCardId(card.id)
    return renamed
  }, [gateway, queryClient])
  const value = useMemo<CardsValue>(
    () => ({
      status,
      cards: status === 'ready' ? (query.data ?? []) : [],
      selectedCardId: selectedCard?.id ?? null,
      selectedCard,
      error,
      selectCard,
      retry,
      resetSession,
      refreshPhysical,
      activatePhysical,
      issueVirtual,
      rename,
      setFrozen,
      changePin,
      getDetails,
    }),
    [activatePhysical, refreshPhysical, changePin, error, getDetails, issueVirtual, query.data, rename, resetSession, retry, selectCard, selectedCard, setFrozen, status],
  )

  return <CardsContext value={value}>{children}</CardsContext>
}

// React Refresh requires non-component exports to be explicitly acknowledged.
// eslint-disable-next-line react-refresh/only-export-components
export function useCards(): CardsValue {
  const value = useContext(CardsContext)
  if (value === null) throw new Error('useCards must be used within CardsProvider')
  return value
}
