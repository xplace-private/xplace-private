import { describe, expect, test } from 'vitest'

import { createCrowdinOtaClient } from './crowdin-ota-client'

describe('createCrowdinOtaClient', () => {
  test('keeps Crowdin disabled when no distribution hash is configured', () => {
    expect(createCrowdinOtaClient(null)).toBeNull()
  })

  test('initializes the Crowdin SDK with the configured distribution hash', () => {
    const client = createCrowdinOtaClient('distribution-hash')

    expect(client?.getHash()).toBe('distribution-hash')
  })
})
