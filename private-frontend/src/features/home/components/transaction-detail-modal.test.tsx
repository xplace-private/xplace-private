import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, test } from 'vitest'

import { createAppI18n } from '../../../shared/i18n/app-i18n'
import type { TransactionState } from '../model/transaction'
import type { PaymentPlan } from '../model/payment-plan'
import { TransactionDetailModal } from './transaction-detail-modal'

const baseTransaction = {
  id: 'transaction',
  source: 'card',
  type: 'card',
  isCredit: false,
  merchant: 'Emirates Airlines',
  details: '13 Aug · 09:41 · Dubai, AE',
  amount: 'USD 2,840',
  amountCents: 284000,
  currency: 'USD',
  convertedAmount: 'AED 10,368',
  category: 'Travel',
  date: '13 August, 09:41',
  location: 'Dubai, AE',
  card: 'Virtual · •••• 4417',
  rate: '1 USD = 3.6507 AED',
  declineReasonCategory: null,
} as const

const stateContent = [
  ['completed', 'Completed', undefined],
  ['pending', 'Pending', undefined],
  ['refunded', 'Refunded', 'Refunded by the merchant.'],
  ['declined', 'Declined', undefined],
  ['reversed', 'Reversed', 'Pre-authorisation released by the merchant.'],
] as const satisfies readonly (readonly [TransactionState, string, string | undefined])[]

const activePlan: PaymentPlan = {
  id: 'plan-emirates',
  transactionId: baseTransaction.id,
  merchant: baseTransaction.merchant,
  currency: 'USD',
  principalCents: 284000,
  termMonths: 6,
  aprBasisPoints: 1800,
  feeCents: 25560,
  totalRepayableCents: 309560,
  monthlyPaymentCents: 51593,
  paidInstallments: 0,
  startedAt: '2026-08-19T00:00:00.000Z',
}

const topUpTransaction = {
  id: 'top_up:17',
  source: 'ledger',
  type: 'top_up',
  isCredit: true,
  merchant: 'Payment received',
  details: '13 Aug · 09:41',
  amount: 'USD 3,204.10',
  amountCents: 320410,
  currency: 'USD',
  state: 'completed',
  category: null,
  date: '13 August, 09:41',
  location: null,
  card: null,
  rate: null,
  declineReasonCategory: null,
} as const

describe('TransactionDetailModal', () => {
  test.each([
    ['physical_card', 'Physical Card'],
    ['future_type', null],
  ])('shows only the date field and close action for %s', (type, merchant) => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, type, merchant, state: 'completed' }}
        canPayOverTime
        onPayOverTime={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain(`>${merchant ?? type}</h2>`)
    expect(html).toContain('>USD 2,840</strong>')
    expect(html).toContain('>Completed</span>')
    expect(html).toContain('>Date</span>')
    expect(html).toContain('>13 August, 09:41</span>')
    for (const label of ['Category', 'Location', 'Card', 'Rate', 'Plan']) {
      expect(html).not.toContain(`>${label}</span>`)
    }
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('>Close</button>')
    expect(html).not.toContain('>Dispute</a>')
  })

  test.each(['processing', '__proto__', 'constructor', 'toString', '<new_status>'])(
    'renders unfamiliar status %s as neutral text without a translation key or message',
    (state) => {
      const html = renderToStaticMarkup(
        <TransactionDetailModal
          transaction={{ ...baseTransaction, state }}
          onClose={() => undefined}
        />,
      )

      const escapedState = state.replace('<', '&lt;').replace('>', '&gt;')
      expect(html).toContain(`border-border text-secondary">${escapedState}</span>`)
      expect(html).not.toContain('transactions.status.')
      expect(html).not.toContain('<p')
      expect(html).toContain('>Travel</span>')
    },
  )

  test('renders the focused Payment received design for top-ups', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={topUpTransaction}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('>Payment received</h2>')
    expect(html).toContain('>−USD 3,204.10</strong>')
    expect(html).toContain('>Category</span>')
    expect(html).toContain('>Payment</span>')
    expect(html).toContain('>Date</span>')
    expect(html).not.toContain('>Location</span>')
    expect(html).not.toContain('>Card</span>')
    expect(html).not.toContain('>Rate</span>')
    expect(html).not.toContain('>Dispute</a>')
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('>Close</button>')
  })

  test('omits an unavailable location without showing a placeholder', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, state: 'completed', merchant: null, category: null, date: null, location: null, card: null, rate: null }}
        onClose={() => undefined}
      />,
    )

    expect(html.match(/>N\/A<\/span>/g)).toHaveLength(3)
    expect(html).toContain('>N/A</h2>')
    expect(html).toContain('Category')
    expect(html).not.toContain('Location')
    expect(html).not.toContain('>Rate<')
    expect(html).toContain('>Card<')
    expect(html).not.toContain('data-detail-skeleton')
  })

  test.each([
    ['insufficient_funds', 'Insufficient funds'],
    ['limits', 'Limits Exceeded'],
    ['blocked_merchant', 'Blocked merchant'],
    ['incorrect_card_data', 'Please check card details and try again'],
    ['try_again', 'Please try again in a moment'],
  ] as const)('localizes the %s decline category', (declineReasonCategory, expected) => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, state: 'declined', declineReasonCategory }}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain(expected)
  })

  test.each([
    ['es', 'Fondos insuficientes'],
    ['fr', 'Fonds insuffisants'],
    ['ru', 'Недостаточно средств'],
  ] as const)('renders the decline category in %s', (language, expected) => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={createAppI18n(language)}>
        <TransactionDetailModal
          transaction={{ ...baseTransaction, state: 'declined', declineReasonCategory: 'insufficient_funds' }}
          onClose={() => undefined}
        />
      </I18nextProvider>,
    )

    expect(html).toContain(expected)
  })

  test.each(stateContent)('renders the %s design state', (state, label, message) => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, state }}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain(`>${label}<`)
    expect(html).toContain('>Category<')
    expect(html).toContain('>Travel<')
    expect(html).toContain('>Rate<')
    expect(html).toContain('>1 USD = 3.6507 AED<')
    expect(html).toContain('>Close</button>')
    expect(html).toMatch(/<a href="https:\/\/wa\.me\/971554570290" target="_blank" rel="noopener noreferrer"[^>]*>Dispute<\/a>/)
    if (message) expect(html).toContain(message)
    else if (state === 'declined') expect(html).not.toContain('<p')
  })

  test('uses responsive bounds instead of fixed modal dimensions', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, state: 'completed' }}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('max-w-[400px]')
    expect(html).toContain('max-h-full')
    expect(html).not.toContain('w-[335px]')
    expect(html).not.toMatch(/\bh-\[\d+px\]/)
  })

  test('matches the reusable Figma transaction-detail typography and controls', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, state: 'completed' }}
        canPayOverTime
        onPayOverTime={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('text-base leading-7 font-light')
    expect(html).toContain('text-2xl leading-8 font-bold')
    expect(html).toContain('font-sans text-xs leading-5 font-light tracking-[1.6px]')
    expect(html).toContain('w-fit max-w-full border px-1.5 py-0.5 text-[8px] leading-3')
    expect(html).toContain('border-b border-border py-3 text-xs leading-5 font-light')
    expect(html).toContain('shrink-0 text-foreground')
    expect(html).toContain('min-w-0 text-right text-secondary')
    expect(html).toContain('border-positive text-positive')
    expect(html).toContain('flex min-w-0 gap-2')
    expect(html).toContain('data-size="md"')
  })

  test('uses the active-plan amount, status, and message treatment from Figma', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, state: 'pending' }}
        paymentPlan={activePlan}
        onClose={() => undefined}
      />,
    )

    const convertedAmountClasses = html.match(
      /<span class="([^"]+)">AED 10,368<\/span>/,
    )?.[1]

    expect(convertedAmountClasses).toContain('text-xs leading-5 font-light text-secondary')
    expect(convertedAmountClasses).not.toContain('font-sans')
    expect(convertedAmountClasses).not.toContain('uppercase')
    expect(html).toContain('border-warning/50 text-warning')
    expect(html).toContain('flex w-full flex-col items-center gap-4')
  })

  test('renders the eligible action before close and dispute', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, state: 'completed' }}
        canPayOverTime
        onPayOverTime={() => undefined}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('>Pay over time</button>')
    expect(html.indexOf('>Pay over time</button>')).toBeLessThan(html.indexOf('>Close</button>'))
  })

  test('renders active-plan terms and remaining status without another start action', () => {
    const html = renderToStaticMarkup(
      <TransactionDetailModal
        transaction={{ ...baseTransaction, state: 'completed' }}
        paymentPlan={activePlan}
        onClose={() => undefined}
      />,
    )

    expect(html).toContain('6 months · USD 515.93/mo')
    expect(html).toContain('USD 3,095.60 remaining')
    expect(html).not.toContain('>Pay over time</button>')
  })
})
