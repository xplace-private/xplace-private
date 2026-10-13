export type AppLanguage = 'en' | 'es' | 'fr' | 'ru'

interface AppLanguageStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface AppDocumentElement {
  lang: string
}

const APP_LANGUAGE_KEY = 'xplace.language'

export function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'en' || value === 'es' || value === 'fr' || value === 'ru'
}

export function readStoredAppLanguage(
  storage: AppLanguageStorage | null,
): AppLanguage {
  try {
    const language = storage?.getItem(APP_LANGUAGE_KEY) ?? null
    return isAppLanguage(language) ? language : 'en'
  } catch {
    return 'en'
  }
}

export function persistAppLanguage(
  language: AppLanguage,
  storage: AppLanguageStorage | null,
  documentElement: AppDocumentElement | null,
) {
  try {
    storage?.setItem(APP_LANGUAGE_KEY, language)
  } catch {
    // Storage can be unavailable in private browsing or embedded WebViews.
  }

  if (documentElement !== null) documentElement.lang = language
}
