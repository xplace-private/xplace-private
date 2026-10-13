import { describe, expect, test } from 'vitest'

import { createAppI18n } from '../shared/i18n/app-i18n'
import {
  loadCrowdinTranslations,
  startCrowdinTranslationSync,
} from './crowdin-translations'

describe('Crowdin translations', () => {
  test.each(['en', 'ru', 'fr', 'es'] as const)('keeps the actual card fee when an old %s catalog contains USD 99', async (language) => {
    const i18n = createAppI18n(language)
    const expected = i18n.t('home.delivery.orderFee', { amount: 'USD 0.01' })
    await loadCrowdinTranslations(
      { async getStringsByLocale() {
        return { home: { delivery: { fee: 'A USD 99 card fee is charged to your account when the card is dispatched. By ordering, you accept this charge.' } } }
      } },
      i18n,
      language,
    )

    expect(i18n.t('home.delivery.orderFee', { amount: 'USD 0.01' })).toBe(expected)
    expect(expected).toContain('USD 0.01')
  })

  test('keeps the recipient label when an old Crowdin catalog contains Identity', async () => {
    const i18n = createAppI18n('ru')
    await loadCrowdinTranslations(
      { async getStringsByLocale() { return { payment: { beneficiary: 'Identity' } } } },
      i18n,
      'ru',
    )

    expect(i18n.t('payment.beneficiaryName')).toBe('Получатель')
  })

  test('loads a validated full application catalog', async () => {
    const i18n = createAppI18n('en')

    const loaded = await loadCrowdinTranslations(
      {
        async getStringsByLocale() {
          return {
            auth: { phone: { title: 'Remote phone title' } },
            common: { actions: { continue: 'Remote continue' } },
          }
        },
      },
      i18n,
      'en',
    )

    expect(loaded).toBe(true)
    expect(i18n.t('auth.phone.title')).toBe('Remote phone title')
    expect(i18n.t('common.actions.continue')).toBe('Remote continue')
  })

  test('keeps local translations when Crowdin fails', async () => {
    const i18n = createAppI18n('ru')

    const loaded = await loadCrowdinTranslations(
      {
        async getStringsByLocale() {
          throw new Error('Crowdin unavailable')
        },
      },
      i18n,
      'ru',
    )

    expect(loaded).toBe(false)
    expect(i18n.t('auth.phone.title')).toBe('Подать заявку или войти')
  })

  test('keeps the bundled Russian copy when Crowdin returns untranslated English strings', async () => {
    const i18n = createAppI18n('ru')

    const loaded = await loadCrowdinTranslations(
      {
        async getStringsByLocale() {
          return { auth: { phone: { title: 'Apply or sign in' } } }
        },
      },
      i18n,
      'ru',
    )

    expect(loaded).toBe(false)
    expect(i18n.t('auth.phone.title')).toBe('Подать заявку или войти')
  })

  test('loads Russian plural variants for an English plural source key', async () => {
    const i18n = createAppI18n('ru')

    const loaded = await loadCrowdinTranslations(
      {
        async getStringsByLocale() {
          return {
            home: {
              statement: {
                days_one: '{{count}} сутки',
                days_few: '{{count}} суток',
                days_many: '{{count}} суток',
                days_other: '{{count}} суток',
              },
            },
          }
        },
      },
      i18n,
      'ru',
    )

    expect(loaded).toBe(true)
    expect(i18n.t('home.statement.days', { count: 2 })).toBe('2 суток')
  })

  test('rejects malformed Crowdin strings before they reach the UI', async () => {
    const i18n = createAppI18n('ru')

    const loaded = await loadCrowdinTranslations(
      {
        async getStringsByLocale() {
          return { auth: { phone: { title: 42, description: null } } }
        },
      },
      i18n,
      'ru',
    )

    expect(loaded).toBe(false)
    expect(i18n.t('auth.phone.title')).toBe('Подать заявку или войти')
  })

  test('syncs French and maps Spanish to its Crowdin locale code', async () => {
    const requestedLanguages: string[] = []
    const i18n = createAppI18n('fr')
    const stop = startCrowdinTranslationSync(
      {
        async getStringsByLocale(language) {
          requestedLanguages.push(language)
          return {}
        },
      },
      i18n,
    )

    await i18n.changeLanguage('es')

    expect(requestedLanguages).toEqual(['fr', 'es-ES'])
    stop()
  })
})
