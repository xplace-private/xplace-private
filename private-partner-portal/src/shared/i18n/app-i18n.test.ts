import { expect, test } from 'vitest'

import { createAppI18n } from './app-i18n'

test.each([
  ['en', 'Cancel', 'Loading'],
  ['ru', 'Отмена', 'Загрузка'],
  ['fr', 'Annuler', 'Chargement'],
  ['es', 'Cancelar', 'Cargando'],
] as const)('provides shared UI translations in %s', (language, cancel, loading) => {
  const i18n = createAppI18n(language)

  expect(i18n.t('common.actions.cancel')).toBe(cancel)
  expect(i18n.t('common.loading')).toBe(loading)
})

test('interpolates the current language for the menu accessible name', () => {
  const i18n = createAppI18n('en')

  expect(i18n.t('shell.language.change', { language: 'English' })).toBe(
    'Change language, current English',
  )
})

test('does not leak remote overrides into a new i18n instance', () => {
  const first = createAppI18n('en')
  first.addResourceBundle('en', 'translation', { common: { actions: { save: 'Remote save' } } }, true, true)

  expect(createAppI18n('en').t('common.actions.save')).toBe('Save')
})
