import { describe, expect, test } from 'vitest'

import { readAppEnv } from './app-env'

describe('readAppEnv', () => {
  test('keeps isolated test modules usable without an API origin', () => {
    expect(readAppEnv({ MODE: 'test' })).toEqual({
      mode: 'test',
      apiBaseUrl: null,
      crowdinDistributionHash: null,
    })
  })

  test('reads an optional public Crowdin distribution hash', () => {
    expect(
      readAppEnv({
        MODE: 'test',
        VITE_CROWDIN_DISTRIBUTION_HASH: ' distribution-hash ',
      }),
    ).toEqual({
      mode: 'test',
      apiBaseUrl: null,
      crowdinDistributionHash: 'distribution-hash',
    })

    expect(
      readAppEnv({ MODE: 'test', VITE_CROWDIN_DISTRIBUTION_HASH: '  ' }),
    ).toEqual({
      mode: 'test',
      apiBaseUrl: null,
      crowdinDistributionHash: null,
    })
  })

  test('normalizes the staging and production origins', () => {
    expect(
      readAppEnv({
        MODE: 'staging',
        VITE_API_BASE_URL: ' https://back-stage.x.place/ ',
      }),
    ).toEqual({
      mode: 'staging',
      apiBaseUrl: 'https://back-stage.x.place',
      crowdinDistributionHash: null,
    })
    expect(
      readAppEnv({
        MODE: 'production',
        VITE_API_BASE_URL: 'https://back.x.place/',
      }),
    ).toEqual({
      mode: 'production',
      apiBaseUrl: 'https://back.x.place',
      crowdinDistributionHash: null,
    })
  })

  test('allows a same-origin API path only in development', () => {
    expect(
      readAppEnv({
        MODE: 'development',
        VITE_API_BASE_URL: ' /api/ ',
      }),
    ).toEqual({
      mode: 'development',
      apiBaseUrl: '/api',
      crowdinDistributionHash: null,
    })
    expect(() =>
      readAppEnv({ MODE: 'staging', VITE_API_BASE_URL: '/api' }),
    ).toThrow('VITE_API_BASE_URL must be an absolute URL')
  })

  test.each(['development', 'dev', 'staging', 'production'])(
    'requires an API origin for %s builds',
    (mode) => {
      expect(() => readAppEnv({ MODE: mode })).toThrow(
        `VITE_API_BASE_URL is required for mode "${mode}"`,
      )
      expect(() =>
        readAppEnv({ MODE: mode, VITE_API_BASE_URL: '  ' }),
      ).toThrow(`VITE_API_BASE_URL is required for mode "${mode}"`)
    },
  )

  test('rejects a value that is not an http URL', () => {
    expect(() =>
      readAppEnv({ MODE: 'development', VITE_API_BASE_URL: 'back.x.place' }),
    ).toThrow('VITE_API_BASE_URL must be an absolute URL')
    expect(() =>
      readAppEnv({ MODE: 'development', VITE_API_BASE_URL: 'ftp://back.x.place' }),
    ).toThrow('VITE_API_BASE_URL must be an http or https URL')
  })
})
