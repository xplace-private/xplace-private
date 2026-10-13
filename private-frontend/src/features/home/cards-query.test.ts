import { expect, test, vi } from 'vitest'

import type { CardsGateway } from './api/cards-gateway'
import { CardsQueryError, cardsQueryOptions } from './cards-query'

const issuedCard = {
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

function createGateway(overrides: Partial<CardsGateway>): CardsGateway {
  return {
    activatePhysical: () => Promise.resolve({ ok: false, code: 'unused', message: 'unused' }),
    list: () => Promise.resolve({ ok: true, data: [issuedCard] }),
    issueVirtual: () =>
      Promise.resolve({ ok: true, data: { cardId: issuedCard.backendId } }),
    rename: (_cardId, name) => Promise.resolve({ ok: true, data: { name } }),
    setFrozen: () => Promise.resolve({ ok: true }),
    changePin: () => Promise.resolve({ ok: true }),
    getDetails: () =>
      Promise.resolve({
        ok: true,
        data: { number: '4917 0032 7714 7391', expires: '08/29', securityCode: '318' },
      }),
    ...overrides,
  }
}

test('issues and reloads a card before the home cards query becomes ready', async () => {
  const calls: string[] = []
  const list = vi
    .fn(() => {
      calls.push('list')
      return Promise.resolve({
        ok: true as const,
        data: calls.length === 1 ? [] : [issuedCard],
      })
    })
  const issueVirtual = vi.fn(() => {
    calls.push('issue')
    return Promise.resolve({
      ok: true as const,
      data: { cardId: issuedCard.backendId },
    })
  })
  const options = cardsQueryOptions(createGateway({
    list,
    issueVirtual,
  }))

  await expect(
    options.queryFn?.({ signal: new AbortController().signal } as never),
  ).resolves.toEqual([issuedCard])
  expect(calls).toEqual(['list', 'issue', 'list'])
  expect(list).toHaveBeenCalledTimes(2)
  expect(issueVirtual).toHaveBeenCalledTimes(1)
})

test('exposes a safe error when automatic card issuance fails', async () => {
  const options = cardsQueryOptions(createGateway({
    list: () => Promise.resolve({ ok: true, data: [] }),
    issueVirtual: () =>
      Promise.resolve({
        ok: false,
        code: 'card-issue-failed',
        message: 'Unable to issue card. Try again.',
      }),
  }))

  await expect(
    options.queryFn?.({ signal: new AbortController().signal } as never),
  ).rejects.toEqual(
    new CardsQueryError('card-issue-failed', 'Unable to issue card. Try again.'),
  )
})

test('does not finish loading without a card after issuance succeeds', async () => {
  const options = cardsQueryOptions(createGateway({
    list: vi
      .fn()
      .mockResolvedValueOnce({ ok: true as const, data: [] })
      .mockResolvedValueOnce({ ok: true as const, data: [] }),
  }))

  await expect(
    options.queryFn?.({ signal: new AbortController().signal } as never),
  ).rejects.toEqual(
    new CardsQueryError(
      'card-issue-refresh-failed',
      'Card issued, but the card list could not be refreshed. Try again.',
    ),
  )
})

test('uses the shared GET retry layer and exposes a safe typed load failure', async () => {
  const gateway = createGateway({
    list: () =>
      Promise.resolve({
        ok: false,
        code: 'cards-failed',
        message: 'Unable to load cards. Try again.',
      }),
  })
  const options = cardsQueryOptions(gateway)

  expect(options.retry).toBe(false)
  expect(options.refetchOnWindowFocus).toBe(false)
  await expect(options.queryFn?.({ signal: new AbortController().signal } as never)).rejects.toEqual(
    new CardsQueryError('cards-failed', 'Unable to load cards. Try again.'),
  )
})
