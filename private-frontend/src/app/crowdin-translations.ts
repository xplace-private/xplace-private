import type { i18n } from 'i18next'

import {
  isAppLanguage,
  type AppLanguage,
} from '../shared/i18n/app-language'
import english from '../shared/i18n/locales/en.json'

interface CrowdinStringsClient {
  getStringsByLocale(language: string): Promise<unknown>
}

type TranslationResource = {
  [key: string]: string | TranslationResource
}

const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseTranslationResource(
  remoteValue: unknown,
  sourceValue: unknown,
  language: AppLanguage,
): TranslationResource | null {
  const remote = asRecord(remoteValue)
  const source = asRecord(sourceValue)
  if (remote === null || source === null) return null

  const resource: TranslationResource = {}
  for (const [key, sourceChild] of Object.entries(source)) {
    const remoteChild = remote[key]
    if (typeof sourceChild === 'string') {
      if (key.endsWith('_one')) {
        const pluralBase = key.slice(0, -'_one'.length)
        const sourceOther = source[`${pluralBase}_other`]
        if (typeof sourceOther === 'string') {
          for (const suffix of PLURAL_SUFFIXES) {
            const pluralKey = `${pluralBase}_${suffix}`
            const remotePlural = remote[pluralKey]
            if (
              typeof remotePlural === 'string' &&
              (language === 'en' ||
                (remotePlural !== sourceChild && remotePlural !== sourceOther))
            ) {
              resource[pluralKey] = remotePlural
            }
          }
          continue
        }
      }
      if (key.endsWith('_other')) {
        const pluralBase = key.slice(0, -'_other'.length)
        if (typeof source[`${pluralBase}_one`] === 'string') continue
      }
      if (
        typeof remoteChild === 'string' &&
        (language === 'en' || remoteChild !== sourceChild)
      ) {
        resource[key] = remoteChild
      }
      continue
    }

    const child = parseTranslationResource(remoteChild, sourceChild, language)
    if (child !== null) resource[key] = child
  }

  return Object.keys(resource).length === 0 ? null : resource
}

export async function loadCrowdinTranslations(
  client: CrowdinStringsClient | null,
  i18n: i18n,
  language: AppLanguage,
) {
  if (client === null) return false

  try {
    const resource = parseTranslationResource(
      await client.getStringsByLocale(language === 'es' ? 'es-ES' : language),
      english,
      language,
    )
    if (resource === null) return false

    i18n.addResourceBundle(language, 'translation', resource, true, true)
    return true
  } catch {
    return false
  }
}

export function startCrowdinTranslationSync(
  client: CrowdinStringsClient | null,
  i18n: i18n,
) {
  const loadLanguage = (language: string) => {
    if (isAppLanguage(language)) {
      void loadCrowdinTranslations(client, i18n, language)
    }
  }

  i18n.on('languageChanged', loadLanguage)
  loadLanguage(i18n.resolvedLanguage ?? i18n.language)

  return () => i18n.off('languageChanged', loadLanguage)
}
