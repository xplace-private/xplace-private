import { describe, expect, test } from 'vitest'

import {
  persistAppLanguage,
  readStoredAppLanguage,
} from './app-language'

function createMemoryStorage(initialValue: string | null = null) {
  let value = initialValue

  return {
    getItem() {
      return value
    },
    setItem(_key: string, nextValue: string) {
      value = nextValue
    },
  }
}

describe('app language persistence', () => {
  test('restores supported languages and falls back from invalid storage', () => {
    expect(readStoredAppLanguage(createMemoryStorage('en'))).toBe('en')
    expect(readStoredAppLanguage(createMemoryStorage('ru'))).toBe('ru')
    expect(readStoredAppLanguage(createMemoryStorage('fr'))).toBe('fr')
    expect(readStoredAppLanguage(createMemoryStorage('es'))).toBe('es')
    expect(readStoredAppLanguage(createMemoryStorage('de'))).toBe('en')
    expect(readStoredAppLanguage(null)).toBe('en')
  })

  test('persists the selected language and updates the document language', () => {
    const storage = createMemoryStorage()
    const documentElement = { lang: 'en' }

    persistAppLanguage('ru', storage, documentElement)

    expect(readStoredAppLanguage(storage)).toBe('ru')
    expect(documentElement.lang).toBe('ru')
  })

  test('still updates the document when browser storage is unavailable', () => {
    const documentElement = { lang: 'en' }

    persistAppLanguage(
      'ru',
      {
        getItem() {
          throw new Error('Storage unavailable')
        },
        setItem() {
          throw new Error('Storage unavailable')
        },
      },
      documentElement,
    )

    expect(documentElement.lang).toBe('ru')
  })
})
