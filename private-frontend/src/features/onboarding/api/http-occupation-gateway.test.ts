import { describe, expect, test, vi } from 'vitest'

import { createHttpOccupationGateway } from './http-occupation-gateway'

const failure = {
  ok: false,
  code: 'occupations-failed',
  message: 'Unable to load occupations. Try again.',
}

test('loads and flattens authenticated occupation categories', async () => {
  const request = vi.fn().mockResolvedValue({
    count: 3,
    next: null,
    previous: null,
    results: [
      {
        id: 1,
        name: 'Business',
        occupations: [
          { id: 11, name: 'Accountant' },
          { id: 12, name: 'Actuary' },
        ],
      },
      {
        id: 2,
        name: 'Engineering',
        occupations: [{ id: 21, name: 'Aerospace engineer' }],
      },
    ],
  })
  const gateway = createHttpOccupationGateway({ request })
  const signal = new AbortController().signal

  await expect(gateway.list('', signal)).resolves.toEqual({
    ok: true,
    data: [
      { id: 11, name: 'Accountant' },
      { id: 12, name: 'Actuary' },
      { id: 21, name: 'Aerospace engineer' },
    ],
  })
  expect(request).toHaveBeenCalledWith('cards/occupations/?limit=100', {
    authenticated: true,
    signal,
  })
})

test('normalizes and encodes the server search query', async () => {
  const request = vi.fn().mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  })
  const gateway = createHttpOccupationGateway({ request })

  await gateway.list('  software + data  ')

  expect(request).toHaveBeenCalledWith(
    'cards/occupations/?limit=100&search=software%20%2B%20data',
    { authenticated: true, signal: undefined },
  )
})

describe('createHttpOccupationGateway', () => {
  test.each([
    ['non-object response', []],
    ['missing results', { count: 0, next: null, previous: null }],
    [
      'invalid category',
      { results: [{ id: 1, name: 'Business', occupations: null }] },
    ],
    [
      'invalid occupation id',
      {
        results: [
          {
            id: 1,
            name: 'Business',
            occupations: [{ id: 1.5, name: 'Accountant' }],
          },
        ],
      },
    ],
    [
      'blank occupation name',
      {
        results: [
          {
            id: 1,
            name: 'Business',
            occupations: [{ id: 11, name: '  ' }],
          },
        ],
      },
    ],
  ])('returns a safe failure for a %s', async (_case, body) => {
    const gateway = createHttpOccupationGateway({
      request: () => Promise.resolve(body),
    })

    await expect(gateway.list('')).resolves.toEqual(failure)
  })

  test('returns a safe failure when the request rejects', async () => {
    const gateway = createHttpOccupationGateway({
      request: () => Promise.reject(new Error('backend detail')),
    })

    await expect(gateway.list('')).resolves.toEqual(failure)
  })
})
