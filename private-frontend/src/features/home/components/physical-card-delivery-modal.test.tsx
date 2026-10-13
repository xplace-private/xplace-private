import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { expect, test, vi } from 'vitest'
import { createAppI18n } from '../../../shared/i18n/app-i18n'
import { PhysicalCardDeliveryModal } from './physical-card-delivery-modal'
import { emptyPhysicalAddress } from '../model/physical-card-order'
import type { PhysicalCardFlow } from '../use-physical-card-order'

const flow: PhysicalCardFlow = {
  isOpen: true, canRetry: false, addressLocked: false, address: { ...emptyPhysicalAddress, country: 'AE' }, name: 'Travel', phase: 'editing', fields: {}, error: null, loading: false, price: '99.00',
  countries: [{ code: 'AE', flag: '🇦🇪', name: 'United Arab Emirates', phoneCode: '+971', postalCodeRegex: '^.*$' }],
  open: vi.fn(), close: vi.fn(), change: vi.fn(), submit: vi.fn(), retry: vi.fn(),
}
test('keeps delivery notices and adds server countries, region and phone country', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={flow} />)
  expect(html).toContain('Couriers cannot deliver to a PO box.')
  expect(html).toContain('USD 99')
  expect(html).toContain('United Arab Emirates')
  expect(html).toContain('🇦🇪')
  expect(html).toContain('State / region')
  expect(html).not.toContain('inputMode="numeric"')
  expect(html).not.toContain('First name')
  expect(html).not.toContain('Gold')
})
test('shows ordering loader but allows closing while the order completes', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={{ ...flow, phase: 'waiting' }} />)
  expect(html).toMatch(/data-close-disabled="false"/)
  expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Cancel<\/button>/)
  expect(html).toContain('Ordering physical card')
})
test('shows field errors and the real fee without losing the form', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={{ ...flow, address: { ...emptyPhysicalAddress, city: 'Dubai' }, price: '123.00', fields: { postcode: 'home.delivery.errors.postcode' } }} />)
  expect(html).toContain('USD 123')
  expect(html).toContain('value="Dubai"')
  expect(html).toContain('aria-invalid="true"')
})

test.each(['en', 'ru', 'fr', 'es'] as const)('interpolates the backend fee in the %s consent', (language) => {
  for (const price of ['0.01', '199.00']) {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={createAppI18n(language)}>
        <PhysicalCardDeliveryModal flow={{ ...flow, price }} />
      </I18nextProvider>,
    )
    expect(html).toContain(`USD ${price === '199.00' ? '199' : language === 'en' ? '0.01' : '0,01'}`)
    expect(html).not.toContain('USD 99')
    expect(html).not.toContain('{{amount}}')
    if (language === 'en') {
      expect(html).toContain('when you place the order')
      expect(html).not.toContain('when the card is dispatched')
    }
  }
})

test('keeps an unknown fee unavailable instead of inventing a charge', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={{ ...flow, price: null }} />)
  expect(html).toContain('Not available')
  expect(html).not.toContain('USD')
})

test('shows a skeleton and disables ordering while the price is loading', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={{ ...flow, loading: true }} />)
  expect(html).not.toContain('card fee')
  expect(html).not.toContain('USD 99')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Order card<\/button>/)
})

test('does not offer a read retry for a rejected payment', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={{ ...flow, error: 'home.delivery.errors.balance' }} />)
  expect(html).toContain('Insufficient balance')
  expect(html).not.toMatch(/<button[^>]*>Try again<\/button>/)
})
test('labels the phone country selector and preserves the country icon', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={flow} />)
  expect(html).toContain('Select phone number country')
  expect(html).toContain('/assets/home/chevron-down.svg')
})

test('uses a native delivery select with country names first for keyboard search', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={flow} />)
  expect(html).toMatch(/<select[^>]*aria-label="Country"/)
  expect(html).toMatch(/<option[^>]*value="AE"[^>]*>United Arab Emirates /)
  expect(html).not.toContain('type="search"')
})

test('marks state or region as required without an optional placeholder', () => {
  const html = renderToStaticMarkup(<PhysicalCardDeliveryModal flow={flow} />)
  const input = html.match(/<input[^>]*aria-label="State \/ region"[^>]*>/)?.[0]
  expect(input).toBeDefined()
  expect(input).toContain('required=""')
  expect(input).toContain('placeholder="Dubai"')
})
