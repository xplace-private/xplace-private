import { createInstance, type i18n as I18nInstance } from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'

import {
  persistAppLanguage,
  readStoredAppLanguage,
  type AppLanguage,
} from './app-language'
import english from './locales/en.json'
import spanish from './locales/es.json'
import french from './locales/fr.json'
import russian from './locales/ru.json'

const resources = {
  en: { translation: english },
  es: { translation: spanish },
  fr: { translation: french },
  ru: { translation: russian },
}

function initializeAppI18n(i18n: I18nInstance, language: AppLanguage) {
  void i18n.init({
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false },
    lng: language,
    react: { bindI18nStore: 'added' },
    resources: structuredClone(resources),
    supportedLngs: ['en', 'es', 'fr', 'ru'],
  })

  return i18n
}

export function createAppI18n(language: AppLanguage) {
  return initializeAppI18n(createInstance(), language)
}

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function getDocumentElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement
}

const initialLanguage = readStoredAppLanguage(getBrowserStorage())

export const appI18n = initializeAppI18n(
  createInstance().use(initReactI18next),
  initialLanguage,
)

persistAppLanguage(initialLanguage, null, getDocumentElement())

export function useAppTranslation() {
  return useTranslation()
}

export async function changeAppLanguage(
  i18n: I18nInstance,
  language: AppLanguage,
) {
  await i18n.changeLanguage(language)
  persistAppLanguage(language, getBrowserStorage(), getDocumentElement())
}
