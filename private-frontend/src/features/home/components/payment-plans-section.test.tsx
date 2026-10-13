import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import type { PaymentPlan } from '../model/payment-plan'
import { PaymentPlanDetailsModal } from './payment-plan-details-modal'
import { PaymentPlanStartModal } from './payment-plan-start-modal'
import { PaymentPlansSection } from './payment-plans-section'
import { SettlePaymentPlanModal } from './settle-payment-plan-modal'

const activePlan: PaymentPlan = {
  id: 'plan-emirates',
  transactionId: 'emirates',
  merchant: 'Emirates Airlines',
  currency: 'USD',
  principalCents: 284000,
  termMonths: 6,
  aprBasisPoints: 1800,
  feeCents: 25560,
  totalRepayableCents: 309560,
  monthlyPaymentCents: 51593,
  paidInstallments: 2,
  startedAt: '2026-08-19T00:00:00.000Z',
}

describe('PaymentPlansSection', () => {
  test('renders nothing when there are no active plans', () => {
    expect(
      renderToStaticMarkup(<PaymentPlansSection plans={[]} onSelect={() => undefined} />),
    ).toBe('')
  })

  test('renders an active plan as a responsive progress row', () => {
    const html = renderToStaticMarkup(
      <PaymentPlansSection plans={[activePlan]} onSelect={() => undefined} />,
    )

    expect(html).toContain('Payment plans')
    expect(html).toContain(
      'Purchases you chose to pay over time. Instalments are added to each statement.',
    )
    expect(html).toContain('aria-label="Open Emirates Airlines payment plan details"')
    expect(html).toContain('USD 515.93/mo')
    expect(html).toContain('6 months')
    expect(html).toContain('USD 2,063.74 of USD 3,095.60 remaining')
    expect(html).toContain('from 19 Aug')
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="33"')
    expect(html).toContain('width:33.33333333333333%')

    const remainingSummaryClasses = html.match(
      /<span class="([^"]+)">6 months · USD 2,063\.74 of USD 3,095\.60 remaining · from 19 Aug<\/span>/,
    )?.[1]
    expect(remainingSummaryClasses).toContain('whitespace-normal')
    expect(remainingSummaryClasses).not.toContain('truncate')
    expect(html).toContain('flex min-w-0 flex-col gap-4')
    expect(html).toContain('gap-2 px-4 py-4')
    expect(html).toContain('font-sans text-sm leading-6')
    expect(html).toContain('text-xs leading-4 text-secondary')
  })
})

describe('PaymentPlanDetailsModal', () => {
  test('shows the active plan values and early-settlement action', () => {
    const html = renderToStaticMarkup(
      <PaymentPlanDetailsModal
        plan={activePlan}
        onClose={() => undefined}
        onSettle={() => undefined}
      />,
    )

    expect(html).toContain('aria-label="Open Emirates Airlines payment plan details"')
    expect(html).toContain('USD 2,063.74')
    expect(html).toContain('remaining of USD 3,095.60')
    expect(html).toContain('Monthly')
    expect(html).toContain('USD 515.93')
    expect(html).toContain('6 months · 19 Aug')
    expect(html).toContain('18.0% APR fixed')
    expect(html).toContain('USD 255.60')
    expect(html).toContain('33% paid')
    expect(html).toContain('Settle early today')
    expect(html).toContain(
      'You can settle this plan in full at any time. The fixed plan fee still applies, and settling early frees your available limit sooner.',
    )
    expect(html).toContain('Settle plan now · USD 2,063.74')
    expect(html).toContain('text-base leading-7 font-light')
    expect(html).toContain('text-2xl leading-8 font-bold')
    expect(html).toContain('data-size="md"')
  })
})

describe('PaymentPlanStartModal', () => {
  test('uses the Figma plan-card typography and padding-driven actions', () => {
    const html = renderToStaticMarkup(
      <PaymentPlanStartModal
        isSubmitting={false}
        transaction={{
          id: 'emirates',
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
          declineReasonCategory: null,
          card: 'Virtual · •••• 4417',
          rate: '1 USD = 3.6507 AED',
          state: 'completed',
        }}
        onClose={() => undefined}
        onStart={() => undefined}
      />,
    )

    expect(html).toContain('data-text-style="body"')
    expect(html).toContain('font-sans text-xs leading-5 font-light tracking-[1.6px]')
    expect(html).toContain('text-2xl leading-6 font-bold')
    expect(html).toContain('text-xs leading-5 font-light tracking-normal')
    expect(html).toContain('data-size="md"')
    expect(html).toContain('flex min-w-0 flex-col p-[26px]')
    expect(html).toContain('py-4')
    expect(html).toContain('flex min-w-0 flex-col gap-2 pt-[18px]')
  })
})

describe('SettlePaymentPlanModal', () => {
  test('matches the Figma confirmation copy and actions', () => {
    const html = renderToStaticMarkup(
      <SettlePaymentPlanModal
        error={undefined}
        isSubmitting={false}
        plan={activePlan}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('aria-label="Settle Emirates Airlines payment plan"')
    expect(html).toContain('Settle plan now')
    expect(html).toContain(
      'Pay the full remaining balance today, including the fixed plan fee. This closes the plan and frees your available limit.',
    )
    expect(html).toContain('>Cancel</button>')
    expect(html).toContain('Confirm · USD 2,063.74')
    expect(html).toContain('gap-6 p-6')
    expect(html).toContain('font-sans text-base leading-6 font-bold')
    expect(html).toContain('text-[10px] leading-3')
  })

  test('keeps a safe failure visible', () => {
    const html = renderToStaticMarkup(
      <SettlePaymentPlanModal
        error="Unable to settle this plan. Try again."
        isSubmitting={false}
        plan={activePlan}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Unable to update the plan. Try again.')
    expect(html).not.toContain('Unable to settle this plan. Try again.')
  })

  test('disables both actions and backdrop close while pending', () => {
    const html = renderToStaticMarkup(
      <SettlePaymentPlanModal
        error={undefined}
        isSubmitting
        plan={activePlan}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(html).toContain('data-close-disabled="true"')
  })
})
