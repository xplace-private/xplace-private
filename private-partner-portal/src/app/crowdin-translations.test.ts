import { expect, test } from 'vitest'

import { createAppI18n } from '../shared/i18n/app-i18n'
import { loadCrowdinTranslations, startCrowdinTranslationSync } from './crowdin-translations'

test('accepts only translated string keys from the portal source catalog', async () => {
  const i18n = createAppI18n('en')
  const loaded = await loadCrowdinTranslations({
    async getStringsByLocale() {
      return {
        common: { actions: { save: 'Remote save', cancel: 42 } },
        auth: { title: 'Unrelated product text' },
      }
    },
  }, i18n, 'en')

  expect(loaded).toBe(true)
  expect(i18n.t('common.actions.save')).toBe('Remote save')
  expect(i18n.t('common.actions.cancel')).toBe('Cancel')
  expect(i18n.exists('auth.title')).toBe(false)
})

test.each([null, [], { common: { loading: 42 } }, { common: { loading: 'Loading' } }])(
  'keeps bundled translations for malformed or untranslated remote strings',
  async (remote) => {
    const i18n = createAppI18n('ru')
    const loaded = await loadCrowdinTranslations({
      async getStringsByLocale() { return remote },
    }, i18n, 'ru')

    expect(loaded).toBe(false)
    expect(i18n.t('common.loading')).toBe('Загрузка')
  },
)

test('keeps local translations when Crowdin is disabled or unavailable', async () => {
  const i18n = createAppI18n('ru')
  expect(await loadCrowdinTranslations(null, i18n, 'ru')).toBe(false)
  expect(await loadCrowdinTranslations({
    async getStringsByLocale() { throw new Error('Unavailable') },
  }, i18n, 'ru')).toBe(false)
  expect(i18n.t('common.actions.cancel')).toBe('Отмена')
})

test('maps Spanish to its Crowdin locale and disposes language synchronization', async () => {
  const requested: string[] = []
  const i18n = createAppI18n('fr')
  const stop = startCrowdinTranslationSync({
    async getStringsByLocale(language) {
      requested.push(language)
      return {}
    },
  }, i18n)

  await i18n.changeLanguage('es')
  expect(requested).toEqual(['fr', 'es-ES'])
  stop()
  await i18n.changeLanguage('en')
  expect(requested).toEqual(['fr', 'es-ES'])
})
