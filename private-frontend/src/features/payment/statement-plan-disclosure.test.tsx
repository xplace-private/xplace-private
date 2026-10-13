import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import {
  StatementPlanDisclosure,
  type StatementPlanAdjustment,
} from './statement-plan-disclosure'

const emiratesAdjustment: StatementPlanAdjustment = {
  id: 'plan-emirates',
  merchant: 'Emirates Airlines',
  originalAmount: 'USD 2,840.00',
  monthlyPayment: 'USD 515.93/mo',
  termLabel: '6 months',
  reductionCents: 232407,
  reduction: '−USD 2,324.07',
}

describe('StatementPlanDisclosure', () => {
  test('renders nothing when there are no statement adjustments', () => {
    expect(
      renderToStaticMarkup(
        <StatementPlanDisclosure
          adjustments={[]}
          expanded={false}
          onToggle={() => undefined}
        />,
      ),
    ).toBe('')
  })

  test('sums numeric reductions and renders each expanded adjustment', () => {
    const html = renderToStaticMarkup(
      <StatementPlanDisclosure
        adjustments={[
          emiratesAdjustment,
          {
            ...emiratesAdjustment,
            id: 'plan-hotel',
            merchant: 'Bulgari Hotel',
            originalAmount: 'USD 1,240.00',
            monthlyPayment: 'USD 225.27/mo',
            reductionCents: 101473,
            reduction: '−USD 1,014.73',
          },
        ]}
        expanded
        onToggle={() => undefined}
      />,
    )

    expect(html).toContain('Lower this statement by USD 3,338.80')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-controls="statement-plan-adjustments"')
    expect(html).toContain('only its first instalment stays')
    expect(html).toContain('Emirates Airlines')
    expect(html).toContain('USD 2,840.00 · USD 515.93/mo × 6 months')
    expect(html).toContain('−USD 2,324.07')
    expect(html).toContain('Bulgari Hotel')
    expect(html).toContain('−USD 1,014.73')
    expect(html).toContain('border-0 px-0 py-2 text-left text-sm leading-6 font-light tracking-normal')
    expect(html).toContain('flex min-w-0 flex-col py-2 text-xs leading-5')
    expect(html).toContain('flex min-w-0 items-start justify-between py-[8.5px]')
    expect(html).toContain('w-[94px] shrink-0')
    expect(html).toContain('whitespace-nowrap text-positive')
    expect(html).toContain('whitespace-nowrap text-accent')
    expect(html).not.toContain('grid-cols-')
    expect(html).not.toContain('max-w-[45%]')
  })

  test('wraps important plan terms instead of truncating them', () => {
    const html = renderToStaticMarkup(
      <StatementPlanDisclosure
        adjustments={[emiratesAdjustment]}
        expanded
        onToggle={() => undefined}
      />,
    )

    expect(html).toContain(
      'flex min-w-0 items-start justify-between py-[8.5px]',
    )
    expect(html).toContain('min-w-0 whitespace-normal break-words')
    expect(html).not.toContain('class="truncate whitespace-nowrap"')
  })

  test('hides adjustment details and labels the collapsed toggle', () => {
    const html = renderToStaticMarkup(
      <StatementPlanDisclosure
        adjustments={[emiratesAdjustment]}
        expanded={false}
        onToggle={() => undefined}
      />,
    )

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain(
      'aria-label="Expand payment plan statement adjustments totalling USD 2,324.07"',
    )
    expect(html).not.toContain('only its first instalment stays')
    expect(html).not.toContain('Emirates Airlines')
  })
})
