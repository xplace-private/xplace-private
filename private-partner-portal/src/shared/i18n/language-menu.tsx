import { changeAppLanguage, useAppTranslation } from './app-i18n'
import { isAppLanguage, type AppLanguage } from './app-language'
import { TokenIcon } from '../ui/token-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSelectorTrigger,
} from '../ui/dropdown-menu'

export function LanguageMenu() {
  const { i18n, t } = useAppTranslation()
  const resolvedLanguage = i18n.resolvedLanguage ?? null
  const language: AppLanguage = isAppLanguage(resolvedLanguage)
    ? resolvedLanguage
    : 'en'
  const languageName = t(`shell.language.${languageNames[language]}`)

  return (
    <DropdownMenu>
      <DropdownMenuSelectorTrigger ariaLabel={t('shell.language.change', { language: languageName })}>
          <TokenIcon className="size-3" src="/assets/shared/language-globe.svg" />
          <span>{language.toUpperCase()}</span>
      </DropdownMenuSelectorTrigger>
      <DropdownMenuContent align="end" className="py-[3px]">
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => {
            if (isAppLanguage(value)) {
              void changeAppLanguage(i18n, value)
            }
          }}
        >
          <DropdownMenuRadioItem value="en">
            {t('shell.language.english')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="ru">
            {t('shell.language.russian')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="fr">
            {t('shell.language.french')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="es">
            {t('shell.language.spanish')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const languageNames = {
  en: 'english',
  es: 'spanish',
  fr: 'french',
  ru: 'russian',
} as const satisfies Record<AppLanguage, string>
