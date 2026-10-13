import { I18nextProvider } from 'react-i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import { createAppI18n } from '../../shared/i18n/app-i18n'
import type { PartnerClient } from './api/home-gateway'
import { ClientPaymentModal } from './client-payment-modal'

const client: PartnerClient = {
  id: 'client-1', name: 'David Mitchell', email: 'david@example.test', phone: null,
  registeredAt: null, closedAt: null, status: 'suspended',
  partnerReviewDetails: null,
  paymentDetails: {
    source: 'mock', currency: 'USD', statementOwed: 499.88, dueDate: '2026-09-05', unpaidBalance: 3034.90,
    amountToPay: 3084.90, suspensionDate: '2026-09-09', balanceAsOf: null, monthlyLateFeePercent: 2.99,
    minimumLateFee: 50, bankRails: [{ type: 'swift', currency: 'USD', thirdPartyAllowed: null, fields: [{ name: 'accountName', value: 'David Mitchell' }, { name: 'bank', value: 'Emirates NBD' }, { name: 'iban', value: 'AE070331234567890123456' }, { name: 'swift', value: 'EBILEAD' }] }],
    eur: null, crypto: null,
    proofEmail: 'proof@example.test',
  },
}

function render(paymentClient: PartnerClient) {
  return renderToStaticMarkup(<ClientPaymentModal client={paymentClient} onClose={() => undefined} returnFocusElement={null} />)
}

test('renders selected client payment details and the status-specific notice', () => {
  const suspended = render(client)
  expect(suspended).toContain('David Mitchell')
  expect(suspended).toContain('Account suspended')
  expect(suspended).toContain('suspended on 9 September')
  expect(suspended).toContain('USD 499.88')
  expect(suspended).toContain('5 Sep')
  expect(suspended).toContain('USD 3,084.90')
  expect(suspended).toContain('AE070331234567890123456')
  expect(suspended).toContain('proof@example.test')
  expect(render({ ...client, status: 'overdue' })).toContain('Payment overdue')
})

test('keeps unknown values unavailable and preserves zero', () => {
  const html = render({ ...client, status: 'overdue', paymentDetails: {
    ...client.paymentDetails!, statementOwed: 0, dueDate: null, unpaidBalance: null,
    amountToPay: null, suspensionDate: null, monthlyLateFeePercent: 0, minimumLateFee: 0,
    bankRails: [], proofEmail: null,
  } })
  expect(html).toContain('USD 0.00')
  expect(html).toContain('0%')
  expect(html).toContain('Pay —')
  expect(html).not.toContain('AE070331234567890123456')
  expect(html).toContain('disabled=""')
  expect(html).not.toContain('role="tablist"')
})

test('adds payment methods to each payment status, defaults to existing USD details, and excludes other statuses', () => {
  const paymentDetails = { ...client.paymentDetails!,
    eur: { usdRate: 0.8807, statementOwed: 440.24, identity: 'Pontech Group L.L.C-FZ', bankName: 'Emirates NBD', iban: '110987654321', bic: 'SP29NWBK60161331926819', reference: 'XP-4417-8825' },
    crypto: { depositAddress: 'So1aNaXP1cePr1vAteDemo7yqW3kZ9mDepos7ADDRnotreal' },
  }
  for (const status of ['overdue', 'suspended', 'offboarding-pending'] as const) {
    const html = render({ ...client, status, paymentDetails })
    expect(html).toContain('role="tablist"')
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>USD</)
    expect(html).toMatch(/role="tab"[^>]*aria-selected="false"[^>]*>EUR</)
    expect(html).toContain('>Crypto<span')
    expect(html).toContain('AE070331234567890123456')
    expect(html).toContain('proof@example.test')
    expect(html).not.toContain('Pontech Group')
    expect(html).not.toContain(paymentDetails.crypto.depositAddress)
  }
  for (const status of ['active', 'onboarding', 'partner-review', 'limit-review', 'closed', 'contact-support'] as const) {
    expect(render({ ...client, status, paymentDetails })).toBe('')
  }
})

test('offboarding notice precedes shared payment details and keeps missing dates unknown', () => {
  const offboarding = render({ ...client, status: 'offboarding-pending', closedAt: '2026-09-12', paymentDetails: {
    ...client.paymentDetails!, unpaidBalance: 3084.90, balanceAsOf: '2026-09-29',
  } })
  expect(offboarding).toContain('Account closed – balance outstanding')
  expect(offboarding).toContain('closed on 12 September')
  expect(offboarding).toContain('USD 3,084.90 as of 29 September')
  expect(offboarding.indexOf('Account closed')).toBeLessThan(offboarding.indexOf('Statement owed'))
  expect(offboarding).toContain('Contact Team')
  expect(offboarding).toContain('href="https://wa.me/971554570290" target="_blank" rel="noopener noreferrer"')
  expect(offboarding).toContain('Close')
  expect(offboarding).toContain('proof@example.test')

  const unknown = render({ ...client, status: 'offboarding-pending', paymentDetails: null })
  expect(unknown).toContain('closed on —')
  expect(unknown).toContain('as of —')
  expect(unknown).not.toContain('29 September')
})


test.each([false, true])('shows only Wire when ACH is also returned, regardless of response order (%s)', (wireFirst) => {
  const wire = { type: 'wire' as const, currency: 'USD' as const, thirdPartyAllowed: true, fields: [{ name: 'accountNumber' as const, value: '8848841589' }, { name: 'routingNumber' as const, value: '021000021' }] }
  const ach = { type: 'ach' as const, currency: 'USD' as const, thirdPartyAllowed: false, fields: [{ name: 'accountNumber' as const, value: '8848841589' }, { name: 'routingNumber' as const, value: '734755376' }] }
  const html = render({ ...client, paymentDetails: {
    ...client.paymentDetails!, source: 'api', statementOwed: 2000, unpaidBalance: 2000, amountToPay: 2000,
    bankRails: wireFirst ? [wire, ach] : [ach, wire],
  } })
  expect(html.match(/USD 2,000.00/g)).toHaveLength(3)
  expect(html).not.toContain('>Wire<')
  expect(html).not.toContain('>ACH<')
  expect(html).toContain('021000021')
  expect(html).not.toContain('734755376')
  expect(html.match(/>8848841589</g)).toHaveLength(1)
  expect(html).not.toContain('IBAN')
  expect(html).not.toContain('SWIFT')
  expect(html).not.toContain('Transfers from third parties are not supported for this account.')
  expect(html).toMatch(/Statement owed<\/span><span[^>]*>USD 2,000.00<\/span><\/div><div data-mock="true"/)
  expect(html).toMatch(/data-mock="true"[^>]*>.*?MOCK.*?Due date/)
  expect(html).toMatch(/data-mock="true"[^>]*>.*?MOCK.*?proof@example.test/)
  expect(html.match(/data-mock="true"/g)).toHaveLength(2)
})

test('makes missing bank rails explicit while keeping the remaining crypto option visibly mocked', () => {
  const html = render({ ...client, paymentDetails: {
    ...client.paymentDetails!, source: 'api', bankRails: [], unpaidBalance: 0, amountToPay: 0,
    crypto: { depositAddress: 'demo-address' },
  } })
  expect(html).toContain('Bank payment details are currently unavailable.')
  expect(html).toContain('Pay USD 0.00')
  expect(html).toContain('demo-address')
  expect(html).toMatch(/role="tab"[^>]*disabled=""[^>]*>USD</)
  expect(html).toMatch(/role="tab"[^>]*disabled=""[^>]*>EUR</)
  expect(html).toContain('aria-label="Mock data"')
  expect(html).not.toContain('Emirates NBD')
})

test('keeps a lone ACH and displays empty optional fields as unavailable with copying disabled', () => {
  const html = render({ ...client, paymentDetails: {
    ...client.paymentDetails!, source: 'api', bankRails: [{ type: 'ach', currency: 'USD', thirdPartyAllowed: false, fields: [
      { name: 'accountNumber', value: 'ACH-ACCOUNT' }, { name: 'routingNumber', value: '021000021' }, { name: 'bankAddress', value: '   ' },
    ] }],
  } })
  expect(html).toContain('ACH-ACCOUNT')
  expect(html).toContain('021000021')
  expect(html).toContain('Transfers from third parties are not supported for this account.')
  expect(html).not.toContain('>ACH<')
  expect(html).toMatch(/>—<\/span><button[^>]*disabled=""[^>]*aria-label="Copy Bank address"/)
  expect(html).not.toContain('IBAN')
})

test.each(['suspended', 'overdue', 'offboarding-pending'] as const)('prioritizes SWIFT within the selected currency for %s', (status) => {
  for (const swiftFirst of [false, true]) {
    const swift = { type: 'swift' as const, currency: 'USD' as const, thirdPartyAllowed: null, fields: [{ name: 'accountNumber' as const, value: 'SWIFT-ACCOUNT' }] }
    const wire = { type: 'wire' as const, currency: 'USD' as const, thirdPartyAllowed: null, fields: [{ name: 'accountNumber' as const, value: 'WIRE-ACCOUNT' }] }
    const ach = { type: 'ach' as const, currency: 'USD' as const, thirdPartyAllowed: null, fields: [{ name: 'accountNumber' as const, value: 'ACH-ACCOUNT' }] }
    const html = render({ ...client, status, paymentDetails: {
      ...client.paymentDetails!, source: 'api', bankRails: [
        { type: 'sepa', currency: 'EUR', thirdPartyAllowed: null, fields: [{ name: 'iban', value: 'EUR-IBAN' }] },
        ...(swiftFirst ? [swift, ach, wire] : [ach, wire, swift]),
      ],
    } })
    expect(html).toContain('SWIFT-ACCOUNT')
    expect(html).not.toContain('WIRE-ACCOUNT')
    expect(html).not.toContain('ACH-ACCOUNT')
    expect(html).not.toContain('EUR-IBAN')
  }
})


test('keeps live overdue debt outside the mock late-fee policy and future suspension date', () => {
  const html = render({ ...client, status: 'overdue', paymentDetails: {
    ...client.paymentDetails!, source: 'api', unpaidBalance: 2000, amountToPay: 2000,
  } })
  expect(html).toContain('USD 2,000.00 was not paid by the due date.')
  expect(html).toContain('Pay USD 2,000.00')
  expect(html.match(/data-mock="true"/g)).toHaveLength(4)
  expect(html).not.toContain('&lt;policy&gt;')
})


test('legacy translations cannot erase the mock markers from the updated overdue notice', () => {
  const i18n = createAppI18n('en')
  i18n.addResourceBundle('en', 'translation', { home: { clients: { payment: { overdue: {
    description: "{{balance}} was not paid by the due date. A late fee of {{rate}} per month (minimum {{minimum}}) is accruing daily. The client's card will be suspended on {{date}} if the balance remains unpaid.",
  } } } } }, true, true)
  const html = renderToStaticMarkup(<I18nextProvider i18n={i18n}><ClientPaymentModal client={{ ...client, status: 'overdue', paymentDetails: { ...client.paymentDetails!, source: 'api' } }} onClose={() => undefined} returnFocusElement={null} /></I18nextProvider>)
  expect(html).toContain('A late fee of 2.99%')
  expect(html.match(/data-mock="true"/g)).toHaveLength(4)
})
