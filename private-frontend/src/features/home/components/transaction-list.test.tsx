import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import {
  TransactionList,
  TransactionListSkeleton,
  type Transaction,
} from './transaction-list'

const transaction: Transaction = {
  id: 'bulgari',
  source: 'card',
  type: 'card',
  isCredit: false,
  merchant: 'Bulgari Hotel',
  details: '12 Aug · 14:22 · Dubai, AE',
  amount: 'USD 2,840',
  amountCents: 284000,
  currency: 'USD',
  state: 'completed',
  category: 'Travel',
  date: '13 August, 09:41',
  location: 'Dubai, AE',
  declineReasonCategory: null,
  card: 'Virtual · •••• 4417',
  rate: '1 USD = 3.6507 AED',
}

describe('TransactionList', () => {
  test('renders the requested number of transaction skeleton rows', () => {
    const html = renderToStaticMarkup(<TransactionListSkeleton rows={3} />)

    expect(html).toContain('aria-label="Loading transactions"')
    expect(html.match(/data-transaction-skeleton="true"/g)).toHaveLength(3)
    expect(html).toContain('rounded-md')
    expect(html).not.toContain('rounded-none')
    expect(html).not.toContain('border-b border-border')
    expect(html).toContain('items-center justify-between gap-3 py-4')
    expect(html).toContain('h-5 w-32 max-w-full')
    expect(html).toContain('h-4 w-24 max-w-full')
    expect(html).toContain('h-5 w-20 max-w-full')
    expect(html).toContain('h-4 w-16 max-w-full')
    expect(html).not.toContain('h-[15px]')
    expect(html).not.toContain('h-[11px]')
  })

  test('renders transaction rows with semantic separators', () => {
    const html = renderToStaticMarkup(
      <TransactionList
        transactions={[transaction, { ...transaction, id: 'zuma', merchant: 'Zuma' }]}
      />,
    )

    expect(html).toContain('border-b border-border')
    expect(html).toContain('last:border-b-0')
  })

  test('renders populated transactions as accessible buttons', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[transaction]} onSelect={() => undefined} />,
    )

    expect(html).toContain('aria-label="Open Bulgari Hotel transaction details"')
    expect(html).toContain('<button')
  })

  test('shows N/A when the merchant name is missing', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[{ ...transaction, merchant: null }]} />,
    )

    expect(html).toContain('>N/A</span>')
    expect(html).toContain('aria-label="Open N/A transaction details"')
  })

  test('renders unknown types alongside known rows, using the backend name or type', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[
        transaction,
        { ...transaction, id: 'physical', type: 'physical_card', merchant: 'Physical Card' },
        { ...transaction, id: 'future', type: 'future_type', merchant: null },
      ]} />,
    )

    expect(html.match(/<button/g)).toHaveLength(3)
    expect(html).toContain('>Bulgari Hotel</span>')
    expect(html).toContain('>Physical Card</span>')
    expect(html).toContain('>future_type</span>')
    expect(html).toContain('aria-label="Open future_type transaction details"')
  })

  test('keeps merchant descenders visible without assigning a row height', () => {
    const html = renderToStaticMarkup(<TransactionList transactions={[transaction]} />)
    const merchantClasses = html.match(
      /<span class="([^"]+)">Bulgari Hotel<\/span>/,
    )?.[1]
    const detailsClasses = html.match(
      /<span class="([^"]+)">12 Aug · 14:22 · Dubai, AE<\/span>/,
    )?.[1]

    expect(merchantClasses).toContain('leading-5')
    expect(merchantClasses).not.toContain('leading-none')
    expect(detailsClasses).toContain('leading-4')
    expect(html).not.toMatch(/\b(?:h|min-h)-\[/)
  })

  test('shows full-bleed press feedback while preserving the scale effect', () => {
    const html = renderToStaticMarkup(<TransactionList transactions={[transaction]} />)
    const buttonClasses = html.match(/<button[^>]*class="([^"]+)"/)?.[1]

    expect(buttonClasses).toContain('active:bg-primary/4')
    expect(buttonClasses).toContain('-mx-4')
    expect(buttonClasses).toContain('w-[calc(100%+2rem)]')
    expect(buttonClasses).toContain('px-4')
    expect(buttonClasses).toContain('border-0')
    expect(buttonClasses).toContain('tracking-normal')
    expect(html).toContain('group-active:scale-[0.97]')
    expect(html).not.toContain('100vw')
  })

  test('keeps the amount column readable when the row narrows to 320 pixels', () => {
    const html = renderToStaticMarkup(
      <TransactionList
        canPayOverTime={() => true}
        transactions={[{ ...transaction, merchant: 'Zuma', amount: 'USD 1,499.88' }]}
      />,
    )

    expect(html).toContain('flex min-w-0 flex-1 flex-col gap-1 font-light')
    expect(html).toContain('max-w-[55%] shrink-0 flex-col items-end')
  })

  test('centres a single reversed amount against two-line merchant details', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[{ ...transaction, state: 'reversed' }]} />,
    )

    expect(html).toContain(
      'flex w-full min-w-0 items-center justify-between gap-3',
    )
    expect(html).not.toContain(
      'flex w-full min-w-0 items-start justify-between gap-3',
    )
  })
})
