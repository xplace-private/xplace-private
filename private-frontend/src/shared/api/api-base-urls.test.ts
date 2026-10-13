import { describe, expect, test } from 'vitest'

import { createApiBaseUrls } from './api-base-urls'

describe('createApiBaseUrls', () => {
  test('uses versioned API bases behind the local proxy', () => {
    expect(createApiBaseUrls('/api')).toEqual({
      v1: '/api',
      v2: '/api/v2',
    })
  })

  test('adds versioned API paths to an absolute origin', () => {
    expect(createApiBaseUrls('https://back-stage.x.place')).toEqual({
      v1: 'https://back-stage.x.place/api/v1',
      v2: 'https://back-stage.x.place/api/v2',
    })
  })
})
