import { describe, expect, test } from 'vitest'

import {
  cardCollectionReducer,
  createCardCollectionState,
  type HomeCard,
} from './card-collection'

const virtualCard: HomeCard = {
  id: 'virtual-4417',
  backendId: null,
  name: 'Virtual card',
  kind: 'Virtual',
  lastFour: '4417',
  status: 'Active',
  hasPin: false,
  details: {
    number: '4917 0032 7714 4417',
    expires: 'Emirates NBD',
    securityCode: '772',
  },
}

const travelCard: HomeCard = {
  id: 'travel-2217',
  backendId: null,
  name: 'Travel',
  kind: 'Virtual',
  lastFour: '2217',
  status: 'Active',
  hasPin: false,
  details: {
    number: '4917 0032 7714 2217',
    expires: 'Emirates NBD',
    securityCode: '318',
  },
}

const physicalCard: HomeCard = {
  ...travelCard,
  id: 'physical-2217',
  kind: 'Physical',
  status: 'In transit',
}

describe('cardCollectionReducer', () => {
  test('targets the displayed physical card after issuance while the previous selection remains', () => {
    const initial = createCardCollectionState([{ ...virtualCard, backendId: 'virtual' }])
    const cards = [
      { ...virtualCard, backendId: 'virtual' },
      { ...physicalCard, backendId: 'physical' },
    ]
    const refreshed = cardCollectionReducer(initial, { type: 'replace-cards', cards })
    expect(refreshed.selectedCardId).toBe(virtualCard.id)

    expect(cardCollectionReducer(refreshed, {
      type: 'open-card-activation', cardId: physicalCard.id,
    }).cardActivation).toMatchObject({ status: 'editing', cardId: physicalCard.id })
    expect(cardCollectionReducer(refreshed, {
      type: 'open-rename-card', cardId: physicalCard.id,
    }).renameCard).toMatchObject({ status: 'editing', cardId: physicalCard.id, name: physicalCard.name })

    const activated = cardCollectionReducer(refreshed, {
      type: 'replace-cards',
      cards: cards.map((card) => card.id === physicalCard.id ? { ...card, status: 'Active' } : card),
    })
    expect(cardCollectionReducer(activated, {
      type: 'open-card-pin', cardId: physicalCard.id,
    }).cardPin).toMatchObject({ status: 'entering', cardId: physicalCard.id })
  })

  test.each(['open-card-activation', 'open-rename-card', 'open-card-pin'] as const)(
    'ignores %s for a card that is no longer in the list',
    (type) => {
      const state = createCardCollectionState([virtualCard])
      expect(cardCollectionReducer(state, { type, cardId: 'removed-card' })).toBe(state)
    },
  )

  test.each(['Manufacturing', 'In transit', 'Should be delivered'] as const)(
    'preserves activation entry for a physical card with status %s',
    (status) => {
      const state = createCardCollectionState([{ ...physicalCard, status }])
      expect(cardCollectionReducer(state, { type: 'open-card-activation', cardId: physicalCard.id }).cardActivation)
        .toMatchObject({ status: 'editing', cardId: physicalCard.id })
    },
  )

  test('moves a new card from editing to issuing', () => {
    const opened = cardCollectionReducer(createCardCollectionState([virtualCard]), {
      type: 'open-new-card',
    })
    const issuing = cardCollectionReducer(opened, { type: 'submit-new-card' })

    expect(opened.newCard).toEqual({
      status: 'editing',
      name: 'Travel',
      cardType: 'Virtual',
      validationAttempted: false,
    })
    expect(issuing.newCard).toEqual({ status: 'issuing', name: 'Travel', cardType: 'Virtual' })
  })

  test('marks an empty new-card name as required until the user edits it', () => {
    const opened = cardCollectionReducer(createCardCollectionState([virtualCard]), {
      type: 'open-new-card',
    })
    const emptied = cardCollectionReducer(opened, { type: 'change-new-card-name', name: ' ' })
    const invalid = cardCollectionReducer(emptied, { type: 'submit-new-card' })

    expect(invalid.newCard).toMatchObject({ status: 'editing', validationAttempted: true })
    expect(
      cardCollectionReducer(invalid, { type: 'change-new-card-name', name: 'Travel' }).newCard,
    ).toMatchObject({ status: 'editing', validationAttempted: false })
  })

  test('ignores cancel while issuance is in progress', () => {
    const issuing = {
      ...createCardCollectionState([virtualCard]),
      newCard: { status: 'issuing' as const, name: 'Travel', cardType: 'Virtual' as const },
    }

    expect(cardCollectionReducer(issuing, { type: 'close-new-card' })).toBe(issuing)
  })

  test('returns a failed virtual issuance to editing without losing its values', () => {
    const issuing = {
      ...createCardCollectionState([virtualCard]),
      newCard: { status: 'issuing' as const, name: 'Travel', cardType: 'Virtual' as const },
    }

    const failed = cardCollectionReducer(
      issuing,
      { type: 'new-card-issue-failed' } as never,
    )

    expect(failed.newCard).toEqual({
      status: 'editing',
      name: 'Travel',
      cardType: 'Virtual',
      validationAttempted: false,
    })
  })

  test('closes a backend-confirmed virtual issuance without adding a mock card', () => {
    const issuing = {
      ...createCardCollectionState([virtualCard]),
      newCard: { status: 'issuing' as const, name: 'Travel', cardType: 'Virtual' as const },
    }

    const completed = cardCollectionReducer(
      issuing,
      { type: 'new-card-issue-succeeded' } as never,
    )

    expect(completed.cards).toEqual([virtualCard])
    expect(completed.newCard).toEqual({ status: 'closed' })
  })

  test('opens physical-card naming without issuing a local card', () => {
    const initial = createCardCollectionState([virtualCard])
    const opened = cardCollectionReducer(initial, { type: 'open-physical-card', name: 'Expenses' })
    expect(opened.newCard).toMatchObject({ status: 'editing', name: 'Expenses', cardType: 'Physical' })
    expect(opened.cards).toEqual(initial.cards)
  })

  test('switches the card shown on home', () => {
    const state = createCardCollectionState([virtualCard, travelCard])

    expect(
      cardCollectionReducer(state, { type: 'select-card', cardId: 'travel-2217' })
        .selectedCardId,
    ).toBe('travel-2217')
  })

  test('freezes only the requested card and can activate it again', () => {
    const initial = createCardCollectionState([virtualCard, travelCard])
    const frozen = cardCollectionReducer(initial, {
      type: 'set-card-frozen',
      cardId: 'virtual-4417',
      frozen: true,
    })

    expect(frozen.cards).toMatchObject([
      { id: 'virtual-4417', status: 'Frozen' },
      { id: 'travel-2217', status: 'Active' },
    ])

    const active = cardCollectionReducer(frozen, {
      type: 'set-card-frozen',
      cardId: 'virtual-4417',
      frozen: false,
    })

    expect(active.cards).toContainEqual(
      expect.objectContaining({ id: 'virtual-4417', status: 'Active' }),
    )
  })

  test('replaces cards with backend-confirmed state while preserving selection', () => {
    const backendVirtual = { ...virtualCard, backendId: 'backend-virtual' }
    const renamedBackendVirtual = { ...backendVirtual, name: 'Daily spending' }
    const localIssued: HomeCard = { ...virtualCard, id: 'local-expenses', backendId: null, name: 'Expenses' }
    const initial = createCardCollectionState([
      renamedBackendVirtual,
      { ...travelCard, backendId: 'backend-travel' },
      localIssued,
    ])
    const selected = cardCollectionReducer(initial, {
      type: 'select-card',
      cardId: travelCard.id,
    })

    const refreshed = cardCollectionReducer(selected, {
      type: 'replace-cards',
      cards: [backendVirtual, { ...travelCard, backendId: 'backend-travel', status: 'Frozen' }],
    })

    expect(refreshed.selectedCardId).toBe(travelCard.id)
    expect(refreshed.cards[1]?.status).toBe('Frozen')
    expect(refreshed.cards).toContainEqual(expect.objectContaining({ id: localIssued.id }))
    expect(refreshed.cards[0]?.name).toBe('Virtual card')
  })

  test('does not locally freeze a card that is not activated', () => {
    const card: HomeCard = { ...virtualCard, status: 'Not activated', details: null }
    const state = createCardCollectionState([card])

    expect(
      cardCollectionReducer(state, {
        type: 'set-card-frozen',
        cardId: card.id,
        frozen: true,
      }),
    ).toBe(state)
  })

  test('renames the selected card only after saving completes', () => {
    const initial = createCardCollectionState([virtualCard])
    const opened = cardCollectionReducer(initial, { type: 'open-rename-card', cardId: virtualCard.id })
    const changed = cardCollectionReducer(opened, {
      type: 'change-rename-card-name',
      name: 'Daily spending',
    })
    const saving = cardCollectionReducer(changed, { type: 'submit-rename-card' })

    expect(opened.renameCard).toEqual({
      status: 'editing',
      cardId: 'virtual-4417',
      name: 'Virtual card',
      error: null,
    })
    expect(saving.cards).toMatchObject([{ name: 'Virtual card' }])
    expect(saving.renameCard).toEqual({
      status: 'saving',
      cardId: 'virtual-4417',
      name: 'Daily spending',
    })

    const completed = cardCollectionReducer(saving, {
      type: 'rename-card-saved',
      name: 'Daily spending',
    })

    expect(completed.cards).toMatchObject([{ name: 'Daily spending' }])
    expect(completed.renameCard).toEqual({ status: 'closed' })
  })

  test('submits an empty rename so the backend can clear the name', () => {
    const opened = cardCollectionReducer(createCardCollectionState([virtualCard]), {
      type: 'open-rename-card', cardId: virtualCard.id,
    })
    const emptied = cardCollectionReducer(opened, {
      type: 'change-rename-card-name',
      name: '',
    })
    const saving = cardCollectionReducer(emptied, { type: 'submit-rename-card' })

    expect(saving.renameCard).toEqual({
      status: 'saving',
      cardId: 'virtual-4417',
      name: '',
    })
  })

  test('ignores cancel while a card rename is saving', () => {
    const saving = {
      ...createCardCollectionState([virtualCard]),
      renameCard: {
        status: 'saving' as const,
        cardId: 'virtual-4417',
        name: 'Daily spending',
      },
    }

    expect(cardCollectionReducer(saving, { type: 'close-rename-card' })).toBe(saving)
  })

  test('returns a failed rename to editing and clears the error on change', () => {
    const saving = {
      ...createCardCollectionState([virtualCard]),
      renameCard: {
        status: 'saving' as const,
        cardId: 'virtual-4417',
        name: 'Daily spending',
      },
    }
    const failed = cardCollectionReducer(saving, {
      type: 'rename-card-save-failed',
      message: 'Unable to rename card. Try again.',
    })

    expect(failed.renameCard).toEqual({
      status: 'editing',
      cardId: 'virtual-4417',
      name: 'Daily spending',
      error: 'Unable to rename card. Try again.',
    })
    expect(
      cardCollectionReducer(failed, {
        type: 'change-rename-card-name',
        name: 'Travel',
      }).renameCard,
    ).toMatchObject({ status: 'editing', error: null })
  })

  test('sets a PIN only after four matching digits are confirmed', () => {
    const initial = createCardCollectionState([virtualCard])
    const opened = cardCollectionReducer(initial, { type: 'open-card-pin', cardId: virtualCard.id })
    const entered = cardCollectionReducer(opened, {
      type: 'change-card-pin',
      pin: '48a265',
    })
    const confirming = cardCollectionReducer(entered, { type: 'advance-card-pin' })
    const mismatched = cardCollectionReducer(
      cardCollectionReducer(confirming, {
        type: 'change-card-pin-confirmation',
        pin: '5432',
      }),
      { type: 'save-card-pin' },
    )

    expect(opened.cardPin).toEqual({
      status: 'entering',
      cardId: 'virtual-4417',
      pin: '',
      error: null,
    })
    expect(entered.cardPin).toMatchObject({ pin: '4826' })
    expect(confirming.cardPin).toEqual({
      status: 'confirming',
      cardId: 'virtual-4417',
      pin: '4826',
      confirmation: '',
      error: null,
    })
    expect(mismatched.cardPin).toMatchObject({ status: 'confirming', error: 'mismatch' })
    expect(mismatched.cards[0]).toMatchObject({ hasPin: false })

    const saving = cardCollectionReducer(
      cardCollectionReducer(mismatched, {
        type: 'change-card-pin-confirmation',
        pin: '4826',
      }),
      { type: 'save-card-pin' },
    )

    expect(saving.cards[0]).toMatchObject({ id: 'virtual-4417', hasPin: false })
    expect(saving.cardPin).toEqual({
      status: 'saving',
      cardId: 'virtual-4417',
      pin: '4826',
    })

    const completed = cardCollectionReducer(saving, { type: 'card-pin-saved' })

    expect(completed.cards[0]).toMatchObject({ id: 'virtual-4417', hasPin: true })
    expect(completed.cardPin).toEqual({ status: 'closed' })
  })

  test('returns a failed PIN save to confirmation so it can be retried', () => {
    const saving = {
      ...createCardCollectionState([virtualCard]),
      cardPin: { status: 'saving' as const, cardId: virtualCard.id, pin: '1234' },
    }

    expect(
      cardCollectionReducer(saving, {
        type: 'card-pin-save-failed',
        message: 'PIN cannot contain repeated numbers',
      }).cardPin,
    ).toEqual({
      status: 'confirming',
      cardId: virtualCard.id,
      pin: '1234',
      confirmation: '1234',
      error: {
        type: 'request',
        message: 'PIN cannot contain repeated numbers',
      },
    })
  })

  test('closes a backend-confirmed PIN flow without duplicating the cache update', () => {
    const saving = {
      ...createCardCollectionState([{ ...virtualCard, backendId: 'backend-virtual' }]),
      cardPin: { status: 'saving' as const, cardId: virtualCard.id, pin: '1234' },
    }

    const completed = cardCollectionReducer(saving, { type: 'card-pin-update-confirmed' })

    expect(completed.cardPin).toEqual({ status: 'closed' })
    expect(completed.cards[0]?.hasPin).toBe(false)
  })

  test('blocks closing while a PIN is saving', () => {
    const saving = {
      ...createCardCollectionState([virtualCard]),
      cardPin: { status: 'saving' as const, cardId: 'virtual-4417', pin: '1234' },
    }

    expect(cardCollectionReducer(saving, { type: 'close-card-pin' })).toBe(saving)
  })

  test('returns from PIN confirmation with the original PIN ready to edit', () => {
    const confirming = {
      ...createCardCollectionState([virtualCard]),
      cardPin: {
        status: 'confirming' as const,
        cardId: 'virtual-4417',
        pin: '1234',
        confirmation: '4321',
        error: 'mismatch' as const,
      },
    }

    const returned = cardCollectionReducer(confirming, { type: 'return-card-pin' })

    expect(returned.cardPin).toEqual({
      status: 'entering',
      cardId: 'virtual-4417',
      pin: '1234',
      error: null,
    })
  })

  test('reports required and incomplete PIN values before confirmation', () => {
    const opened = cardCollectionReducer(createCardCollectionState([virtualCard]), {
      type: 'open-card-pin', cardId: virtualCard.id,
    })
    const empty = cardCollectionReducer(opened, { type: 'advance-card-pin' })
    const incomplete = cardCollectionReducer(opened, {
      type: 'change-card-pin',
      pin: '123',
    })
    const invalid = cardCollectionReducer(incomplete, { type: 'advance-card-pin' })

    expect(empty.cardPin).toMatchObject({ status: 'entering', error: 'required' })
    expect(invalid.cardPin).toMatchObject({ status: 'entering', error: 'incomplete' })
  })

  test.each([
    ['repeated', ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999']],
    ['sequence', ['0123', '1234', '2345', '3456', '4567', '5678', '6789', '3210', '4321', '5432', '6543', '7654', '8765', '9876']],
    ['consecutive', ['1112', '2111', '2000', '0002']],
    ['weak', ['1212', '1122', '1313', '2001', '2002', '2580', '1004', '6969', '1357', '2468', '9753', '8642']],
    ['alternating', ['3434', '9090', '0101']],
  ])('rejects %s PINs before confirmation with the same precedence as the backend', (error, pins) => {
    const opened = cardCollectionReducer(createCardCollectionState([virtualCard]), {
      type: 'open-card-pin', cardId: virtualCard.id,
    })
    for (const pin of pins) {
      const entered = cardCollectionReducer(opened, { type: 'change-card-pin', pin })
      const rejected = cardCollectionReducer(entered, { type: 'advance-card-pin' })

      expect(rejected.cardPin, pin).toMatchObject({ status: 'entering', pin, error })
      expect(cardCollectionReducer(rejected, { type: 'save-card-pin' })).toBe(rejected)
    }
  })

  test.each(['4826', '0482', '7890', '8901', '1098', '1123', '1221', '2003'])('allows valid PIN %s without adding restrictions absent on the backend', (pin) => {
    const opened = cardCollectionReducer(createCardCollectionState([virtualCard]), {
      type: 'open-card-pin', cardId: virtualCard.id,
    })
    const entered = cardCollectionReducer(opened, { type: 'change-card-pin', pin })

    expect(cardCollectionReducer(entered, { type: 'advance-card-pin' }).cardPin)
      .toMatchObject({ status: 'confirming', pin, error: null })
  })

  test('validates physical-card details before opening the activation PIN flow', () => {
    const opened = cardCollectionReducer(createCardCollectionState([physicalCard]), {
      type: 'open-card-activation', cardId: physicalCard.id,
    })
    const invalid = cardCollectionReducer(opened, { type: 'submit-card-activation' })

    expect(opened.cardActivation).toEqual({
      status: 'editing',
      cardId: 'physical-2217',
      lastFour: '',
      expiry: '',
      validationAttempted: false,
      error: null,
    })
    expect(invalid.cardActivation).toMatchObject({
      status: 'editing',
      validationAttempted: true,
    })
    expect(invalid.cardPin).toEqual({ status: 'closed' })

    const withDigits = cardCollectionReducer(invalid, {
      type: 'change-card-activation-last-four',
      value: '22a178',
    })
    const withInvalidExpiry = cardCollectionReducer(withDigits, {
      type: 'change-card-activation-expiry',
      value: '13/40',
    })

    expect(withDigits.cardActivation).toMatchObject({ lastFour: '2217' })
    expect(withInvalidExpiry.cardActivation).toMatchObject({ expiry: '13/40' })
    expect(
      cardCollectionReducer(withInvalidExpiry, { type: 'submit-card-activation' }).cardPin,
    ).toEqual({ status: 'closed' })

    const valid = cardCollectionReducer(withInvalidExpiry, {
      type: 'change-card-activation-expiry',
      value: '12/40',
    })
    const activating = cardCollectionReducer(valid, { type: 'submit-card-activation' })
    expect(activating.cardActivation).toMatchObject({ status: 'activating' })
    expect(activating.cardPin).toEqual({ status: 'closed' })
    const settingPin = cardCollectionReducer(activating, { type: 'card-activation-succeeded', card: { ...physicalCard, status: 'Active' } })

    expect(settingPin.cardActivation).toEqual({ status: 'closed' })
    expect(settingPin.cardPin).toEqual({
      status: 'entering',
      cardId: 'physical-2217',
      pin: '',
      error: null,
    })
  })

  test('keeps the card active before PIN and after closing PIN', () => {
    const editing = cardCollectionReducer(createCardCollectionState([physicalCard]), {
      type: 'open-card-activation', cardId: physicalCard.id,
    })
    const withLastFour = cardCollectionReducer(editing, {
      type: 'change-card-activation-last-four',
      value: '2217',
    })
    const withExpiry = cardCollectionReducer(withLastFour, {
      type: 'change-card-activation-expiry',
      value: '09/30',
    })
    const activating = cardCollectionReducer(withExpiry, { type: 'submit-card-activation' })
    const failed = cardCollectionReducer(activating, { type: 'card-activation-failed', message: 'home.activation.errors.mismatch' })
    expect(failed.cardActivation).toMatchObject({ status: 'editing', lastFour: '2217', expiry: '09/30', error: 'home.activation.errors.mismatch' })
    const settingPin = cardCollectionReducer(activating, { type: 'card-activation-succeeded', card: { ...physicalCard, status: 'Active' } })
    const closed = cardCollectionReducer(settingPin, { type: 'close-card-pin' })
    expect(closed.cards[0]).toMatchObject({ status: 'Active', hasPin: false })
    expect(cardCollectionReducer(closed, { type: 'open-card-pin', cardId: physicalCard.id }).cardPin.status).toBe('entering')
    const pinEntered = cardCollectionReducer(settingPin, {
      type: 'change-card-pin',
      pin: '4826',
    })
    const confirming = cardCollectionReducer(pinEntered, { type: 'advance-card-pin' })
    const confirmed = cardCollectionReducer(confirming, {
      type: 'change-card-pin-confirmation',
      pin: '4826',
    })
    const saving = cardCollectionReducer(confirmed, { type: 'save-card-pin' })

    expect(saving.cards[0]).toMatchObject({ status: 'Active', hasPin: false })

    const completed = cardCollectionReducer(saving, { type: 'card-pin-saved' })

    expect(completed.cards[0]).toMatchObject({ status: 'Active', hasPin: true })
    expect(completed.cardActivation).toEqual({ status: 'closed' })
    expect(completed.cardPin).toEqual({ status: 'closed' })
  })

  test('does not open activation for a virtual or already active card', () => {
    const state = createCardCollectionState([virtualCard])

    expect(cardCollectionReducer(state, { type: 'open-card-activation', cardId: virtualCard.id })).toBe(state)
  })
})
