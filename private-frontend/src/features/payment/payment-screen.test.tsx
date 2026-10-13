import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, test } from 'vitest'

import { createAppI18n } from '../../shared/i18n/app-i18n'
import {
  CryptoPaymentDetails,
  CryptoDeposits,
  PaymentMethodTabs,
  PaymentScreen,
} from './payment-screen'
import type { PaymentDetails } from './payment-data'
import type { BankDepositsState, CryptoDepositsState } from './deposits-query'
import type { BankDeposit } from './api/deposits-gateway'

const mockPaymentDetails: PaymentDetails = {
  statement: { balance: 'USD 499.88', amountCents: 49988, statementDate: '5 Sep' },
}
const cryptoDeposits: CryptoDepositsState = {
  status: 'ready',
  details: { address: '0x1234567890123456789012345678901234567890', asset: 'USDC', network: 'ERC-20' },
}
const bankDeposits: BankDepositsState = {
  status: 'ready', deposits: [{
    id: 'iron-ach', status: 'Approved', sourceCurrency: 'usd', acceptsThirdPartyDeposits: false,
    instructions: {
      paymentRail: 'ach', beneficiaryName: 'API Beneficiary', bankName: 'API Bank',
      accountNumber: '00123456789', routingNumber: '021000021',
      beneficiaryAddress: null, bankAddress: null,
    },
  }],
}
const eurDeposits: BankDepositsState = { status: 'loading', deposits: [] }
const readyEurDeposits: BankDepositsState = {
  status: 'ready', deposits: [{
    id: 'iron-sepa', status: 'Approved', sourceCurrency: 'eur', acceptsThirdPartyDeposits: true,
    instructions: {
      paymentRail: 'sepa', beneficiaryName: 'EUR Beneficiary', beneficiaryAddress: 'EUR Beneficiary Address',
      iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', reference: 'EUR-REFERENCE',
      bankName: 'EUR Bank', bankAddress: 'EUR Bank Address',
    },
  }],
}

const planAdjustment = {
  id: 'plan-emirates',
  merchant: 'Emirates Airlines',
  originalAmount: 'USD 2,840.00',
  monthlyPayment: 'USD 515.93/mo',
  termLabel: '6 months',
  reductionCents: 232407,
  reduction: '−USD 2,324.07',
}

describe('PaymentScreen', () => {
  test('shows three payment method skeletons and hides the date while initially loading', () => {
    const html = renderToStaticMarkup(<PaymentScreen
      details={{ statement: { balance: 'Not available', amountCents: null, loading: true, statementDate: 'Not available' } }}
      bankDeposits={{ status: 'loading', deposits: [] }} eurDeposits={eurDeposits}
      cryptoDeposits={{ status: 'loading', details: null }} eurDebt={{ status: 'loading' }} />)
    const summary = html.slice(html.indexOf('<section'), html.indexOf('</section>'))
    expect(summary.match(/animate-pulse/g)).toHaveLength(2)
    expect(summary).not.toContain('Not available')
    const method = html.match(/<section[^>]*aria-busy="true"[^>]*><p[^>]*>Payment method<\/p>(.*?)<\/section>/)?.[1]
    expect(method?.match(/animate-pulse/g)).toHaveLength(3)
    expect(method).not.toContain('<button')
    expect(html).not.toContain('EUR RATES')
  })

  test('keeps the date skeleton when the quote arrives before the balance endpoint', () => {
    const html = renderToStaticMarkup(<PaymentScreen
      details={{ statement: { balance: 'Not available', loading: true, dateLoading: true, statementDate: 'Not available' } }}
      bankDeposits={bankDeposits} eurDeposits={readyEurDeposits} cryptoDeposits={cryptoDeposits}
      eurDebt={{ status: 'ready', quote: { fxRate: '0.92590760', amountEurCents: 92593, amountUsdCents: 100000 } }} />)
    const summary = html.slice(html.indexOf('<section'), html.indexOf('</section>'))
    expect(summary).toContain('USD 1,000.00')
    expect(summary).not.toContain('Not available')
    expect(summary.match(/animate-pulse/g)).toHaveLength(1)
  })

  test.each([0, 12345, 150000])('shows the real total debt as USDC at 1:1 (%s cents)', (amountCents) => {
    const html = renderToStaticMarkup(<PaymentScreen
      details={{ statement: { balance: 'USD total', amountCents, statementDate: '5 Sep' } }}
      bankDeposits={{ status: 'unavailable', deposits: [] }} eurDeposits={eurDeposits}
      cryptoDeposits={cryptoDeposits} />)
    expect(html).toContain('1 USDC = 1 USD')
    expect(html).toContain({ 0: '0.00 USDC', 12345: '123.45 USDC', 150000: '1,500.00 USDC' }[amountCents])
    expect(html).not.toContain('499.88 USDC')
  })

  test('hides crypto rates when total debt is unknown', () => {
    const html = renderToStaticMarkup(<PaymentScreen
      details={{ statement: { balance: 'Not available', amountCents: null, statementDate: '5 Sep' } }}
      bankDeposits={{ status: 'unavailable', deposits: [] }} eurDeposits={eurDeposits}
      cryptoDeposits={cryptoDeposits} />)
    expect(html).not.toContain('USDC RATES')
    expect(html).not.toContain('1 USDC = 1 USD')
    expect(html).toContain('Not available')
    expect(html).not.toContain('0.00 USDC')
    expect(html).not.toContain('499.88 USDC')
  })

  test.each(['loading', 'error'] as const)('preserves EUR requisites while the quote is %s without showing mock prices', (status) => {
    const html = renderToStaticMarkup(<PaymentScreen details={mockPaymentDetails}
      bankDeposits={{ status: 'unavailable', deposits: [] }} eurDeposits={readyEurDeposits}
      cryptoDeposits={cryptoDeposits} eurDebt={{ status }} />)
    expect(html).not.toContain('EUR RATES')
    expect(html).toContain('EUR Beneficiary')
    expect(html).toContain('DE89370400440532013000')
    expect(html).not.toContain('FX rate')
    expect(html).not.toContain('0.8807')
    expect(html).not.toContain('440.24')
    expect(html).not.toContain('EUR rates are currently unavailable')
    expect(html).not.toContain('Try again')
    expect(html).not.toContain('animate-pulse')
  })

  test('uses the backend zero EUR amount and its matching USD debt', () => {
    const html = renderToStaticMarkup(<PaymentScreen details={mockPaymentDetails}
      bankDeposits={{ status: 'unavailable', deposits: [] }} eurDeposits={readyEurDeposits}
      cryptoDeposits={cryptoDeposits}
      eurDebt={{ status: 'ready', quote: { fxRate: '0.92592593', amountEurCents: 0, amountUsdCents: 0 } }} />)
    expect(html).toContain('1 USD = 0.9259 EUR')
    expect(html).toContain('EUR 0.00')
    expect(html).toContain('USD 0.00')
    expect(html).not.toContain('USD 499.88')
  })

  test.each([
    [true, false, false, 'USD'],
    [false, true, false, 'EUR'],
    [false, false, true, 'USDC'],
    [true, true, false, 'USD'],
    [true, false, true, 'USD'],
    [false, true, true, 'EUR'],
    [true, true, true, 'USD'],
  ] as const)('selects the first ready account (USD %s, EUR %s, USDC %s)', (usd, eur, usdc, selected) => {
    const html = renderToStaticMarkup(<PaymentScreen details={mockPaymentDetails}
      bankDeposits={usd ? bankDeposits : { status: 'loading', deposits: [] }}
      eurDeposits={eur ? readyEurDeposits : eurDeposits}
      eurDebt={{ status: 'ready', quote: { fxRate: '0.92590760', amountEurCents: 92593, amountUsdCents: 100000 } }}
      cryptoDeposits={usdc ? cryptoDeposits : { status: 'loading', details: null }} />)
    expect(html).toMatch(new RegExp(`<button[^>]*aria-pressed="true"[^>]*><span[^>]*>${selected}</span></button>`))
    const visibleTabs = [...html.matchAll(/data-size="chip"[^>]*><span[^>]*>([^<]+)<\/span>/g)].map((match) => match[1])
    expect(visibleTabs).toEqual([
      ...(usd ? ['USD'] : []), ...(eur ? ['EUR'] : []), ...(usdc ? ['USDC'] : []),
    ])
    if (selected === 'EUR') {
      for (const value of ['EUR Beneficiary', 'EUR Beneficiary Address', 'EUR Bank', 'EUR Bank Address',
        'DE89370400440532013000', 'COBADEFFXXX', 'EUR-REFERENCE']) expect(html).toContain(value)
      expect(html).toContain('SEPA transfer to')
      expect(html).toContain('EUR RATES')
      expect(html).toContain('1 USD = 0.9259 EUR')
      expect(html).toContain('EUR 925.93')
      expect(html).toContain('USD 1,000.00')
      expect(html).not.toContain('USD 499.88')
      expect(html).toContain('>Beneficiary</span>')
      expect(html).toContain('>SWIFT / BIC</span>')
      expect(html).not.toContain('Identity')
      expect(html.match(/data-bank-row=/g)).toHaveLength(8)
    } else if (selected === 'USDC') {
      expect(html).toContain('USDC RATES')
      expect(html).toContain('1 USDC = 1 USD')
      expect(html).toContain('1,000.00 USDC')
      expect(html).toContain(cryptoDeposits.details!.address)
    }
  })

  test.each(['loading', 'unavailable', 'timed-out'] as const)('shows skeletons while waiting for the first account even if USD is %s', (status) => {
    const html = renderToStaticMarkup(<PaymentScreen details={mockPaymentDetails}
      bankDeposits={{ status, deposits: [] }} eurDeposits={eurDeposits}
      cryptoDeposits={{ status: 'loading', details: null }} />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('animate-pulse rounded-md bg-border')
    expect(html).not.toContain('data-size="chip"')
    expect(html).not.toContain('API Beneficiary')
    expect(html).not.toContain(cryptoDeposits.details!.address)
  })
  test('renders payment details supplied by the route data boundary', () => {
    const html = renderToStaticMarkup(
      <PaymentScreen eurDeposits={eurDeposits}
        cryptoDeposits={cryptoDeposits}
        bankDeposits={bankDeposits}
        details={{
          statement: { balance: 'USD 123.45', statementDate: '18 Oct' },
        }}
      />,
    )

    expect(html).toContain('USD 123.45')
    expect(html).toContain('18 Oct')
    expect(html).toContain('Statement date')
    expect(html).not.toContain('Annual membership')
    expect(html).toContain('API Beneficiary')
    expect(html).toContain('>Beneficiary</span>')
    expect(html).toContain('API Bank')
    expect(html).toContain('00123456789')
    expect(html).toContain('021000021')
    expect(html).not.toContain('IBAN')
    expect(html).toContain('SWIFT transfer to')
    expect(html).not.toContain('Pontech Group L.L.C-FZ')
  })

  test('shows real bank details with only the statement notice and no ACH/Wire prompt', () => {
    const html = renderToStaticMarkup(<PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={cryptoDeposits} bankDeposits={bankDeposits} details={mockPaymentDetails} />)
    expect(html).toContain('Make a payment')
    expect(html).toContain('USD 499.88')
    expect(html).not.toContain('ACH')
    expect(html).not.toContain('WIRE')
    expect(html).toContain('API Beneficiary')
    expect(html).toContain('This amount covers your total unpaid balance')
    expect(html).not.toContain('Charges begin three working days after the due date')
    expect(html).not.toContain('Always include the reference')
    expect(html.match(/<aside /g)).toHaveLength(1)
    expect(html).not.toContain('Send from a bank account in your own name.')
    expect(html).not.toContain('Pontech Group')
  })

  test.each([false, true])('hides ACH when ready Wire exists regardless of response order (%s)', (wireFirst) => {
    const ach = bankDeposits.deposits[0]!
    const wire: BankDeposit = {
      ...ach, id: 'iron-wire',
      instructions: {
        ...ach.instructions!, paymentRail: 'wire' as const,
        beneficiaryName: 'API Beneficiary',
        accountNumber: 'WIRE-ACCOUNT', routingNumber: '021000021',
      },
    }
    const html = renderToStaticMarkup(<PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={cryptoDeposits} details={mockPaymentDetails}
      bankDeposits={{ status: 'ready', deposits: wireFirst ? [wire, ach] : [ach, wire] }} />)

    expect(html).toContain('WIRE-ACCOUNT')
    expect(html).not.toContain('00123456789')
    expect(html.match(/data-size="chip"/g)).toHaveLength(2)
    expect(html).toContain('grid-cols-[minmax(54px,auto)_minmax(0,1fr)_auto]')
    expect(html).toContain('bg-notice-background')
    expect(html).toMatch(/<a[^>]*href="https:\/\/wa\.me\/971554570290" target="_blank" rel="noopener noreferrer"[^>]*>Message concierge<\/a>/)
  })

  test.each([false, true])('prioritizes SWIFT over Wire and ACH and hides null fields (%s)', (swiftFirst) => {
    const ach = bankDeposits.deposits[0]!
    const wire: BankDeposit = {
      ...ach, id: 'iron-wire',
      instructions: {
        ...ach.instructions!, paymentRail: 'wire' as const,
        beneficiaryName: 'API Beneficiary',
        accountNumber: 'WIRE-ACCOUNT', routingNumber: '021000021',
      },
    }
    const swift: BankDeposit = {
      ...ach, id: 'iron-swift', sourceCurrency: null, acceptsThirdPartyDeposits: true,
      instructions: {
        paymentRail: 'swift' as const,
        beneficiaryName: 'Igor Private',
        beneficiaryAddress: '100 Iron Way, Financial District, NY 10001',
        bankName: 'Iron Bank',
        bankAddress: '123 Financial Plaza, New York, NY 10004',
        accountNumber: '8848841589',
        iban: null,
        bic: 'IRONUS33XXX',
        reference: null,
      },
    }
    const deposits = swiftFirst ? [swift, wire, ach] : [ach, wire, swift]
    const html = renderToStaticMarkup(<PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={cryptoDeposits} details={mockPaymentDetails}
      bankDeposits={{ status: 'ready', deposits }} />)

    expect(html).toContain('Igor Private')
    expect(html).toContain('IRONUS33XXX')
    expect(html).toContain('100 Iron Way, Financial District, NY 10001')
    expect(html).toContain('123 Financial Plaza, New York, NY 10004')
    expect(html).toContain('8848841589')
    expect(html).not.toContain('WIRE-ACCOUNT')
    expect(html).not.toContain('00123456789')
    expect(html).not.toContain('>IBAN</span>')
    expect(html).toContain('>SWIFT / BIC</span>')
    expect(html).not.toContain('>Reference</span>')
    expect(html).not.toContain('>Currency</span>')
    expect(html).not.toContain('>—</span>')
    expect(html.match(/data-bank-row=/g)).toHaveLength(6)
  })

  test('hides null EUR requisites while preserving an explicitly empty reference', () => {
    const html = renderToStaticMarkup(<PaymentScreen details={mockPaymentDetails}
      bankDeposits={{ status: 'loading', deposits: [] }} cryptoDeposits={cryptoDeposits}
      eurDeposits={{ status: 'ready', deposits: [{
        ...readyEurDeposits.deposits[0]!,
        instructions: {
          paymentRail: 'sepa', beneficiaryName: 'EUR Beneficiary', iban: 'DE89370400440532013000',
          beneficiaryAddress: null, bankName: null, bankAddress: null, bic: null, reference: '',
        },
      }] }} />)
    const labels = [...html.matchAll(/data-bank-row="([^"]+)"/g)].map((match) => match[1])
    expect(labels).toEqual(['Beneficiary', 'IBAN', 'Reference', 'Currency'])
    expect(html).toContain('EUR Beneficiary')
    expect(html).toContain('DE89370400440532013000')
    expect(html.match(/>—<\/span>/g)).toHaveLength(1)
  })

  test.each([
    ['es', 'Referencia'],
    ['fr', 'Référence'],
    ['ru', 'Назначение'],
  ] as const)('localizes SWIFT detail labels in %s', (language, referenceLabel) => {
    const swift: BankDeposit = {
      ...bankDeposits.deposits[0]!,
      instructions: {
        paymentRail: 'swift' as const,
        beneficiaryName: 'API Beneficiary',
        beneficiaryAddress: null,
        bankName: 'API Bank',
        bankAddress: null,
        accountNumber: '00123456789',
        iban: 'AE070331234567890123456',
        bic: 'EBILEAD',
        reference: 'XP-4417-8825',
      },
    }
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={createAppI18n(language)}>
        <PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={cryptoDeposits} details={mockPaymentDetails}
          bankDeposits={{ status: 'ready', deposits: [swift] }} />
      </I18nextProvider>,
    )

    expect(html).toContain(`>${referenceLabel}</span>`)
    expect(html).toContain('>SWIFT / BIC</span>')
    expect(html).toContain('AE070331234567890123456')
    expect(html).toContain('EBILEAD')
  })

  test('keeps ACH when Wire is not ready', () => {
    const ach = bankDeposits.deposits[0]!
    const wire: BankDeposit = {
      ...ach, id: 'iron-wire',
      instructions: {
        ...ach.instructions!, paymentRail: 'wire' as const,
        beneficiaryName: 'API Beneficiary',
        accountNumber: 'WIRE-ACCOUNT', routingNumber: '021000021',
      },
    }
    const html = renderToStaticMarkup(<PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={cryptoDeposits} details={mockPaymentDetails}
      bankDeposits={{ status: 'ready', deposits: [{ ...wire, status: 'Authorized' }, ach] }} />)

    expect(html).toContain('00123456789')
    expect(html).not.toContain('WIRE-ACCOUNT')
    expect(html.match(/data-size="chip"/g)).toHaveLength(2)
  })

  test('replaces the skeleton with a concierge message when the wait expires', () => {
    const html = renderToStaticMarkup(<PaymentScreen eurDeposits={{ status: 'timed-out', deposits: [] }} cryptoDeposits={{ status: 'timed-out', details: null }} details={mockPaymentDetails}
      bankDeposits={{ status: 'timed-out', deposits: [] }} />)
    expect(html).toContain('Payment details are taking longer than expected')
    expect(html).toContain('Please message concierge for help with your account details.')
    expect(html).toMatch(/<a[^>]*href="https:\/\/wa\.me\/971554570290" target="_blank" rel="noopener noreferrer"[^>]*>Message concierge<\/a>/)
    expect(html).not.toContain('animate-pulse')
    expect(html).not.toContain('Copy payment detail')
    expect(html).not.toContain('API Beneficiary')
    expect(html).not.toContain('Try again')
  })

  test('shows the bank-shaped skeleton while waiting without demo payment instructions', () => {
    const html = renderToStaticMarkup(<PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={{ status: 'loading', details: null }} details={mockPaymentDetails}
      bankDeposits={{ status: 'loading', deposits: [] }} />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('animate-pulse rounded-md bg-border')
    expect(html.match(/data-bank-row=/g)).toHaveLength(7)
    expect(html).not.toContain('notreal')
    expect(html).not.toContain('Please message concierge')
    expect(html).not.toContain('Try again')
    expect(html).not.toContain('Unable to load bank details')
  })

  test('shows non-empty plan adjustments expanded by default', () => {
    const html = renderToStaticMarkup(
      <PaymentScreen eurDeposits={eurDeposits}
        cryptoDeposits={cryptoDeposits}
        bankDeposits={bankDeposits}
        details={mockPaymentDetails}
        planAdjustments={[planAdjustment]}
      />,
    )

    expect(html).toContain('Lower this statement by USD 2,324.07')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Emirates Airlines')
  })

  test('keeps the original payment summary when no plan adjustments exist', () => {
    const html = renderToStaticMarkup(
      <PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={cryptoDeposits} bankDeposits={bankDeposits} details={mockPaymentDetails} planAdjustments={[]} />,
    )

    expect(html).toContain('Statement balance')
    expect(html).toContain('Statement date')
    expect(html).not.toContain('Lower this statement')
  })

  test('renders the selected payment method as the filled chip', () => {
    const html = renderToStaticMarkup(
      <PaymentMethodTabs activeMethod="usdc" availableMethods={['usd', 'eur', 'usdc']} onSelect={() => undefined} />,
    )

    expect(html).toMatch(
      /<button[^>]*data-variant="default" data-size="chip" data-text-style="body"[^>]*aria-pressed="true"[^>]*>.*USDC.*<\/button>/,
    )
  })

  test('uses the compact Figma controls without fixed heights', () => {
    const html = renderToStaticMarkup(<PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={cryptoDeposits} bankDeposits={bankDeposits} details={mockPaymentDetails} />)

    expect(html).toMatch(
      /data-size="compact" data-text-style="body"[^>]*aria-label="Copy payment detail"/,
    )
    expect(html).toMatch(
      /data-size="back" data-text-style="body"[^>]*>.*Account<\/button>/,
    )
    expect(html).not.toMatch(/<button[^>]*class="[^"]*\bh-\[/)
  })

  test('lets the back icon follow the account link hover color', () => {
    const html = renderToStaticMarkup(<PaymentScreen eurDeposits={eurDeposits} cryptoDeposits={cryptoDeposits} bankDeposits={bankDeposits} details={mockPaymentDetails} />)
    const backButton = html.match(
      /<button[^>]*data-size="back"[^>]*>.*?Account<\/button>/,
    )?.[0]

    expect(backButton).toContain('hover:text-primary')
    expect(backButton).not.toMatch(/<span[^>]*text-secondary/)
  })

  test('shows the provided wallet address with its matching QR image', () => {
    const html = renderToStaticMarkup(
      <CryptoPaymentDetails
        details={{
          address: 'YUR1ixaAo51xAQGe9QgdHQMg5xuDwWrWqFqR3Ri89UU',
          asset: 'USDC',
          network: 'ERC-20',
        }}
        qrCodeDataUrl="data:image/png;base64,qr-for-wallet"
        onCopy={() => undefined}
      />,
    )

    expect(html).toContain('YUR1ixaAo51xAQGe9QgdHQMg5xuDwWrWqFqR3Ri89UU')
    expect(html).toContain('src="data:image/png;base64,qr-for-wallet"')
    expect(html).toContain('alt="QR code for the USDC deposit address"')
    expect(html).toContain('Crypto transfer to')
    expect(html).not.toContain('Payment method')
    expect(html).toContain('bg-qr-background')
    expect(html).toContain(
      'Funds appear on your account once the network confirms and processing completes — within 24 hours.',
    )
  })
})


describe('CryptoDeposits', () => {
  test('shows a QR and address skeleton while waiting without a placeholder address or copy action', () => {
    const html = renderToStaticMarkup(<CryptoDeposits state={{ status: 'loading', details: null }} onCopy={() => undefined} />)
    expect(html).toContain('animate-pulse rounded-md bg-border')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Crypto transfer to')
    expect(html).toContain('ERC-20')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('notreal')
    expect(html).not.toContain('Please message concierge')
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Copy payment detail"/)
  })

  test('shows concierge guidance instead of QR and address after timeout', () => {
    const html = renderToStaticMarkup(<CryptoDeposits state={{ status: 'timed-out', details: null }} onCopy={() => undefined} />)
    expect(html).toContain('Payment details are taking longer than expected')
    expect(html).toContain('Please message concierge for help with your account details.')
    expect(html).not.toContain('animate-pulse')
    expect(html).not.toContain('<code')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('Copy payment detail')
  })

  test('shows only the API address when ready', () => {
    const html = renderToStaticMarkup(<CryptoDeposits state={cryptoDeposits} onCopy={() => undefined} />)
    expect(html).toContain(cryptoDeposits.details!.address)
    expect(html).toContain('Send USDC on ERC-20')
    expect(html).toContain('This amount covers your total unpaid balance across all periods.')
    expect(html).not.toContain('This address is unique to your account')
    expect(html).not.toContain('notreal')
    expect(html).not.toContain('Solana')
  })
})
