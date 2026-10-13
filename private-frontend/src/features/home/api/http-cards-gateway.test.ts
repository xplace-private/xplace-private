import { describe, expect, test, vi } from 'vitest'

import { ApiRequestError } from '../../../shared/api/api-client'
import { createHttpCardsGateway } from './http-cards-gateway'

const activeVirtualCard = {
  id: 17,
  rain_id: '2a79418b-c5f3-4f9f-8ad8-202236b8c43e',
  company_id: 'company-1',
  rain_user_id: 'rain-user-2',
  card_type: 'virtual',
  name: 'Travel',
  status: 'active',
  last4: '7391',
  expiration_month: '08',
  expiration_year: '2029',
  tier: 'gold',
  limit_amount: null,
  limit_frequency: null,
  created_at: '2026-08-20T08:00:00Z',
  updated_at: '2026-08-20T08:00:00Z',
  is_set_pin: true,
  is_smart_spend_available: false,
  is_smart_spend_active: false,
  delivery_status: null,
  delivery_expected_at: null,
  received: false,
  received_at: null,
  can_mark_received: false,
  can_activate: false,
  physical_card_order_id: null,
}

describe('createHttpCardsGateway', () => {
  test('issues a Silver virtual card without retrying the POST request', async () => {
    const request = vi.fn().mockResolvedValue({
      status: 'success',
      message: 'Card created successfully',
      card_id: '70e9b690-b750-47d3-8504-5f488f64dfe2',
    })
    const gateway = createHttpCardsGateway({ request }) as ReturnType<
      typeof createHttpCardsGateway
    > & {
      issueVirtual(): Promise<unknown>
    }

    await expect(gateway.issueVirtual('Travel')).resolves.toEqual({
      ok: true,
      data: { cardId: '70e9b690-b750-47d3-8504-5f488f64dfe2' },
    })
    expect(request).toHaveBeenCalledWith('cards/issue/', {
      authenticated: true,
      method: 'POST',
      json: { tier: 2, name: 'Travel' },
      retry: false,
    })
  })

  test('omits the optional card name during automatic issuance', async () => {
    const request = vi.fn().mockResolvedValue({
      status: 'success',
      message: 'Card created successfully',
      card_id: '70e9b690-b750-47d3-8504-5f488f64dfe2',
    })

    await createHttpCardsGateway({ request }).issueVirtual()

    expect(request).toHaveBeenCalledWith('cards/issue/', {
      authenticated: true,
      method: 'POST',
      json: { tier: 2 },
      retry: false,
    })
  })

  test('loads authenticated cards, maps their visible fields and hides canceled cards', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      cards: [
        activeVirtualCard,
        {
          ...activeVirtualCard,
          id: 18,
          rain_id: '6e5a7416-40e5-4f53-978d-3327bc59261f',
          card_type: 'physical',
          name: null,
          status: 'notActivated',
          last4: null,
          is_set_pin: false,
          delivery_status: 'in_transit',
          can_activate: true,
          physical_card_order_id: 44,
        },
        {
          ...activeVirtualCard,
          id: 19,
          rain_id: 'd6f95ee7-940e-44ce-8b95-83f38bb60949',
          status: 'canceled',
          last4: '0001',
        },
      ],
      count: 3,
    })

    const result = await createHttpCardsGateway({ request }).list()

    expect(request).toHaveBeenCalledWith('cards/', {
      authenticated: true,
      signal: undefined,
    })
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: '17',
          backendId: '2a79418b-c5f3-4f9f-8ad8-202236b8c43e',
          name: 'Travel',
          kind: 'Virtual',
          lastFour: '7391',
          status: 'Active',
          hasPin: true,
          details: null,
          expiration: '08/29',
          createdAt: new Date('2026-08-20T08:00:00Z'),
          physicalOrderId: null,
        },
        {
          id: '18',
          backendId: '6e5a7416-40e5-4f53-978d-3327bc59261f',
          name: 'Physical Card',
          kind: 'Physical',
          lastFour: null,
          status: 'In transit',
          hasPin: false,
          details: null,
          expiration: '08/29',
          createdAt: new Date('2026-08-20T08:00:00Z'),
          physicalOrderId: 44,
        },
      ],
    })
  })

  test('uses the card type when the backend card name is empty', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      cards: [
        { ...activeVirtualCard, name: null },
        {
          ...activeVirtualCard,
          id: 18,
          rain_id: '6e5a7416-40e5-4f53-978d-3327bc59261f',
          card_type: 'physical',
          name: '',
        },
      ],
      count: 2,
    })

    await expect(createHttpCardsGateway({ request }).list()).resolves.toMatchObject({
      ok: true,
      data: [{ name: 'Virtual Card' }, { name: 'Physical Card' }],
    })
  })

  test('renames a private card through its authenticated endpoint', async () => {
    const signal = new AbortController().signal
    const request = vi.fn().mockResolvedValue({
      success: true,
      card: { ...activeVirtualCard, name: 'Daily spending' },
    })
    const gateway = createHttpCardsGateway({ request })

    await expect(
      gateway.rename(activeVirtualCard.rain_id, 'Daily spending', signal),
    ).resolves.toEqual({ ok: true, data: { name: 'Daily spending' } })
    expect(request).toHaveBeenCalledWith(
      `cards/${activeVirtualCard.rain_id}/name/`,
      {
        authenticated: true,
        method: 'PATCH',
        json: { name: 'Daily spending' },
        retry: false,
        signal,
      },
    )
  })

  test('preserves a non-delivery not-activated status', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      cards: [
        {
          ...activeVirtualCard,
          status: 'notActivated',
          last4: null,
        },
      ],
      count: 1,
    })

    const result = await createHttpCardsGateway({ request }).list()

    expect(result).toMatchObject({
      ok: true,
      data: [{ status: 'Not activated', lastFour: null }],
    })
  })

  test('normalizes backend-supported unpadded expiration fields', async () => {
    const gateway = createHttpCardsGateway({
      request: vi.fn().mockResolvedValue({
        success: true,
        cards: [{ ...activeVirtualCard, expiration_month: '8', expiration_year: '29' }],
        count: 1,
      }),
    })

    await expect(gateway.list()).resolves.toMatchObject({
      ok: true,
      data: [{ expiration: '08/29' }],
    })
  })

  test.each([
    { success: true, cards: [], count: 1 },
    { success: true, cards: [{ ...activeVirtualCard, last4: '391' }], count: 1 },
    { success: true, cards: [{ ...activeVirtualCard, status: 'unknown' }], count: 1 },
  ])('rejects malformed card responses without exposing raw data', async (response) => {
    const gateway = createHttpCardsGateway({
      request: vi.fn().mockResolvedValue(response),
    })

    await expect(gateway.list()).resolves.toEqual({
      ok: false,
      code: 'cards-failed',
      message: 'Unable to load cards. Try again.',
    })
  })

  test('freezes and unfreezes a card through the authenticated status endpoint', async () => {
    const signal = new AbortController().signal
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'success',
        message: 'Card frozen successfully',
        card_id: activeVirtualCard.rain_id,
        new_status: 'locked',
      })
      .mockResolvedValueOnce({
        status: 'success',
        message: 'Card unfrozen successfully',
        card_id: activeVirtualCard.rain_id,
        new_status: 'active',
      })
    const gateway = createHttpCardsGateway({ request })

    await expect(gateway.setFrozen(activeVirtualCard.rain_id, true, signal)).resolves.toEqual({
      ok: true,
    })
    await expect(gateway.setFrozen(activeVirtualCard.rain_id, false)).resolves.toEqual({
      ok: true,
    })
    expect(request).toHaveBeenNthCalledWith(1, `cards/${activeVirtualCard.rain_id}/status/`, {
      authenticated: true,
      method: 'PATCH',
      json: { action: 'freeze' },
      retry: false,
      signal,
    })
    expect(request).toHaveBeenNthCalledWith(2, `cards/${activeVirtualCard.rain_id}/status/`, {
      authenticated: true,
      method: 'PATCH',
      json: { action: 'unfreeze' },
      retry: false,
    })
  })

  test('changes a card PIN through the authenticated cards endpoint', async () => {
    const signal = new AbortController().signal
    const request = vi.fn().mockResolvedValue({
      success: true,
      message: 'Card PIN updated successfully',
    })
    const gateway = createHttpCardsGateway({ request })

    await expect(gateway.changePin(activeVirtualCard.rain_id, '4826', signal)).resolves.toEqual({
      ok: true,
    })
    expect(request).toHaveBeenCalledWith('cards/', {
      authenticated: true,
      method: 'PATCH',
      json: { card_id: activeVirtualCard.rain_id, new_pin: '4826' },
      retry: false,
      signal,
    })
  })

  test('returns a clear PIN validation message from an HTTP error response', async () => {
    const request = vi.fn().mockRejectedValue(
      new ApiRequestError(
        'http',
        400,
        JSON.stringify({
          success: false,
          error: 'Invalid request',
          details: {
            new_pin: ['PIN cannot contain repeated numbers'],
          },
        }),
        'Request failed with status 400',
      ),
    )
    const gateway = createHttpCardsGateway({ request })

    await expect(gateway.changePin(activeVirtualCard.rain_id, '1111')).resolves.toEqual({
      ok: false,
      code: 'card-pin-failed',
      message: 'PIN cannot contain repeated numbers',
    })
  })

  test('uses the safe PIN fallback when an HTTP error has no PIN validation message', async () => {
    const request = vi.fn().mockRejectedValue(
      new ApiRequestError(
        'http',
        500,
        JSON.stringify({
          success: false,
          error: 'Internal server error',
          details: 'database connection failed',
        }),
        'Request failed with status 500',
      ),
    )
    const gateway = createHttpCardsGateway({ request })

    await expect(gateway.changePin(activeVirtualCard.rain_id, '4826')).resolves.toEqual({
      ok: false,
      code: 'card-pin-failed',
      message: 'Unable to update PIN. Try again.',
    })
  })

  test('loads, validates and formats sensitive card details on demand', async () => {
    const request = vi.fn().mockResolvedValue({
      pan: '4917003277147391',
      cvc: '318',
    })
    const gateway = createHttpCardsGateway({ request })

    await expect(
      gateway.getDetails(activeVirtualCard.rain_id, '08/29'),
    ).resolves.toEqual({
      ok: true,
      data: {
        number: '4917 0032 7714 7391',
        expires: '08/29',
        securityCode: '318',
      },
    })
    expect(request).toHaveBeenCalledWith(`cards/${activeVirtualCard.rain_id}/secrets/`, {
      authenticated: true,
    })
  })

  test.each([
    ['setFrozen', { status: 'success', card_id: activeVirtualCard.rain_id }],
    ['changePin', { success: false, message: 'raw backend error' }],
    ['getDetails', { pan: 'not-a-card-number', cvc: '318' }],
  ] as const)('rejects malformed %s responses with a safe feature error', async (operation, response) => {
    const gateway = createHttpCardsGateway({
      request: vi.fn().mockResolvedValue(response),
    })

    const result =
      operation === 'setFrozen'
        ? await gateway.setFrozen(activeVirtualCard.rain_id, true)
        : operation === 'changePin'
          ? await gateway.changePin(activeVirtualCard.rain_id, '4826')
          : await gateway.getDetails(activeVirtualCard.rain_id, '08/29')

    expect(result).toMatchObject({ ok: false })
    expect(result).not.toMatchObject({ message: 'raw backend error' })
  })
})

test.each([
  ['manufacturing', 'Manufacturing'],
  ['in_transit', 'In transit'],
  ['should_be_delivered', 'Should be delivered'],
  [null, 'Not activated'],
])('preserves physical delivery status %s', async (delivery_status, status) => {
  const request = vi.fn().mockResolvedValue({
    success: true,
    count: 1,
    cards: [{ ...activeVirtualCard, card_type: 'physical', status: 'notActivated', delivery_status }],
  })
  await expect(createHttpCardsGateway({ request }).list()).resolves.toMatchObject({
    ok: true,
    data: [{ status }],
  })
})

test.each([
  ['active', 'Active'],
  ['locked', 'Frozen'],
])('keeps %s above a physical delivery status', async (status, expected) => {
  const request = vi.fn().mockResolvedValue({
    success: true,
    count: 1,
    cards: [{ ...activeVirtualCard, card_type: 'physical', status, delivery_status: 'manufacturing' }],
  })
  await expect(createHttpCardsGateway({ request }).list()).resolves.toMatchObject({
    ok: true,
    data: [{ status: expected }],
  })
})

const physicalActivationCard = {
  id: '17', backendId: activeVirtualCard.rain_id, kind: 'Physical' as const,
  name: 'Travel', lastFour: '7391', status: 'In transit' as const, hasPin: false,
  details: null, physicalOrderId: 42,
}
const activatedResponse = { success: true, card: { ...activeVirtualCard, card_type: 'physical', is_set_pin: false, physical_card_order_id: 42 } }

test.each([['08/29', '8', '2029'], ['09/31', '9', '2031'], ['12/31', '12', '2031']])(
  'confirms receipt before activation and sends month without a leading zero: %s', async (expiry, month, year) => {
  const request = vi.fn()
    .mockResolvedValueOnce({ id: 42, card_id: 17, status: 'issued', received: true })
    .mockResolvedValueOnce(activatedResponse)
  const signal = new AbortController().signal
  const result = await createHttpCardsGateway({ request }).activatePhysical(physicalActivationCard, '7391', expiry, signal)
  expect(result).toMatchObject({ ok: true, data: { status: 'Active', hasPin: false, physicalOrderId: 42 } })
  expect(request.mock.calls).toEqual([
    ['cards/physical-orders/42/confirm-received/', { authenticated: true, method: 'POST', json: {}, retry: false, signal }],
    [`cards/${activeVirtualCard.rain_id}/activate-physical/`, {
      authenticated: true, method: 'POST', json: { last4: '7391', expiration_month: month, expiration_year: year }, retry: false, signal,
    }],
  ])
})

test('does not activate when receipt confirmation fails or refers to another card', async () => {
  for (const confirmation of [null, { id: 42, card_id: 99, status: 'issued', received: true }]) {
    const request = vi.fn().mockResolvedValue(confirmation)
    expect(await createHttpCardsGateway({ request }).activatePhysical(physicalActivationCard, '7391', '08/29')).toMatchObject({ ok: false })
    expect(request).toHaveBeenCalledTimes(1)
  }
})

test.each([
  [400, { detail: 'Card details do not match.' }, 'home.activation.errors.mismatch'],
  [429, { error: 'Too many incorrect attempts. Try again in 30 minutes.' }, 'home.activation.errors.locked'],
  [500, { error: 'internal raw error' }, 'home.activation.errors.request'],
])('handles activation failure %s safely', async (status, body, message) => {
  const request = vi.fn()
    .mockResolvedValueOnce({ id: 42, card_id: 17, status: 'issued', received: true })
    .mockRejectedValueOnce(new ApiRequestError('http', status, body, 'Request failed'))
  expect(await createHttpCardsGateway({ request }).activatePhysical(physicalActivationCard, '7391', '08/29'))
    .toMatchObject({ ok: false, message })
})

test('rejects mismatched or inactive activation responses', async () => {
  for (const card of [{ ...activatedResponse.card, id: 99 }, { ...activatedResponse.card, status: 'notActivated' }]) {
    const request = vi.fn()
      .mockResolvedValueOnce({ id: 42, card_id: 17, status: 'issued', received: true })
      .mockResolvedValueOnce({ success: true, card })
    expect(await createHttpCardsGateway({ request }).activatePhysical(physicalActivationCard, '7391', '08/29')).toMatchObject({ ok: false })
  }
})

test('recovers a lost activation response without repeating activation', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce({ id: 42, card_id: 17, status: 'issued', received: true })
    .mockRejectedValueOnce(new ApiRequestError('network', null, null, 'Connection lost'))
    .mockResolvedValueOnce({ success: true, count: 1, cards: [activatedResponse.card] })
  expect(await createHttpCardsGateway({ request }).activatePhysical(physicalActivationCard, '7391', '08/29'))
    .toMatchObject({ ok: true, data: { status: 'Active' } })
  expect(request.mock.calls.map(([path]) => path)).toEqual([
    'cards/physical-orders/42/confirm-received/', `cards/${activeVirtualCard.rain_id}/activate-physical/`, 'cards/',
  ])
})

test('does not activate after receipt if the request was canceled', async () => {
  const controller = new AbortController()
  const request = vi.fn().mockImplementation(() => {
    controller.abort()
    return Promise.resolve({ id: 42, card_id: 17, status: 'issued', received: true })
  })
  expect(await createHttpCardsGateway({ request }).activatePhysical(physicalActivationCard, '7391', '08/29', controller.signal)).toMatchObject({ ok: false })
  expect(request).toHaveBeenCalledTimes(1)
})
