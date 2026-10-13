import { useId, useMemo } from 'react'
import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { Button } from '../../../shared/ui/button'
import { InfoBanner } from '../../../shared/ui/info-banner'
import { Loader } from '../../../shared/ui/loader'
import { ModalActions } from '../../../shared/ui/modal-actions'
import { ModalField, ModalFieldError } from '../../../shared/ui/modal-field'
import { ModalShell } from '../../../shared/ui/modal-shell'
import { PhoneNumberField } from '../../../shared/ui/phone-number-field'
import { Skeleton } from '../../../shared/ui/skeleton'
import { deliveryPhoneCountries, deliveryErrors } from '../model/physical-card-order'
import { TokenIcon } from '../../../shared/ui/token-icon'
import type { PhysicalCardFlow } from '../use-physical-card-order'

/** Existing delivery step, backed by the physical-order flow. */
export function PhysicalCardDeliveryModal({ flow }: { flow: PhysicalCardFlow }) {
  const { i18n, t } = useAppTranslation()
  const id = useId()
  const busy = flow.phase !== 'editing'
  const disabled = busy || flow.loading || flow.addressLocked
  const countries = useMemo(() => {
    if (typeof Intl.DisplayNames !== 'function') return flow.countries
    const names = new Intl.DisplayNames([i18n.resolvedLanguage ?? 'en'], { type: 'region' })
    return flow.countries.map((country) => ({ ...country, name: names.of(country.code) ?? country.name }))
  }, [flow.countries, i18n.resolvedLanguage])
  const country = countries.find((item) => item.code === flow.address.country)
  const phoneCountries = useMemo(() => deliveryPhoneCountries(flow.countries), [flow.countries])
  const phoneError = flow.fields.phone ?? flow.fields.phoneCountry
  const phoneCountry = phoneCountries.find((item) => item.code === flow.address.phoneCountry) ?? null
  return (
    <ModalShell ariaLabel={t('home.delivery.title')} onClose={flow.close} panelClassName="flex flex-col gap-6 p-6">
      <header className="flex min-w-0 flex-col gap-2">
        <h2 className="text-base leading-none font-bold tracking-[-0.2px]">{t('home.delivery.title')}</h2>
        <p className="text-xs leading-[19.2px] font-light text-secondary">{t('home.delivery.description')}</p>
      </header>
      <div className="flex min-w-0 flex-col gap-4">
        {(['address', 'apartment', 'city', 'region', 'postcode'] as const).map((field) => (
          <ModalField
            key={field}
            label={t(`home.delivery.${field}`)}
            aria-label={t(`home.delivery.${field}`)}
            autoComplete={{ address: 'address-line1', apartment: 'address-line2', city: 'address-level2', region: 'address-level1', postcode: 'postal-code' }[field]}
            placeholder={field === 'address' ? t('home.delivery.addressPlaceholder') : field === 'city' ? t('home.delivery.cityPlaceholder') : field === 'apartment' ? t('home.delivery.optional') : field === 'postcode' ? '00000' : t('home.delivery.regionPlaceholder')}
            value={flow.address[field]}
            disabled={disabled}
            required={field !== 'apartment'}
            maxLength={field === 'postcode' ? 20 : 255}
            error={flow.fields[field] ? t(flow.fields[field]) : undefined}
            onChange={(event) => flow.change(field, event.target.value)}
          />
        ))}
        <label className="flex min-w-0 flex-col gap-2.5">
          <span className="text-[10px] leading-none font-light tracking-[2.2px] text-muted-foreground uppercase">{t('home.delivery.country')}</span>
          <span className="relative flex min-w-0 items-center justify-between gap-2 border-b border-border pt-0.5 pb-[17px] text-base leading-none font-light shadow-xs focus-within:border-accent">
            <span>{country ? `${country.flag} ${country.name}` : t('common.selectCountry')}</span>
            <TokenIcon className="size-4 text-secondary" src="/assets/home/chevron-down.svg" />
            <select
              className="absolute inset-0 h-full w-full min-w-0 cursor-pointer text-base opacity-0"
              aria-label={t('home.delivery.country')} value={flow.address.country} disabled={disabled} required
              aria-invalid={!!flow.fields.country} aria-describedby={flow.fields.country ? `${id}-country-error` : undefined}
              onChange={(event) => flow.change('country', event.target.value)}
            >
              <option value="">{t('common.selectCountry')}</option>
              {countries.map((item) => (
                <option className="[direction:rtl] text-left" key={item.code} value={item.code}>
                  {item.name} {'\u2066'}{item.flag}{'\u2069'}
                </option>
              ))}
            </select>
          </span>
          {flow.fields.country ? <ModalFieldError id={`${id}-country-error`} message={t(flow.fields.country)} /> : null}
        </label>
        <div className="flex min-w-0 flex-col gap-2.5">
          <span className="text-[10px] leading-none font-light tracking-[2.2px] text-muted-foreground uppercase">{t('home.delivery.phone')}</span>
          <PhoneNumberField
            countryLabel={t('home.delivery.phoneCountry')}
            countries={phoneCountries} country={phoneCountry} phone={flow.address.phone} disabled={disabled}
            error={phoneError ? t(phoneError) : undefined}
            onCountryChange={(item) => flow.change('phoneCountry', item.code)} onPhoneChange={(value) => flow.change('phone', value)}
          />
        </div>
      </div>
      {flow.loading ? <Skeleton className="h-8 w-full" /> : (
        <p className="text-xs leading-[19.2px] font-light text-secondary">{t('home.delivery.orderFee', { amount: flow.price === null ? t('common.notAvailable') : `USD ${Number(flow.price).toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 2 })}` })}</p>
      )}
      {flow.error ? <InfoBanner variant="warning">{t(flow.error)} {flow.canRetry ? <Button variant="ghost" size="chip" onClick={() => void flow.retry()}>{t('common.actions.retry')}</Button> : null}</InfoBanner> : null}
      <ModalActions
        preventSaveFocus={Object.keys(deliveryErrors(flow.address, flow.countries)).length > 0}
        saveDisabled={busy || flow.loading}
        saveContent={busy ? <Loader label={t('home.delivery.ordering')} /> : t('home.delivery.order')}
        onCancel={flow.close} onSave={() => void flow.submit()}
      />
    </ModalShell>
  )
}
