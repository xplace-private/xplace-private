import { useAppTranslation } from '../../../shared/i18n/app-i18n'
import { PhoneNumberField } from '../../../shared/ui/phone-number-field'
import { FlowHeading } from '../../../shared/ui/flow-heading'
import { useAuthFlow } from '../auth-flow-provider'
import { authErrorMessage } from '../model/auth-error-message'
import { PHONE_COUNTRIES } from '../../../shared/phone/phone-countries'
import { AuthSubmitButton } from './auth-submit-button'

/** Phone-number entry step for requesting a WhatsApp verification code. */
export function PhoneStep() {
  const { t } = useAppTranslation()
  const { state, setCountry, setPhone, requestCode } = useAuthFlow()
  const error =
    state.errors.phone !== undefined
      ? t('auth.errors.phoneRequired')
      : state.gatewayError !== null
        ? authErrorMessage(state.gatewayError, t)
        : undefined

  return (
    <section className="flex min-w-0 flex-col gap-8 px-4 py-8">
      <FlowHeading
        eyebrow={t('common.brandEyebrow')}
        title={t('auth.phone.title')}
        description={t('auth.phone.description')}
      />

      <form
        className="flex min-w-0 flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault()
          void requestCode()
        }}
      >
        <PhoneNumberField
          id="phone-number"
          country={state.country}
          countries={PHONE_COUNTRIES}
          phone={state.phone}
          disabled={state.submission === 'pending'}
          error={error}
          onCountryChange={setCountry}
          onPhoneChange={setPhone}
        />

        <AuthSubmitButton
          loadingLabel={t('auth.phone.requesting')}
          pending={state.submission === 'pending'}
        />
      </form>
    </section>
  )
}
