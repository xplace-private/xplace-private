import { describe, expect, test } from 'vitest'

import { createAppI18n } from './app-i18n'

describe('app i18n', () => {
  test('provides source copy for every application area', () => {
    const i18n = createAppI18n('en')

    expect(i18n.t('common.actions.continue')).toBe('Continue')
    expect(i18n.t('auth.phone.title')).toBe('Apply or sign in')
    expect(i18n.t('onboarding.residency.title')).toBe('Where do you live?')
    expect(i18n.t('home.cards.title')).toBe('Your cards')
    expect(i18n.t('transactions.title')).toBe('Transactions')
    expect(i18n.t('payment.title')).toBe('Make a payment')
    expect(i18n.t('verification.continue.title')).toBe(
      'Continue identity verification',
    )
  })

  test('serves contextual Russian copy with interpolation and plural forms', () => {
    const i18n = createAppI18n('ru')

    expect(i18n.t('auth.phone.title')).toBe('Подать заявку или войти')
    expect(i18n.t('home.statement.days', { count: 1 })).toBe('1 день')
    expect(i18n.t('home.statement.days', { count: 2 })).toBe('2 дня')
    expect(i18n.t('home.statement.days', { count: 5 })).toBe('5 дней')
    expect(i18n.t('transactions.openDetails', { merchant: 'Zuma' })).toBe(
      'Открыть детали операции Zuma',
    )
  })

  test('serves contextual French copy with interpolation and plural forms', () => {
    const i18n = createAppI18n('fr')

    expect(i18n.t('auth.phone.title')).toBe('Faire une demande ou se connecter')
    expect(i18n.t('home.statement.days', { count: 1 })).toBe('1 jour')
    expect(i18n.t('home.statement.days', { count: 2 })).toBe('2 jours')
    expect(i18n.t('transactions.openDetails', { merchant: 'Zuma' })).toBe(
      'Ouvrir les détails de la transaction Zuma',
    )
  })

  test('serves contextual Spanish copy with interpolation and plural forms', () => {
    const i18n = createAppI18n('es')

    expect(i18n.t('auth.phone.title')).toBe(
      'Solicita una cuenta o inicia sesión',
    )
    expect(i18n.t('home.paymentPlans.months', { count: 1 })).toBe('1 mes')
    expect(i18n.t('home.paymentPlans.months', { count: 2 })).toBe('2 meses')
    expect(i18n.t('transactions.openDetails', { merchant: 'Zuma' })).toBe(
      'Abrir los detalles de la transacción Zuma',
    )
  })

  test('does not leak remote overrides into a new i18n instance', () => {
    const first = createAppI18n('en')
    first.addResourceBundle(
      'en',
      'translation',
      { auth: { phone: { title: 'Remote title' } } },
      true,
      true,
    )

    const second = createAppI18n('en')

    expect(second.t('auth.phone.title')).toBe('Apply or sign in')
  })
})
