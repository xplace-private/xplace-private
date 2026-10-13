import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { I18nextProvider } from 'react-i18next'

import type { GatewayResult } from '../../shared/api/gateway-result'
import { createAppI18n } from '../../shared/i18n/app-i18n'
import { PaymentPlanStartModal } from './components/payment-plan-start-modal'
import { HomeScreen } from './home-screen'
import type { HomeCard } from './model/card-collection'
import type { PaymentPlan, StartPaymentPlanInput } from './model/payment-plan'
import { recentTransactions } from './transaction-data'

const activePlan: PaymentPlan = {
  id: 'plan-emirates',
  transactionId: recentTransactions[0]!.id,
  merchant: recentTransactions[0]!.merchant ?? 'N/A',
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

const startPlan: (
  input: StartPaymentPlanInput,
) => Promise<GatewayResult<PaymentPlan>> = () => Promise.resolve({ ok: true, data: activePlan })

const backendCard: HomeCard = {
  id: '17',
  backendId: '2a79418b-c5f3-4f9f-8ad8-202236b8c43e',
  name: 'Virtual card',
  kind: 'Virtual',
  lastFour: '7391',
  status: 'Active',
  hasPin: true,
  details: null,
}

const privateBalance = {
  availableToSpendCents: 950022,
  spentThisPeriodCents: 49988,
  dueThisPeriodCents: 49988,
  dueDate: '2026-09-05',
  overdue: [],
} as const

function transactionButton(html: string, merchant: string): string {
  const button = html.match(
    new RegExp(`<button[^>]*aria-label="Open ${merchant} transaction details"[\\s\\S]*?</button>`),
  )?.[0]
  if (!button) throw new Error(`${merchant} transaction button was not rendered`)
  return button
}

describe('HomeScreen', () => {
  test('renders backend cards instead of the former starter mock', () => {
    const cards: readonly HomeCard[] = [
      {
        id: '17',
        backendId: '2a79418b-c5f3-4f9f-8ad8-202236b8c43e',
        name: 'Physical card',
        kind: 'Physical',
        lastFour: '7391',
        status: 'Frozen',
        hasPin: true,
        details: null,
      },
    ]

    const html = renderToStaticMarkup(<HomeScreen cards={cards} />)

    expect(html).toContain('Physical card · •••• 7391')
    expect(html).not.toContain('Virtual card · •••• 4417')
    expect(html).not.toContain('Show card details')
  })

  test('renders an unavailable last-four value for an active card without inventing digits', () => {
    const cards: readonly HomeCard[] = [
      {
        id: '18',
        backendId: '6e5a7416-40e5-4f53-978d-3327bc59261f',
        name: 'Physical card',
        kind: 'Physical',
        lastFour: null,
        status: 'Active',
        hasPin: false,
        details: null,
      },
    ]

    const html = renderToStaticMarkup(<HomeScreen cards={cards} />)

    expect(html).toContain('Physical card · Not available')
    expect(html).not.toContain('•••• 0000')
  })

  test('shows a safe cards error with a retry action and no starter mock', () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        cards={[]}
        cardsError="Unable to load cards. Try again."
        onRetryCards={() => undefined}
      />,
    )

    expect(html).toContain('Unable to load cards. Try again.')
    expect(html).toContain('>Try again</button>')
    expect(html).not.toContain('Virtual card · •••• 4417')
  })

  test('renders the Figma zero state when there are no transactions', () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        balance={privateBalance}
        cards={[backendCard]}
        transactions={[]}
      />,
    )

    expect(html).toContain('USD 9,500.22')
    expect(html).toContain('No activity. Start spending to view')
    expect(html).toContain('Virtual card · •••• 7391')
    expect(html).toContain('Need something?')
    expect(html).toContain('Sign out')
  })

  test('replaces only Activity with five transaction skeletons while it loads', () => {
    const html = renderToStaticMarkup(
      <HomeScreen cards={[backendCard]} transactions={[]} transactionsLoading />,
    )

    expect(html).toContain('Activity')
    expect(html.match(/data-transaction-skeleton="true"/g)).toHaveLength(5)
    expect(html).not.toContain('No activity. Start spending to view')
    expect(html).toContain('Virtual card · •••• 7391')
  })

  test('shows a safe transaction error and retry without hiding the rest of Home', () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        cards={[backendCard]}
        transactions={[]}
        transactionsError="Unable to load transactions. Try again."
        onRetryTransactions={() => undefined}
      />,
    )

    expect(html).toContain('Unable to load transactions. Try again.')
    expect(html).toContain('>Try again</button>')
    expect(html).not.toContain('No activity. Start spending to view')
    expect(html).toContain('Need something?')
  })

  test('renders the populated activity and pay-now state from Figma', () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        balance={privateBalance}
        cards={[backendCard]}
      />,
    )

    expect(html).toContain('Pay now')
    expect(html).toContain('aria-label="Make a payment"')
    expect(html).toContain('USD 9,500.22')
    expect(html).toContain('USD 499.88')
    expect(html).toContain('Emirates Airlines')
    expect(html).toContain('AED 10,368')
    expect(html).toContain('The Ned')
    expect(html).not.toContain('No activity. Start spending to view')
  })

  test('formats balance money and dates with the active locale', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={createAppI18n('fr')}>
        <HomeScreen
          balance={{ ...privateBalance, dueThisPeriodCents: 12345 }}
          cards={[backendCard]}
        />
      </I18nextProvider>,
    )

    expect(html).toContain('USD 9 500,22')
    expect(html.match(/USD 123,45/g)).toHaveLength(2)
    expect(html).not.toContain('USD 499,88')
    expect(html).toContain('5 sept.')
  })

  test.each([
    { name: 'current debt only', dueThisPeriodCents: 1, overdue: [], visible: true, expectedAmount: 'USD 0.01' },
    { name: 'overdue debt only', dueThisPeriodCents: 0, overdue: [{ dueDate: '2026-08-05', amountCents: 12540, closed: false }], visible: true, expectedAmount: 'USD 0.00' },
    { name: 'both debts', dueThisPeriodCents: 49988, overdue: [{ dueDate: '2026-08-05', amountCents: 12540, closed: false }], visible: true, expectedAmount: 'USD 499.88' },
    { name: 'no debt despite period spending', dueThisPeriodCents: 0, overdue: [], visible: false, expectedAmount: 'USD 0.00' },
    { name: 'zero overdue amount', dueThisPeriodCents: 0, overdue: [{ dueDate: '2026-08-05', amountCents: 0, closed: false }], visible: false, expectedAmount: 'USD 0.00' },
  ])('shows Pay now according to $name', ({ dueThisPeriodCents, overdue, visible, expectedAmount }) => {
    const html = renderToStaticMarkup(
      <HomeScreen balance={{ ...privateBalance, dueThisPeriodCents, overdue }} cards={[backendCard]} />,
    )

    expect(html.includes('aria-label="Make a payment"')).toBe(visible)
    expect(html.includes('Pay now')).toBe(visible)
    expect(html.split(expectedAmount)).toHaveLength(3)
    expect(html).toContain('5 Sep')
    expect(html).toContain('Virtual card · •••• 7391')
    expect(html).toContain('Activity')
  })

  test('hides Pay now when balance is unavailable', () => {
    const html = renderToStaticMarkup(<HomeScreen />)

    expect(html).not.toContain('aria-label="Make a payment"')
    expect(html).not.toContain('Pay now')
  })

  test('uses the backend due date as the statement countdown date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-13T12:00:00Z'))

    try {
      const html = renderToStaticMarkup(<HomeScreen balance={privateBalance} />)
      expect(html).toContain('<p>23 days</p>')
    } finally {
      vi.useRealTimers()
    }
  })

  test('shows Today when the statement is issued today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'))

    try {
      const html = renderToStaticMarkup(<HomeScreen balance={privateBalance} />)
      expect(html).toContain('<p>Today</p>')
    } finally {
      vi.useRealTimers()
    }
  })

  test('shows a safe balance error without inventing values', () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        balanceError="Unable to load balance. Try again."
        onRetryBalance={() => undefined}
      />,
    )

    expect(html).toContain('Unable to load balance. Try again.')
    expect(html).toContain('>Try again</button>')
    expect(html).toContain('Not available')
    expect(html).not.toContain('USD 9,500.22')
    expect(html).not.toContain('aria-label="Make a payment"')
  })

  test('truncates the pay-now label inside the stat panel', () => {
    const html = renderToStaticMarkup(<HomeScreen balance={privateBalance} />)
    const paymentAction = html.match(
      /<div class="([^"]+)"><button[^>]*aria-label="Make a payment"[^>]*>[\s\S]*?<\/button><\/div>/,
    )

    expect(paymentAction?.[1]).toContain('min-w-0')
    expect(paymentAction?.[0]).toContain(
      '<span class="min-w-0 truncate">Pay now</span>',
    )
  })

  test('shows reversed transaction amounts struck through', () => {
    const html = renderToStaticMarkup(<HomeScreen />)
    const reversedAmountClasses = html.match(
      /<span class="([^"]+)"[^>]*>USD 2,000\.00<\/span>/,
    )?.[1]

    expect(reversedAmountClasses).toContain('line-through')
    expect(reversedAmountClasses).toContain('text-muted')
  })

  test('renders compact activity rows with semantic separators', () => {
    const harrods = recentTransactions[3]!
    const html = renderToStaticMarkup(<HomeScreen transactions={[harrods]} />)

    expect(html).toMatch(
      /<li class="[^"]*border-b border-border[^"]*"><button[^>]*aria-label="Open Harrods transaction details"/,
    )
  })

  test('uses padding for the Figma button sizes without changing the card aspect ratio', () => {
    const html = renderToStaticMarkup(<HomeScreen balance={privateBalance} cards={[backendCard]} />)

    expect(html).toMatch(
      /data-variant="default" data-size="md" data-text-style="strong"[^>]*aria-label="Make a payment"/,
    )
    expect(html).toContain('aspect-[343/216]')
  })

  test('uses the Figma Home button variants without local styling overrides', () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        cards={[
          {
            ...backendCard,
            details: { number: '4917', expires: '09/29', securityCode: '318' },
          },
        ]}
      />,
    )

    expect(html).toMatch(
      /class="[^"]*bg-primary-foreground[^"]*"[^>]*aria-label="Show card details"/,
    )
    expect(html).toMatch(
      /data-size="default" data-text-style="body-light"[^>]*>.*Freeze.*<\/button>/,
    )
    expect(html).toContain('border-border bg-card')
    expect(html).toMatch(
      /data-size="compact" data-text-style="body"[^>]*>View all<\/button>/,
    )
  })

  test('centres divider lines between adjacent home sections', () => {
    const html = renderToStaticMarkup(<HomeScreen />)

    expect(html.match(/class="relative py-4"/g)).toHaveLength(3)
    expect(html).toContain('absolute inset-x-0 top-1/2 border-t border-border')
  })

  test('matches the 48 pixel Figma sign-out size with padding', () => {
    const html = renderToStaticMarkup(<HomeScreen />)

    expect(html).toMatch(
      /data-variant="outline" data-size="lg" data-text-style="regular"[^>]*>Sign out<\/button>/,
    )
  })

  test.each(['Message concierge', 'Limit review'])('opens %s in a new tab with the existing button styling', (label) => {
    const html = renderToStaticMarkup(<HomeScreen />)
    const link = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g)?.find((anchor) => anchor.includes(`>${label}</span>`))

    expect(link).toContain('href="https://wa.me/971554570290"')
    expect(link).toContain('target="_blank"')
    expect(link).toContain('rel="noopener noreferrer"')
    expect(link).toContain('data-size="support" data-text-style="body-light"')
    expect(link).toContain('flex-1')
    expect(link).not.toContain('disabled=""')
  })

  test('uses the Figma information icon beside the due date label', () => {
    const html = renderToStaticMarkup(<HomeScreen />)

    expect(html).toContain('/assets/home/info.svg')
    expect(html).toContain('aria-label="About due date"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Due date ⓘ')
  })

  test('gives text-only stat labels the same height as the due-date icon row', () => {
    const html = renderToStaticMarkup(<HomeScreen />)
    const availableLabelClasses = html.match(
      /<span class="([^"]+)">Available to spend<\/span>/,
    )?.[1]
    const dueDateLabelClasses = html.match(
      /<span class="([^"]+)"><span>Due date<\/span>/,
    )?.[1]

    expect(availableLabelClasses).toContain('leading-[14px]')
    expect(dueDateLabelClasses).toContain('leading-[14px]')
  })

  test('aligns both stat-card primary areas on shared grid rows', () => {
    const html = renderToStaticMarkup(<HomeScreen />)

    expect(html).toContain('grid-cols-2')
    expect(html.match(/grid-rows-subgrid/g)).toHaveLength(2)
  })

  test('surfaces pay-over-time eligibility only for qualifying activity', () => {
    const html = renderToStaticMarkup(<HomeScreen startPlan={startPlan} />)

    expect(html.match(/Pay over time/g)).toHaveLength(2)
    expect(transactionButton(html, 'Emirates Airlines')).toContain('Pay over time')
    expect(transactionButton(html, 'Harrods')).not.toContain('Pay over time')
  })

  test('renders an active plan badge and monthly activity amount', () => {
    const html = renderToStaticMarkup(<HomeScreen plans={[activePlan]} startPlan={startPlan} />)
    const planRow = transactionButton(html, 'Emirates Airlines')

    expect(planRow).toContain('>PLAN<')
    expect(planRow).toContain('USD 515.93/mo')
    expect(planRow).toContain('line-through')
    expect(planRow).not.toContain('reversed')
    expect(planRow).not.toContain('Pay over time')
    expect(html).toContain('USD 515.93/mo')
    expect(html).toContain('Payment plans')
    expect(html.indexOf('Payment plans')).toBeGreaterThan(html.indexOf('Activity'))
    expect(html.indexOf('Payment plans')).toBeLessThan(html.indexOf('Your cards'))
  })

  test('omits the payment-plans section when there are no active plans', () => {
    const html = renderToStaticMarkup(<HomeScreen />)

    expect(html).not.toContain('Payment plans')
  })

  test('surfaces a safe initial payment-plan load failure near activity', () => {
    const html = renderToStaticMarkup(
      <HomeScreen paymentPlansError="Unable to load payment plans. Try again." />,
    )

    expect(html).toContain('Payment plans are unavailable. Try again.')
    expect(html.indexOf('Payment plans are unavailable')).toBeGreaterThan(
      html.indexOf('Activity'),
    )
  })

  test('renders the default six-month plan quote from numeric transaction data', () => {
    const html = renderToStaticMarkup(
      <PaymentPlanStartModal
        transaction={recentTransactions[0]!}
        isSubmitting={false}
        onClose={() => undefined}
        onStart={() => undefined}
      />,
    )
    const selectedPlanButton = html.match(
      /<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?<\/button>/,
    )?.[0]

    expect(html).toContain('3 months')
    expect(html).toContain('6 months')
    expect(html).toContain('9 months')
    expect(selectedPlanButton).toContain('border-accent')
    expect(selectedPlanButton).toContain('bg-card')
    expect(selectedPlanButton).toContain('hover:border-accent')
    expect(selectedPlanButton).toContain('hover:bg-card')
    expect(selectedPlanButton).toContain('hover:text-foreground')
    expect(selectedPlanButton).not.toContain('hover:bg-accent-foreground')
    expect(selectedPlanButton).toMatch(/text-accent[^>]*>6 months/)
    expect(html).toContain('18.0% APR fixed')
    expect(html).toContain('USD 255.60')
    expect(html).toContain('USD 3,095.60')
    expect(html).toContain('Start plan — USD 515.93/mo')

    const threeMonthSummaryClasses = html.match(
      /<span class="([^"]+)">USD 2,967\.80 total · USD 127\.80 cost<\/span>/,
    )?.[1]
    expect(threeMonthSummaryClasses).toContain('whitespace-normal')
    expect(threeMonthSummaryClasses).not.toContain('truncate')
  })
})
