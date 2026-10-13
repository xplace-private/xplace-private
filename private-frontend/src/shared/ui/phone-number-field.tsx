import { useId, useMemo } from 'react'
import { useAppTranslation } from '../i18n/app-i18n'
import type { PhoneCountry } from '../phone/phone-countries'
import { Button } from './button'
import { TokenIcon } from './token-icon'

interface PhoneNumberFieldProps {
  countryLabel?: string
  id?: string
  country: PhoneCountry | null
  countries: readonly PhoneCountry[]
  phone: string
  disabled: boolean
  error?: string | undefined
  onCountryChange(country: PhoneCountry): void
  onPhoneChange(value: string): void
}

export function PhoneNumberField({ id: suppliedId, countryLabel, country, countries, phone, disabled, error, onCountryChange, onPhoneChange }: PhoneNumberFieldProps) {
  const { i18n, t } = useAppTranslation()
  const generatedId = useId()
  const id = suppliedId ?? generatedId
  const language = i18n.resolvedLanguage ?? 'en'
  const localizedCountries = useMemo(() => {
    if (typeof Intl.DisplayNames !== 'function') return countries
    const names = new Intl.DisplayNames([language], { type: 'region' })

    return countries.map((country) => {
      try {
        return { ...country, name: names.of(country.code) ?? country.name }
      } catch {
        return country
      }
    })
  }, [language, countries])
  const selectedCountryName =
    localizedCountries.find((item) => item.code === country?.code)?.name ??
    country?.name
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <label className="group relative flex shrink-0">
          <span className="sr-only">
            {t('auth.phone.countryPicker', {
              country: selectedCountryName,
              code: country?.phoneCode,
            })}
          </span>
          <Button
            asChild
            className={`pointer-events-none w-[120px] shrink-0 justify-between gap-0 border-x-0 border-t-0 border-b-border py-[5.5px] pr-1 pl-0 text-primary normal-case shadow-xs group-focus-within:border-ring group-focus-within:ring-[3px] group-focus-within:ring-ring/50 ${
              disabled ? 'opacity-50' : ''
            }`}
            variant="ghost"
            textStyle="light"
          >
            <span aria-hidden>
              <span className="text-xl leading-5">{country?.flag ?? '🌐'}</span>
              <span className="text-2xl leading-9 font-light">
                {country?.phoneCode ?? '—'}
              </span>
              <TokenIcon
                className="size-4 text-primary"
                src="/assets/auth/country-chevron.svg"
              />
            </span>
          </Button>
          <select
            className="absolute inset-0 size-full cursor-pointer text-base opacity-0 disabled:cursor-default"
            name="country"
            aria-label={countryLabel}
            value={country?.code ?? ""}
            disabled={disabled}
            onChange={(event) => {
              const country = countries.find(
                (candidate) => candidate.code === event.target.value,
              )
              if (country) onCountryChange(country)
            }}
          >
            {countryLabel || country === null ? <option value="" disabled>{countryLabel ?? t('common.selectCountry')}</option> : null}
            {localizedCountries.map((country) => (
              <option
                className="[direction:rtl] text-left"
                key={country.code}
                value={country.code}
              >
                {country.name} {country.phoneCode} {'\u2066'}
                {country.flag}
                {'\u2069'}
              </option>
            ))}
          </select>
        </label>

        <label className="sr-only" htmlFor={id}>
          {t('auth.phone.inputLabel')}
        </label>
        <input
          className={`min-w-0 flex-1 border-b bg-transparent py-[5.5px] font-sans text-2xl leading-9 font-light text-foreground shadow-xs caret-primary outline-none disabled:opacity-100 ${
            error === undefined
              ? 'border-border focus:border-accent'
              : 'border-destructive focus:border-destructive'
          }`}
          id={id}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={phone}
          disabled={disabled}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : `${id}-error`}
          onChange={(event) => onPhoneChange(event.target.value)}
        />
      </div>
      {error !== undefined && (
        <p
          className="text-xs leading-5 font-light text-destructive"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
