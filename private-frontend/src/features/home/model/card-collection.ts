export interface CardDetailsData {
  number: string
  expires: string
  securityCode: string
}

export interface HomeCard {
  id: string
  backendId: string | null
  name: string
  kind: CardKind
  lastFour: string | null
  status: 'Active' | 'Frozen' | 'Manufacturing' | 'In transit' | 'Should be delivered' | 'Not activated'
  hasPin: boolean
  details: CardDetailsData | null
  expiration?: string | null
  createdAt?: Date
  physicalOrderId?: number | null
}

export type CardKind = 'Virtual' | 'Physical'

export const CARD_STATUS_LABELS = {
  Active: 'home.cards.status.active',
  Frozen: 'home.cards.status.frozen',
  Manufacturing: 'home.cards.status.manufacturing',
  'In transit': 'home.cards.status.inTransit',
  'Should be delivered': 'home.cards.status.shouldBeDelivered',
  'Not activated': 'home.cards.status.notActivated',
} as const satisfies Record<HomeCard['status'], string>

export function isCardInDelivery(card: HomeCard): boolean {
  return card.status === 'Manufacturing' || card.status === 'In transit' || card.status === 'Should be delivered'
}

export function canShowCardNumber(card: HomeCard): boolean {
  return card.kind !== 'Physical' || card.status === 'Active' || card.status === 'Frozen'
}

export type NewCardFlowState =
  | { status: 'closed' }
  | {
      status: 'editing'
      name: string
      cardType: CardKind
      validationAttempted: boolean
    }
  | { status: 'issuing'; name: string; cardType: 'Virtual' }

export type RenameCardFlowState =
  | { status: 'closed' }
  | {
      status: 'editing'
      cardId: string
      name: string
      error: string | null
    }
  | { status: 'saving'; cardId: string; name: string }

export type PinValidationError =
  | 'required'
  | 'incomplete'
  | 'mismatch'
  | 'repeated'
  | 'sequence'
  | 'consecutive'
  | 'weak'
  | 'alternating'
  | { type: 'request'; message: string }
  | null

export type CardPinFlowState =
  | { status: 'closed' }
  | { status: 'entering'; cardId: string; pin: string; error: PinValidationError }
  | {
      status: 'confirming'
      cardId: string
      pin: string
      confirmation: string
      error: PinValidationError
    }
  | { status: 'saving'; cardId: string; pin: string }

export type CardActivationFlowState =
  | { status: 'closed' }
  | {
      status: 'editing' | 'activating'
      cardId: string
      lastFour: string
      expiry: string
      validationAttempted: boolean
      error: string | null
    }

export interface CardCollectionState {
  cards: readonly HomeCard[]
  selectedCardId: string | null
  newCard: NewCardFlowState
  renameCard: RenameCardFlowState
  cardActivation: CardActivationFlowState
  cardPin: CardPinFlowState
}

export type CardCollectionEvent =
  | { type: 'replace-cards'; cards: readonly HomeCard[] }
  | { type: 'open-new-card' }
  | { type: 'open-physical-card'; name?: string }
  | { type: 'close-new-card' }
  | { type: 'select-new-card-type'; cardType: CardKind }
  | { type: 'change-new-card-name'; name: string }
  | { type: 'submit-new-card' }
  | { type: 'new-card-issue-failed' }
  | { type: 'new-card-issue-succeeded' }
  | { type: 'select-card'; cardId: string }
  | { type: 'set-card-frozen'; cardId: string; frozen: boolean }
  | { type: 'open-rename-card'; cardId: string }
  | { type: 'close-rename-card' }
  | { type: 'change-rename-card-name'; name: string }
  | { type: 'submit-rename-card' }
  | { type: 'rename-card-saved'; name: string }
  | { type: 'rename-card-save-failed'; message: string }
  | { type: 'open-card-activation'; cardId: string }
  | { type: 'close-card-activation' }
  | { type: 'change-card-activation-last-four'; value: string }
  | { type: 'change-card-activation-expiry'; value: string }
  | { type: 'submit-card-activation' }
  | { type: 'card-activation-succeeded'; card: HomeCard }
  | { type: 'card-activation-failed'; message: string }
  | { type: 'open-card-pin'; cardId: string }
  | { type: 'close-card-pin' }
  | { type: 'change-card-pin'; pin: string }
  | { type: 'advance-card-pin' }
  | { type: 'return-card-pin' }
  | { type: 'change-card-pin-confirmation'; pin: string }
  | { type: 'save-card-pin' }
  | { type: 'card-pin-saved' }
  | { type: 'card-pin-update-confirmed' }
  | { type: 'card-pin-save-failed'; message: string }

export function createCardCollectionState(cards: readonly HomeCard[]): CardCollectionState {
  return {
    cards,
    selectedCardId: cards[0]?.id ?? null,
    newCard: { status: 'closed' },
    renameCard: { status: 'closed' },
    cardActivation: { status: 'closed' },
    cardPin: { status: 'closed' },
  }
}

export function cardCollectionReducer(
  state: CardCollectionState,
  event: CardCollectionEvent,
): CardCollectionState {
  switch (event.type) {
    case 'replace-cards': {
      const localCards = state.cards.filter((card) => card.backendId === null)
      const mergedCards = [...event.cards, ...localCards]
      return {
        ...state,
        cards: mergedCards,
        selectedCardId: mergedCards.some((card) => card.id === state.selectedCardId)
          ? state.selectedCardId
          : (mergedCards[0]?.id ?? null),
      }
    }
    case 'open-new-card':
      if (state.cards.length >= 3) return state
      return {
        ...state,
        newCard: {
          status: 'editing',
          name: 'Travel',
          cardType: 'Virtual',
          validationAttempted: false,
        },
      }
    case 'open-physical-card':
      if (state.cards.length >= 3) return state
      return {
        ...state,
        newCard: {
          status: 'editing',
          name: event.name || 'Travel',
          cardType: 'Physical',
          validationAttempted: false,
        },
      }
    case 'close-new-card':
      if (state.newCard.status === 'issuing') return state
      return { ...state, newCard: { status: 'closed' } }
    case 'change-new-card-name':
      if (state.newCard.status !== 'editing') return state
      return {
        ...state,
        newCard: { ...state.newCard, name: event.name, validationAttempted: false },
      }
    case 'select-new-card-type':
      if (state.newCard.status !== 'editing') return state
      return { ...state, newCard: { ...state.newCard, cardType: event.cardType } }
    case 'submit-new-card':
      if (state.newCard.status !== 'editing') return state
      if (!state.newCard.name.trim()) {
        return { ...state, newCard: { ...state.newCard, validationAttempted: true } }
      }
      if (state.newCard.cardType === 'Physical') return state
      return {
        ...state,
        newCard: {
          status: 'issuing',
          name: state.newCard.name.trim(),
          cardType: 'Virtual',
        },
      }
    case 'new-card-issue-failed':
      if (state.newCard.status !== 'issuing' || state.newCard.cardType !== 'Virtual') {
        return state
      }
      return {
        ...state,
        newCard: {
          status: 'editing',
          name: state.newCard.name,
          cardType: 'Virtual',
          validationAttempted: false,
        },
      }
    case 'new-card-issue-succeeded':
      if (state.newCard.status !== 'issuing' || state.newCard.cardType !== 'Virtual') {
        return state
      }
      return { ...state, newCard: { status: 'closed' } }
    case 'select-card':
      if (!state.cards.some((card) => card.id === event.cardId)) return state
      return { ...state, selectedCardId: event.cardId }
    case 'set-card-frozen':
      if (
        !state.cards.some(
          (card) =>
            card.id === event.cardId &&
            (card.status === 'Active' || card.status === 'Frozen'),
        )
      ) {
        return state
      }
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === event.cardId
            ? { ...card, status: event.frozen ? 'Frozen' : 'Active' }
            : card,
        ),
      }
    case 'open-rename-card': {
      const selectedCard = state.cards.find((card) => card.id === event.cardId)
      if (!selectedCard) return state
      return {
        ...state,
        renameCard: {
          status: 'editing',
          cardId: selectedCard.id,
          name: selectedCard.name,
          error: null,
        },
      }
    }
    case 'close-rename-card':
      if (state.renameCard.status === 'saving') return state
      return { ...state, renameCard: { status: 'closed' } }
    case 'change-rename-card-name':
      if (state.renameCard.status !== 'editing') return state
      return {
        ...state,
        renameCard: {
          ...state.renameCard,
          name: event.name,
          error: null,
        },
      }
    case 'submit-rename-card':
      if (state.renameCard.status !== 'editing') return state
      return {
        ...state,
        renameCard: {
          status: 'saving',
          cardId: state.renameCard.cardId,
          name: state.renameCard.name.trim(),
        },
      }
    case 'rename-card-saved': {
      if (state.renameCard.status !== 'saving') return state
      const savedRename = state.renameCard
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === savedRename.cardId ? { ...card, name: event.name } : card,
        ),
        renameCard: { status: 'closed' },
      }
    }
    case 'rename-card-save-failed':
      if (state.renameCard.status !== 'saving') return state
      return {
        ...state,
        renameCard: {
          status: 'editing',
          cardId: state.renameCard.cardId,
          name: state.renameCard.name,
          error: event.message,
        },
      }
    case 'open-card-activation': {
      const selectedCard = state.cards.find((card) => card.id === event.cardId)
      if (selectedCard?.kind !== 'Physical' || !isCardInDelivery(selectedCard)) return state
      return {
        ...state,
        cardActivation: {
          status: 'editing',
          cardId: selectedCard.id,
          lastFour: '',
          expiry: '',
          validationAttempted: false,
          error: null,
        },
      }
    }
    case 'close-card-activation':
      if (state.cardActivation.status !== 'editing') return state
      return { ...state, cardActivation: { status: 'closed' } }
    case 'change-card-activation-last-four':
      if (state.cardActivation.status !== 'editing') return state
      return {
        ...state,
        cardActivation: {
          ...state.cardActivation,
          lastFour: event.value.replace(/\D/g, '').slice(0, 4),
          error: null,
        },
      }
    case 'change-card-activation-expiry':
      if (state.cardActivation.status !== 'editing') return state
      return {
        ...state,
        cardActivation: {
          ...state.cardActivation,
          expiry: normalizeCardExpiry(event.value),
          error: null,
        },
      }
    case 'submit-card-activation':
      if (state.cardActivation.status !== 'editing') return state
      if (!isCardActivationValid(state.cardActivation.lastFour, state.cardActivation.expiry)) {
        return {
          ...state,
          cardActivation: { ...state.cardActivation, validationAttempted: true },
        }
      }
      return { ...state, cardActivation: { ...state.cardActivation, status: 'activating', error: null } }
    case 'card-activation-failed':
      if (state.cardActivation.status !== 'activating') return state
      return { ...state, cardActivation: { ...state.cardActivation, status: 'editing', error: event.message } }
    case 'card-activation-succeeded':
      if (state.cardActivation.status !== 'activating' || event.card.id !== state.cardActivation.cardId || event.card.status !== 'Active') return state
      return {
        ...state,
        cards: state.cards.map((card) => card.id === event.card.id ? { ...card, ...event.card, name: card.name } : card),
        cardActivation: { status: 'closed' },
        cardPin: {
          status: 'entering',
          cardId: state.cardActivation.cardId,
          pin: '',
          error: null,
        },
      }
    case 'open-card-pin': {
      const selectedCard = state.cards.find((card) => card.id === event.cardId)
      if (!selectedCard || selectedCard.status !== 'Active') return state
      return {
        ...state,
        cardPin: { status: 'entering', cardId: selectedCard.id, pin: '', error: null },
      }
    }
    case 'close-card-pin':
      if (state.cardPin.status === 'saving') return state
      return { ...state, cardPin: { status: 'closed' } }
    case 'change-card-pin':
      if (state.cardPin.status !== 'entering') return state
      return {
        ...state,
        cardPin: { ...state.cardPin, pin: normalizePin(event.pin), error: null },
      }
    case 'advance-card-pin': {
      if (state.cardPin.status !== 'entering') return state
      const error = validatePin(state.cardPin.pin)
      if (error !== null) {
        return {
          ...state,
          cardPin: { ...state.cardPin, error },
        }
      }
      return {
        ...state,
        cardPin: {
          status: 'confirming',
          cardId: state.cardPin.cardId,
          pin: state.cardPin.pin,
          confirmation: '',
          error: null,
        },
      }
    }
    case 'return-card-pin':
      if (state.cardPin.status !== 'confirming') return state
      return {
        ...state,
        cardPin: {
          status: 'entering',
          cardId: state.cardPin.cardId,
          pin: state.cardPin.pin,
          error: null,
        },
      }
    case 'change-card-pin-confirmation':
      if (state.cardPin.status !== 'confirming') return state
      return {
        ...state,
        cardPin: {
          ...state.cardPin,
          confirmation: normalizePin(event.pin),
          error: null,
        },
      }
    case 'save-card-pin': {
      if (state.cardPin.status !== 'confirming') return state
      if (state.cardPin.confirmation.length !== 4) {
        return {
          ...state,
          cardPin: {
            ...state.cardPin,
            error: state.cardPin.confirmation.length === 0 ? 'required' : 'incomplete',
          },
        }
      }
      if (state.cardPin.confirmation !== state.cardPin.pin) {
        return { ...state, cardPin: { ...state.cardPin, error: 'mismatch' } }
      }

      return {
        ...state,
        cardPin: {
          status: 'saving',
          cardId: state.cardPin.cardId,
          pin: state.cardPin.pin,
        },
      }
    }
    case 'card-pin-saved': {
      if (state.cardPin.status !== 'saving') return state
      const cardId = state.cardPin.cardId
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === cardId
            ? { ...card, hasPin: true }
            : card,
        ),
        cardPin: { status: 'closed' },
      }
    }
    case 'card-pin-update-confirmed':
      if (state.cardPin.status !== 'saving') return state
      return { ...state, cardPin: { status: 'closed' } }
    case 'card-pin-save-failed':
      if (state.cardPin.status !== 'saving') return state
      return {
        ...state,
        cardPin: {
          status: 'confirming',
          cardId: state.cardPin.cardId,
          pin: state.cardPin.pin,
          confirmation: state.cardPin.pin,
          error: { type: 'request', message: event.message },
        },
      }
  }
}

function normalizePin(value: string) {
  return value.replace(/\D/g, '').slice(0, 4)
}

function validatePin(pin: string): PinValidationError {
  if (pin.length === 0) return 'required'
  if (!/^\d{4}$/.test(pin)) return 'incomplete'

  // Keep rules and their precedence aligned with backend cards/validators.py.
  if (/^(\d)\1{3}$/.test(pin)) return 'repeated'
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'sequence'
  if (/(\d)\1{2}/.test(pin)) return 'consecutive'
  if ([
    '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
    '1212', '1122', '1313', '2000', '2001', '2002', '2580', '1234', '4321', '1004',
    '6969', '1357', '2468', '9753', '8642',
  ].includes(pin)) return 'weak'
  if (pin[0] === pin[2] && pin[1] === pin[3]) return 'alternating'
  return null
}

function normalizeCardExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

export function isCardExpiryValid(value: string) {
  return /^(0[1-9]|1[0-2])\/\d{2}$/.test(value)
}

export function isCardActivationValid(lastFour: string, expiry: string): boolean {
  return lastFour.length === 4 && isCardExpiryValid(expiry)
}
