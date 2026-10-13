import {
  isApiRequestError,
  type ApiClient,
} from '../../../shared/api/api-client'
import type { GatewayResult } from '../../../shared/api/gateway-result'
import type { CardDetailsData, HomeCard } from '../model/card-collection'
import type { CardsGateway } from './cards-gateway'

const FAILURE = {
  ok: false as const,
  code: 'cards-failed',
  message: 'Unable to load cards. Try again.',
}

const STATUS_FAILURE = {
  ok: false as const,
  code: 'card-status-failed',
  message: 'Unable to update card status. Try again.',
}

const ISSUE_FAILURE = {
  ok: false as const,
  code: 'card-issue-failed',
  message: 'Unable to issue card. Try again.',
}

const RENAME_FAILURE = {
  ok: false as const,
  code: 'card-rename-failed',
  message: 'Unable to rename card. Try again.',
}

const PIN_FAILURE = {
  ok: false as const,
  code: 'card-pin-failed',
  message: 'Unable to update PIN. Try again.',
}

const DETAILS_FAILURE = {
  ok: false as const,
  code: 'card-details-failed',
  message: 'Unable to load card details. Try again.',
}

const ACTIVATION_FAILURE = {
  ok: false as const,
  code: 'card-activation-failed',
  message: 'home.activation.errors.request',
}

type ApiCardStatus = 'notActivated' | 'active' | 'locked' | 'canceled'
type ApiCardType = 'physical' | 'virtual'
type DeliveryStatus = 'manufacturing' | 'in_transit' | 'should_be_delivered'

const DELIVERY_STATUSES = {
  manufacturing: 'Manufacturing',
  in_transit: 'In transit',
  should_be_delivered: 'Should be delivered',
} as const satisfies Record<DeliveryStatus, HomeCard['status']>

interface ParsedCard {
  id: number
  rainId: string
  cardType: ApiCardType
  name: string | null
  status: ApiCardStatus
  lastFour: string | null
  hasPin: boolean
  deliveryStatus: DeliveryStatus | null
  expirationMonth: string | null
  expirationYear: string | null
  createdAt: Date
  physicalOrderId: number | null | undefined
}

export function createHttpCardsGateway(apiClient: ApiClient): CardsGateway {
  return {
    async activatePhysical(card, lastFour, expiry, signal) {
      if (!card.backendId || !card.physicalOrderId || card.kind !== 'Physical') return ACTIVATION_FAILURE
      try {
        const received = await apiClient.request(`cards/physical-orders/${card.physicalOrderId}/confirm-received/`, {
          authenticated: true, method: 'POST', json: {}, retry: false, signal,
        })
        if (signal?.aborted || !isRecord(received) || received.id !== card.physicalOrderId ||
            String(received.card_id) !== card.id || received.status !== 'issued' || received.received !== true) return ACTIVATION_FAILURE
        const [month, year] = expiry.split('/')
        const response = await apiClient.request(`cards/${card.backendId}/activate-physical/`, {
          authenticated: true, method: 'POST',
          json: { last4: lastFour, expiration_month: String(Number(month)), expiration_year: `20${year}` },
          retry: false, signal,
        })
        const activated = isRecord(response) && response.success === true ? readCard(response.card) : null
        return activated?.status === 'active' && activated.cardType === 'physical' &&
          String(activated.id) === card.id && activated.rainId === card.backendId
          ? { ok: true, data: mapCard(activated) } : ACTIVATION_FAILURE
      } catch (error) {
        if (!isApiRequestError(error)) return ACTIVATION_FAILURE
        const body = readApiErrorBody(error.body)
        const detail = isRecord(body) ? body.detail ?? body.error : null
        const mismatch = detail === 'Card details do not match.' ||
          (Array.isArray(detail) && detail[0] === 'Card details do not match.')
        const uncertain = error.kind === 'network' || (error.status !== null && error.status >= 500) ||
          detail === 'Card is not pending activation.' || detail === 'Physical card is not pending delivery confirmation.'
        if (uncertain && !signal?.aborted) {
          try {
            const cards = readCardsResponse(await apiClient.request('cards/', { authenticated: true, retry: false, signal }))
            const activated = cards?.find((item) => item.id === card.id && item.backendId === card.backendId && item.kind === 'Physical' && item.status === 'Active')
            if (activated) return { ok: true, data: activated }
          } catch { /* Keep the request error if the reconciliation also fails. */ }
        }
        return { ...ACTIVATION_FAILURE, message: error.status === 429
          ? 'home.activation.errors.locked'
          : mismatch ? 'home.activation.errors.mismatch' : ACTIVATION_FAILURE.message }
      }
    },
    async list(signal) {
      try {
        const cards = readCardsResponse(
          await apiClient.request('cards/', {
            authenticated: true,
            signal,
          }),
        )

        return cards === null ? FAILURE : { ok: true, data: cards }
      } catch {
        return FAILURE
      }
    },
    async issueVirtual(name, signal) {
      try {
        const value = await apiClient.request('cards/issue/', {
          authenticated: true,
          method: 'POST',
          json: { tier: 2, ...(name === undefined ? {} : { name }) },
          retry: false,
          ...(signal === undefined ? {} : { signal }),
        })

        return readCardIssueResponse(value) ?? ISSUE_FAILURE
      } catch {
        return ISSUE_FAILURE
      }
    },
    async rename(cardId, name, signal) {
      try {
        const value = await apiClient.request(`cards/${cardId}/name/`, {
          authenticated: true,
          method: 'PATCH',
          json: { name },
          retry: false,
          ...(signal === undefined ? {} : { signal }),
        })
        if (!isRecord(value) || value.success !== true || !isRecord(value.card)) {
          return RENAME_FAILURE
        }
        const card = readCard(value.card)
        return card === null
          ? RENAME_FAILURE
          : { ok: true, data: { name: mapCard(card).name } }
      } catch {
        return RENAME_FAILURE
      }
    },
    async setFrozen(cardId, frozen, signal) {
      try {
        const action = frozen ? 'freeze' : 'unfreeze'
        const value = await apiClient.request(`cards/${cardId}/status/`, {
          authenticated: true,
          method: 'PATCH',
          json: { action },
          retry: false,
          ...(signal === undefined ? {} : { signal }),
        })

        return isStatusUpdateResponse(value, cardId, frozen) ? { ok: true } : STATUS_FAILURE
      } catch {
        return STATUS_FAILURE
      }
    },
    async changePin(cardId, pin, signal) {
      try {
        const value = await apiClient.request('cards/', {
          authenticated: true,
          method: 'PATCH',
          json: { card_id: cardId, new_pin: pin },
          retry: false,
          ...(signal === undefined ? {} : { signal }),
        })

        return isPinUpdateResponse(value) ? { ok: true } : PIN_FAILURE
      } catch (error) {
        const message = readPinValidationMessage(error)
        return message === null ? PIN_FAILURE : { ...PIN_FAILURE, message }
      }
    },
    async getDetails(cardId, expiration, signal) {
      try {
        const details = readCardDetailsResponse(
          await apiClient.request(`cards/${cardId}/secrets/`, {
            authenticated: true,
            ...(signal === undefined ? {} : { signal }),
          }),
          expiration,
        )

        return details === null ? DETAILS_FAILURE : { ok: true, data: details }
      } catch {
        return DETAILS_FAILURE
      }
    },
  }
}

function readCardIssueResponse(
  value: unknown,
): GatewayResult<{ cardId: string }> | null {
  if (!isRecord(value)) return null

  const { status, message, card_id: cardId } = value
  if (status !== 'success' || typeof message !== 'string' || !isUuid(cardId)) {
    return null
  }

  return { ok: true, data: { cardId } }
}

function readPinValidationMessage(error: unknown): string | null {
  if (!isApiRequestError(error)) return null

  const body = readApiErrorBody(error.body)
  if (!isRecord(body) || !isRecord(body.details)) return null

  const messages = body.details.new_pin
  if (!Array.isArray(messages)) return null

  const message = messages.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  return message?.trim() ?? null
}

function readApiErrorBody(value: unknown): unknown {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function readCardsResponse(value: unknown): readonly HomeCard[] | null {
  if (!isRecord(value)) return null

  const { success, cards, count } = value
  if (
    success !== true ||
    !Array.isArray(cards) ||
    typeof count !== 'number' ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count !== cards.length
  ) {
    return null
  }

  const parsedCards: ParsedCard[] = []
  for (const card of cards) {
    const parsedCard = readCard(card)
    if (parsedCard === null) return null
    parsedCards.push(parsedCard)
  }

  return parsedCards
    .filter((card) => card.status !== 'canceled')
    .map(mapCard)
}

function readCard(value: unknown): ParsedCard | null {
  if (!isRecord(value)) return null

  const {
    id,
    rain_id: rainId,
    card_type: cardType,
    name,
    status,
    last4,
    is_set_pin: hasPin,
    expiration_month: expirationMonth,
    expiration_year: expirationYear,
    created_at: createdAt,
  } = value
  const deliveryStatus = value.delivery_status
  const physicalOrderId = value.physical_card_order_id
  const normalizedExpirationMonth = readExpirationMonth(expirationMonth)
  const normalizedExpirationYear = readExpirationYear(expirationYear)
  const normalizedName = readCardName(name)
  const normalizedCreatedAt = readDate(createdAt)
  if (
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id < 0 ||
    !isUuid(rainId) ||
    !isCardType(cardType) ||
    normalizedName === false ||
    normalizedCreatedAt === null ||
    !isCardStatus(status) ||
    (last4 !== null && (typeof last4 !== 'string' || !/^\d{4}$/.test(last4))) ||
    typeof hasPin !== 'boolean' ||
    (physicalOrderId !== undefined && physicalOrderId !== null &&
      (typeof physicalOrderId !== 'number' || !Number.isSafeInteger(physicalOrderId) || physicalOrderId <= 0)) ||
    (deliveryStatus !== null && !isDeliveryStatus(deliveryStatus)) ||
    normalizedExpirationMonth === false ||
    normalizedExpirationYear === false
  ) {
    return null
  }

  return {
    id,
    rainId,
    cardType,
    name: normalizedName,
    status,
    lastFour: last4,
    hasPin,
    deliveryStatus,
    expirationMonth: normalizedExpirationMonth,
    expirationYear: normalizedExpirationYear,
    createdAt: normalizedCreatedAt,
    physicalOrderId,
  }
}

function mapCard(card: ParsedCard): HomeCard {
  const kind = card.cardType === 'virtual' ? 'Virtual' : 'Physical'

  return {
    id: String(card.id),
    backendId: card.rainId,
    name: card.name ?? `${kind} Card`,
    kind,
    lastFour: card.lastFour,
    status:
      card.status === 'active'
        ? 'Active'
        : card.status === 'locked'
          ? 'Frozen'
          : card.cardType === 'physical' && card.deliveryStatus !== null
            ? DELIVERY_STATUSES[card.deliveryStatus]
            : 'Not activated',
    hasPin: card.hasPin,
    details: null,
    expiration:
      card.expirationMonth !== null && card.expirationYear !== null
        ? `${card.expirationMonth}/${card.expirationYear.slice(-2)}`
        : null,
    createdAt: card.createdAt,
    ...(card.physicalOrderId === undefined ? {} : { physicalOrderId: card.physicalOrderId }),
  }
}

function isStatusUpdateResponse(value: unknown, cardId: string, frozen: boolean): boolean {
  if (!isRecord(value)) return false

  return (
    value.status === 'success' &&
    value.card_id === cardId &&
    value.new_status === (frozen ? 'locked' : 'active') &&
    typeof value.message === 'string'
  )
}

function isPinUpdateResponse(value: unknown): boolean {
  return (
    isRecord(value) && value.success === true && typeof value.message === 'string'
  )
}

function readCardDetailsResponse(value: unknown, expiration: string): CardDetailsData | null {
  if (!isRecord(value)) return null

  const { pan, cvc } = value
  if (
    typeof pan !== 'string' ||
    !/^\d{12,19}$/.test(pan) ||
    typeof cvc !== 'string' ||
    !/^\d{3,4}$/.test(cvc) ||
    !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiration)
  ) {
    return null
  }

  return {
    number: pan.replace(/(\d{4})(?=\d)/g, '$1 '),
    expires: expiration,
    securityCode: cvc,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCardType(value: unknown): value is ApiCardType {
  return value === 'physical' || value === 'virtual'
}

function isCardStatus(value: unknown): value is ApiCardStatus {
  return (
    value === 'notActivated' || value === 'active' || value === 'locked' || value === 'canceled'
  )
}

function readCardName(value: unknown): string | null | false {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > 40) return false
  return value.trim() || null
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return (
    value === 'manufacturing' ||
    value === 'in_transit' ||
    value === 'should_be_delivered'
  )
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

function readExpirationMonth(value: unknown): string | null | false {
  if (value === null) return null
  if (typeof value !== 'string' || !/^(?:[1-9]|0[1-9]|1[0-2])$/.test(value)) return false
  return value.padStart(2, '0')
}

function readExpirationYear(value: unknown): string | null | false {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{2,4}$/.test(value)) return false
  return value
}
