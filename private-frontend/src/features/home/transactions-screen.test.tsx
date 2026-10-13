import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import type { GatewayResult } from '../../shared/api/gateway-result'
import type { PaymentPlan, StartPaymentPlanInput } from './model/payment-plan'
import { recentTransactions } from './transaction-data'
import { PeriodTabs, TransactionsScreen } from './transactions-screen'
import { TransactionsSessionSkeleton } from './transactions-session-skeleton'

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

describe('TransactionsScreen', () => {
  test('renders the Figma period summary and full transaction list', () => {
    const html = renderToStaticMarkup(<TransactionsScreen />)

    expect(html).toContain('Spent')
    expect(html).toContain('USD 6,239')
    expect(html).toContain('12 transactions')
    expect(html).toContain('Late payment charge')
    expect(html).toContain('Emirates Airlines')
    expect(html).toContain('The Ned')
    expect(html).toContain('text-xs leading-5 font-light text-secondary')
    expect(html).toContain('text-base leading-4 font-bold')
  })

  test('renders backend summary and transaction props for the selected card', () => {
    const html = renderToStaticMarkup(
      <TransactionsScreen
        count={1}
        spent="USD 123.45"
        dueDate="5 Sep"
        transactions={[recentTransactions[0]!]}
      />,
    )

    expect(html).toContain('USD 123.45')
    expect(html).toContain('Due 5 Sep')
    expect(html).toContain('1 transaction')
    expect(html).toContain('Emirates Airlines')
    expect(html).not.toContain('Late payment charge')
  })

  test('shows N/A for summary fields absent from the private endpoint', () => {
    const html = renderToStaticMarkup(
      <TransactionsScreen count={1} spent="N/A" transactions={[recentTransactions[0]!]} />,
    )

    expect(html).toContain('>N/A</strong>')
    expect(html).toContain('Due N/A')
  })

  test('shows list and summary skeletons during the initial transaction request', () => {
    const html = renderToStaticMarkup(<TransactionsScreen transactionsLoading />)

    expect(html).toContain('aria-label="Loading transactions"')
    expect(html.match(/data-transaction-skeleton="true"/g)).toHaveLength(5)
    expect(html).toContain('rounded-md')
    expect(html).not.toContain('rounded-none')
    expect(html).not.toContain('Late payment charge')
    expect(html).toContain('h-5 w-10')
    expect(html).toContain('h-4 w-24')
    expect(html).toContain('h-5 w-16')
    expect(html).toContain('h-4 w-28')
  })

  test('keeps the pending route controls aligned with the loaded controls', () => {
    const html = renderToStaticMarkup(<TransactionsSessionSkeleton />)

    expect(html).toContain('leading-[13px]')
    expect(html).toContain('px-3.5 py-[8.5px]')
    expect(html).toContain('border-border bg-transparent text-secondary')
  })

  test('lets the back icon follow the account link hover color', () => {
    const html = renderToStaticMarkup(<TransactionsScreen />)
    const backButton = html.match(
      /<button[^>]*data-size="back"[^>]*>.*?Account<\/button>/,
    )?.[0]

    expect(backButton).toContain('hover:text-primary')
    expect(backButton).not.toMatch(/<span[^>]*text-secondary/)
  })

  test('keeps an initial failure distinct from a successful empty list', () => {
    const html = renderToStaticMarkup(
      <TransactionsScreen
        count={0}
        spent="N/A"
        transactions={[]}
        transactionsError="Unable to load transactions. Try again."
      />,
    )

    expect(html).toContain('Unable to load transactions. Try again.')
    expect(html).toContain('N/A')
    expect(html).not.toContain('0 transactions')
    expect(html).not.toContain('No activity. Start spending to view')
  })

  test('keeps loaded rows and shows three skeletons while the next page loads', () => {
    const html = renderToStaticMarkup(
      <TransactionsScreen
        hasNextPage
        isLoadingMore
        transactions={[recentTransactions[0]!]}
        onLoadMore={() => undefined}
      />,
    )

    expect(html).toContain('Emirates Airlines')
    expect(html.match(/data-transaction-skeleton="true"/g)).toHaveLength(3)
    expect(html).toContain('data-infinite-scroll="transactions"')
  })

  test('renders the selected period as the filled chip', () => {
    const html = renderToStaticMarkup(
      <PeriodTabs
        periods={[
          { year: 2026, month: 8 },
          { year: 2026, month: 7 },
          { year: 2026, month: 6 },
        ]}
        activePeriod={{ year: 2026, month: 7 }}
        currentPeriod={{ year: 2026, month: 8 }}
        onSelect={() => undefined}
      />,
    )
    expect(html).toMatch(
      /<button[^>]*data-variant="default"[^>]*aria-pressed="true"[^>]*>July 2026<\/button>/,
    )
  })

  test('reserves five transaction rows without stretching the whole route', () => {
    const html = renderToStaticMarkup(<TransactionsScreen />)
    const routeClasses = [...html.matchAll(/<div class="([^"]+)"/g)]
      .map((match) => match[1] ?? '')
      .find((classes) => classes.includes('pt-6') && classes.includes('pb-4'))

    expect(routeClasses).not.toContain('min-h-')
    expect(html).toContain('<div class="min-h-90"><ul')
  })

  test('surfaces eligible rows and active-plan presentation from screen props', () => {
    const eligibleHtml = renderToStaticMarkup(<TransactionsScreen startPlan={startPlan} />)
    const activeHtml = renderToStaticMarkup(
      <TransactionsScreen plans={[activePlan]} startPlan={startPlan} />,
    )

    expect(eligibleHtml).toContain('Pay over time')
    expect(activeHtml).toContain('>PLAN<')
    expect(activeHtml).toContain('USD 515.93/mo')
  })

  test('surfaces a safe initial payment-plan load failure above the activity list', () => {
    const html = renderToStaticMarkup(
      <TransactionsScreen paymentPlansError="Unable to load payment plans. Try again." />,
    )

    expect(html).toContain('Payment plans are unavailable. Try again.')
    expect(html.indexOf('Payment plans are unavailable')).toBeLessThan(
      html.indexOf('Emirates Airlines'),
    )
  })
})
