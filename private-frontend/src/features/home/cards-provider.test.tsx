import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

import type { CardsGateway } from './api/cards-gateway'
import { CardsProvider, useCards } from './cards-provider'

type CardsValue = ReturnType<typeof useCards>

let cardsValue: CardsValue | null = null
let root: Root | null = null
let queryClient: QueryClient | null = null

const loadedCard = {
  id: '17',
  backendId: '2a79418b-c5f3-4f9f-8ad8-202236b8c43e',
  name: 'Virtual card',
  kind: 'Virtual' as const,
  lastFour: '7391',
  status: 'Active' as const,
  hasPin: false,
  details: null,
  expiration: '08/29',
}

function createGateway(overrides: Partial<CardsGateway> = {}): CardsGateway {
  return {
    activatePhysical: () => Promise.resolve({ ok: false, code: 'unused', message: 'unused' }),
    list: () => Promise.resolve({ ok: true, data: [loadedCard] }),
    issueVirtual: () =>
      Promise.resolve({
        ok: true,
        data: { cardId: '70e9b690-b750-47d3-8504-5f488f64dfe2' },
      }),
    rename: (_cardId, name) => Promise.resolve({ ok: true, data: { name } }),
    setFrozen: () => Promise.resolve({ ok: true }),
    changePin: () => Promise.resolve({ ok: true }),
    getDetails: () =>
      Promise.resolve({
        ok: true,
        data: {
          number: '4917 0032 7714 7391',
          expires: '08/29',
          securityCode: '318',
        },
      }),
    ...overrides,
  }
}

function Probe() {
  const value = useCards()
  useEffect(() => {
    cardsValue = value
  }, [value])
  return null
}

function getCards(): CardsValue {
  if (cardsValue === null) throw new Error('Cards value was not captured')
  return cardsValue
}

function createEmptyReactContainer(): Element {
  const ownerDocument = {
    nodeType: 9,
    documentElement: { namespaceURI: 'http://www.w3.org/1999/xhtml' },
    addEventListener() {},
    removeEventListener() {},
  }
  return {
    nodeType: 1,
    nodeName: 'DIV',
    tagName: 'DIV',
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    ownerDocument,
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Element
}

function mount(
  gateway: CardsGateway,
  enabled: boolean,
  sessionIdentity: string | null = null,
) {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as unknown as { window?: unknown }).window = {
    HTMLIFrameElement: class {},
  }
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  root = createRoot(createEmptyReactContainer())

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider
          gateway={gateway}
          enabled={enabled}
          sessionIdentity={sessionIdentity}
        >
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })
}

async function waitForStatus(status: CardsValue['status']) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getCards().status === status) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
  }
  throw new Error(`Cards did not reach ${status}`)
}

async function waitForCard(predicate: (card: CardsValue['cards'][number]) => boolean) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const card = getCards().cards[0]
    if (card !== undefined && predicate(card)) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
  }
  throw new Error('Card did not reach the expected state')
}

afterEach(() => {
  if (root !== null) act(() => root?.unmount())
  queryClient?.clear()
  cardsValue = null
  root = null
  queryClient = null
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT
  delete (globalThis as unknown as { window?: unknown }).window
})

test('does not reconcile a pending issuance across authenticated users', async () => {
  const userBCard = {
    ...loadedCard,
    id: '28',
    backendId: 'ba53c3f8-f0cd-457d-8974-d0b407548d95',
    name: 'User B card',
    lastFour: '2828',
  }
  const list = vi
    .fn()
    .mockResolvedValueOnce({ ok: true as const, data: [loadedCard] })
    .mockResolvedValueOnce({
      ok: false as const,
      code: 'cards-failed',
      message: 'Unable to load cards. Try again.',
    })
    .mockResolvedValueOnce({ ok: true as const, data: [userBCard] })
  const issueVirtual = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true as const,
      data: { cardId: '70e9b690-b750-47d3-8504-5f488f64dfe2' },
    })
    .mockResolvedValueOnce({
      ok: true as const,
      data: { cardId: userBCard.backendId },
    })
  const gateway = createGateway({ list, issueVirtual })
  mount(gateway, true, 'user-a')
  await waitForStatus('ready')

  await act(async () => {
    await getCards().issueVirtual('User A card')
  })
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled sessionIdentity="user-b">
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })
  await act(async () => {
    await getCards().issueVirtual('User B card')
  })

  expect(issueVirtual).toHaveBeenCalledTimes(2)
  expect(getCards().selectedCard).toMatchObject({ id: '28', name: 'User B card' })
})

test('ignores a late issuance response from the previous authenticated user', async () => {
  const userBCard = {
    ...loadedCard,
    id: '28',
    backendId: 'ba53c3f8-f0cd-457d-8974-d0b407548d95',
    name: 'User B card',
    lastFour: '2828',
  }
  let resolveUserAIssue!: (result: {
    ok: true
    data: { cardId: string }
  }) => void
  const issueVirtual = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<{ ok: true; data: { cardId: string } }>((resolve) => {
          resolveUserAIssue = resolve
        }),
    )
    .mockResolvedValueOnce({
      ok: true as const,
      data: { cardId: userBCard.backendId },
    })
  const list = vi
    .fn()
    .mockResolvedValueOnce({ ok: true as const, data: [loadedCard] })
    .mockResolvedValueOnce({ ok: true as const, data: [userBCard] })
  const gateway = createGateway({ list, issueVirtual })
  mount(gateway, true, 'user-a')
  await waitForStatus('ready')

  let userARequest!: ReturnType<CardsValue['issueVirtual']>
  act(() => {
    userARequest = getCards().issueVirtual('User A card')
  })
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled sessionIdentity="user-b">
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })
  let userAResult: Awaited<ReturnType<CardsValue['issueVirtual']>> | undefined
  await act(async () => {
    resolveUserAIssue({
      ok: true,
      data: { cardId: '70e9b690-b750-47d3-8504-5f488f64dfe2' },
    })
    userAResult = await userARequest
  })
  await act(async () => {
    await getCards().issueVirtual('User B card')
  })

  expect(userAResult).toMatchObject({ ok: false, code: 'card-issue-canceled' })
  expect(issueVirtual).toHaveBeenCalledTimes(2)
  expect(list).toHaveBeenCalledTimes(2)
  expect(getCards().selectedCard).toMatchObject({ id: '28', name: 'User B card' })
})

test('starts loading immediately when the home gate enables cards', async () => {
  const list = vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      data: [
        {
          id: '17',
          backendId: '2a79418b-c5f3-4f9f-8ad8-202236b8c43e',
          name: 'Virtual card',
          kind: 'Virtual' as const,
          lastFour: '7391',
          status: 'Active' as const,
          hasPin: true,
          details: null,
        },
      ],
    }),
  )

  const gateway = createGateway({ list })
  mount(gateway, true)

  expect(list).toHaveBeenCalledTimes(1)
  await waitForStatus('ready')
  expect(getCards().cards).toMatchObject([{ id: '17', lastFour: '7391' }])

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled={false}>
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled>
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })
  await act(async () => Promise.resolve())

  expect(list).toHaveBeenCalledTimes(1)
})

test('keeps loaded cards available while the route gate disables requests', async () => {
  const list = vi.fn(() => Promise.resolve({ ok: true as const, data: [loadedCard] }))
  const gateway = createGateway({ list })
  mount(gateway, true)
  await waitForStatus('ready')

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled={false}>
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })

  expect(getCards()).toMatchObject({
    status: 'ready',
    cards: [{ id: '17' }],
    selectedCardId: '17',
  })
  expect(list).toHaveBeenCalledTimes(1)
})

test('does not load outside home and retries a safe failure on demand', async () => {
  let attempt = 0
  const list = vi.fn(() => {
    attempt += 1
    return Promise.resolve(
      attempt === 1
        ? {
            ok: false as const,
            code: 'cards-failed',
            message: 'Unable to load cards. Try again.',
          }
        : { ok: true as const, data: attempt === 2 ? [] : [loadedCard] },
    )
  })

  const gateway = createGateway({ list })
  mount(gateway, false)
  expect(list).not.toHaveBeenCalled()

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled>
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })
  await waitForStatus('error')
  expect(getCards().error).toBe('Unable to load cards. Try again.')

  act(() => {
    getCards().retry()
    getCards().retry()
  })
  await waitForStatus('ready')
  expect(list).toHaveBeenCalledTimes(3)
})

test('updates a card status only after the backend confirms the operation', async () => {
  let resolveStatus!: (result: { ok: true }) => void
  const setFrozen = vi.fn(
    () => new Promise<{ ok: true }>((resolve) => { resolveStatus = resolve }),
  )
  mount(createGateway({ setFrozen }), true)
  await waitForStatus('ready')

  let request!: ReturnType<CardsValue['setFrozen']>
  act(() => {
    request = getCards().setFrozen(loadedCard.backendId, true)
  })
  expect(getCards().cards[0]?.status).toBe('Active')

  await act(async () => {
    resolveStatus({ ok: true })
    await request
  })
  await waitForCard((card) => card.status === 'Frozen')

  expect(setFrozen).toHaveBeenCalledWith(loadedCard.backendId, true, undefined)
  expect(getCards().cards[0]?.status).toBe('Frozen')
})

test('renames a card only after the backend confirms the operation', async () => {
  let resolveRename!: (result: { ok: true; data: { name: string } }) => void
  const rename = vi.fn(
    () =>
      new Promise<{ ok: true; data: { name: string } }>((resolve) => {
        resolveRename = resolve
      }),
  )
  mount(createGateway({ rename }), true)
  await waitForStatus('ready')

  let request!: ReturnType<CardsValue['rename']>
  act(() => {
    request = getCards().rename(loadedCard.backendId, 'Daily spending')
  })
  expect(getCards().cards[0]?.name).toBe('Virtual card')

  await act(async () => {
    resolveRename({ ok: true, data: { name: 'Daily spending' } })
    await request
  })
  await waitForCard((card) => card.name === 'Daily spending')

  expect(rename).toHaveBeenCalledWith(
    loadedCard.backendId,
    'Daily spending',
    undefined,
  )
  expect(getCards().cards[0]?.name).toBe('Daily spending')
})

test('refreshes, locally names and selects a newly issued virtual card', async () => {
  const issuedCard = {
    ...loadedCard,
    id: '18',
    backendId: '70e9b690-b750-47d3-8504-5f488f64dfe2',
    name: 'Travel',
    lastFour: '4242',
  }
  const list = vi
    .fn()
    .mockResolvedValueOnce({ ok: true as const, data: [loadedCard] })
    .mockResolvedValueOnce({ ok: true as const, data: [loadedCard, issuedCard] })
  const issueVirtual = vi.fn().mockResolvedValue({
    ok: true as const,
    data: { cardId: issuedCard.backendId },
  })
  const rename = vi.fn((_cardId, name: string) =>
    Promise.resolve({ ok: true as const, data: { name } }),
  )
  mount(createGateway({ list, issueVirtual, rename }), true)
  await waitForStatus('ready')

  await act(async () => {
    await getCards().issueVirtual('Travel')
  })

  expect(getCards().cards).toMatchObject([
    { id: '17', name: 'Virtual card' },
    { id: '18', name: 'Travel' },
  ])
  expect(getCards().selectedCardId).toBe('18')
  expect(getCards().status).toBe('ready')
  expect(issueVirtual).toHaveBeenCalledWith('Travel', undefined)
  expect(rename).not.toHaveBeenCalled()
})

test.each([
  [
    'the refresh fails',
    {
      ok: false as const,
      code: 'cards-failed',
      message: 'Unable to load cards. Try again.',
    },
  ],
  ['the issued card is not in the refreshed list', { ok: true as const, data: [loadedCard] }],
])('retries only card reconciliation after issuance when %s', async (_case, firstRefresh) => {
  const issuedCard = {
    ...loadedCard,
    id: '18',
    backendId: '70e9b690-b750-47d3-8504-5f488f64dfe2',
    name: 'Travel',
    lastFour: '4242',
  }
  const list = vi
    .fn()
    .mockResolvedValueOnce({ ok: true as const, data: [loadedCard] })
    .mockResolvedValueOnce(firstRefresh)
    .mockResolvedValueOnce({ ok: true as const, data: [loadedCard, issuedCard] })
  const issueVirtual = vi.fn().mockResolvedValue({
    ok: true as const,
    data: { cardId: issuedCard.backendId },
  })
  mount(createGateway({ list, issueVirtual }), true)
  await waitForStatus('ready')

  let firstResult: Awaited<ReturnType<CardsValue['issueVirtual']>> | undefined
  let retryResult: Awaited<ReturnType<CardsValue['issueVirtual']>> | undefined
  await act(async () => {
    firstResult = await getCards().issueVirtual('Travel')
    retryResult = await getCards().issueVirtual('Changed name')
  })

  expect(firstResult).toEqual({
    ok: false,
    code: 'card-issue-refresh-failed',
    message: 'Card issued, but the card list could not be refreshed. Try again.',
  })
  expect(retryResult).toEqual({ ok: true })
  expect(issueVirtual).toHaveBeenCalledTimes(1)
  expect(issueVirtual).toHaveBeenCalledWith('Travel', undefined)
  expect(list).toHaveBeenCalledTimes(3)
  expect(getCards().selectedCard).toMatchObject({ id: '18', name: 'Travel' })
})

test('keeps cached card state unchanged when a mutation fails', async () => {
  const failure = {
    ok: false as const,
    code: 'card-status-failed',
    message: 'Unable to update card status. Try again.',
  }
  mount(
    createGateway({
      setFrozen: () => Promise.resolve(failure),
      changePin: () => Promise.resolve({
        ok: false,
        code: 'card-pin-failed',
        message: 'Unable to update PIN. Try again.',
      }),
    }),
    true,
  )
  await waitForStatus('ready')

  await act(async () => {
    await getCards().setFrozen(loadedCard.backendId, true)
    await getCards().changePin(loadedCard.backendId, '4826')
  })

  expect(getCards().cards[0]).toMatchObject({ status: 'Active', hasPin: false })
})

test('updates the PIN flag and returns sensitive details through the provider boundary', async () => {
  const changePin = vi.fn(() => Promise.resolve({ ok: true as const }))
  const getDetails = vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      data: {
        number: '4917 0032 7714 7391',
        expires: '08/29',
        securityCode: '318',
      },
    }),
  )
  mount(createGateway({ changePin, getDetails }), true)
  await waitForStatus('ready')

  await act(async () => {
    await getCards().changePin(loadedCard.backendId, '4826')
  })
  await waitForCard((card) => card.hasPin)
  const details = await getCards().getDetails(loadedCard.backendId, '08/29')

  expect(getCards().cards[0]?.hasPin).toBe(true)
  expect(changePin).toHaveBeenCalledWith(loadedCard.backendId, '4826', undefined)
  expect(getDetails).toHaveBeenCalledWith(loadedCard.backendId, '08/29', undefined)
  expect(details).toMatchObject({ ok: true, data: { securityCode: '318' } })
})

test('keeps the selected card in provider memory across route-style rerenders', async () => {
  const secondCard = {
    ...loadedCard,
    id: '18',
    backendId: '6e5a7416-40e5-4f53-978d-3327bc59261f',
    lastFour: '4242',
    name: 'Physical card',
    kind: 'Physical' as const,
  }
  const gateway = createGateway({
    list: () => Promise.resolve({ ok: true, data: [loadedCard, secondCard] }),
  })
  mount(gateway, true)
  await waitForStatus('ready')

  expect(getCards().selectedCardId).toBe('17')
  expect(getCards().selectedCard?.id).toBe('17')

  act(() => getCards().selectCard('18'))
  expect(getCards().selectedCardId).toBe('18')
  expect(getCards().selectedCard?.lastFour).toBe('4242')

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled>
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })
  expect(getCards().selectedCardId).toBe('18')

  act(() => {
    getCards().resetSession()
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled={false}>
          <Probe />
        </CardsProvider>
      </QueryClientProvider>,
    )
  })
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
  expect(getCards().selectedCardId).toBeNull()
})

test('refreshes and selects an issued physical card without issuing a virtual card', async () => {
  const physical = { ...loadedCard, id: '77', backendId: 'physical-rain-id', kind: 'Physical' as const }
  const gateway = createGateway({ list: vi.fn().mockResolvedValueOnce({ ok: true, data: [loadedCard] }).mockResolvedValue({ ok: true, data: [loadedCard, physical] }) })
  mount(gateway, true)
  await waitForStatus('ready')
  await act(async () => { await getCards().refreshPhysical(77, 'Travel', new AbortController().signal) })
  expect(getCards().selectedCardId).toBe('77')
  expect(getCards().selectedCard?.name).toBe('Travel')
})

test.each(['list', 'rename'])('physical refresh preserves a concurrent freeze while %s is pending', async (stage) => {
  const physical = { ...loadedCard, id: '77', backendId: 'physical-rain-id', kind: 'Physical' as const }
  let finishList!: (result: { ok: true; data: (typeof loadedCard | typeof physical)[] }) => void
  let finishRename!: (result: { ok: true; data: { name: string } }) => void
  const list = vi.fn().mockResolvedValueOnce({ ok: true, data: [loadedCard] }).mockImplementationOnce(() => new Promise((resolve) => { finishList = resolve }))
  const rename = vi.fn(() => new Promise<{ ok: true; data: { name: string } }>((resolve) => { finishRename = resolve }))
  mount(createGateway({ list, rename }), true)
  await waitForStatus('ready')
  let refresh!: Promise<boolean>
  act(() => { refresh = getCards().refreshPhysical(77, 'Travel', new AbortController().signal) })
  if (stage === 'rename') await act(async () => { finishList({ ok: true, data: [loadedCard, physical] }) })
  await act(async () => { await getCards().setFrozen(loadedCard.backendId, true) })
  await waitForCard((card) => card.status === 'Frozen')
  if (stage === 'list') await act(async () => { finishList({ ok: true, data: [loadedCard, physical] }) })
  await act(async () => { finishRename({ ok: true, data: { name: 'Travel' } }); await refresh })
  await act(async () => new Promise((resolve) => setTimeout(resolve, 30)))
  expect(getCards().cards.find((card) => card.id === loadedCard.id)?.status).toBe('Frozen')
  expect(getCards().selectedCard?.name).toBe('Travel')
})

test('publishes activation immediately, preserves nickname and saves the PIN through the gateway', async () => {
  const physical = { ...loadedCard, kind: 'Physical' as const, status: 'In transit' as const, physicalOrderId: 42 }
  const activatePhysical = vi.fn().mockResolvedValue({ ok: true, data: { ...physical, status: 'Active', name: 'Old name' } })
  const changePin = vi.fn().mockResolvedValue({ ok: true })
  mount(createGateway({ list: async () => ({ ok: true, data: [physical] }), activatePhysical, changePin }), true)
  await waitForStatus('ready')
  await act(async () => { await getCards().activatePhysical(physical, '7391', '08/29') })
  await waitForCard((card) => card.status === 'Active')
  expect(getCards().selectedCard).toMatchObject({ status: 'Active', hasPin: false, name: physical.name })
  await act(async () => { await getCards().changePin(physical.backendId, '4826') })
  await waitForCard((card) => card.hasPin)
  expect(changePin).toHaveBeenCalledWith(physical.backendId, '4826', undefined)
  expect(getCards().selectedCard).toMatchObject({ status: 'Active', hasPin: true })
})

test.each(['activation', 'pin'] as const)('ignores a late %s response after switching users', async (operation) => {
  const physical = { ...loadedCard, kind: 'Physical' as const, physicalOrderId: 42 }
  let complete!: () => void
  const pending = new Promise<void>((resolve) => { complete = resolve })
  const gateway = createGateway({
    list: async () => ({ ok: true, data: [physical] }),
    activatePhysical: async () => { await pending; return { ok: true, data: { ...physical, lastFour: '9999' } } },
    changePin: async () => { await pending; return { ok: true } },
  })
  mount(gateway, true, 'user-a')
  await waitForStatus('ready')
  const request = operation === 'activation'
    ? getCards().activatePhysical(physical, '7391', '08/29')
    : getCards().changePin(physical.backendId, '4826')
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <CardsProvider gateway={gateway} enabled sessionIdentity="user-b"><Probe /></CardsProvider>
      </QueryClientProvider>,
    )
  })
  await act(async () => { complete(); expect(await request).toMatchObject({ ok: false }) })
  expect(getCards().cards[0]).toMatchObject({ lastFour: '7391', hasPin: false })
})
