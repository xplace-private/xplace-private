import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import {
  CardDetails,
  type CardDetailsData,
} from './card-details'
import {
  cardDetailsVisibilityReducer,
  createCardDetailsVisibilityState,
} from '../model/card-details-visibility'

const details: CardDetailsData = {
  number: '4917 0032 7714 9023',
  expires: 'Emirates NBD',
  securityCode: '772',
}

describe('CardDetails', () => {
  test('renders backend-shaped card data and the remaining visibility time', () => {
    const html = renderToStaticMarkup(
      <CardDetails details={details} remainingSeconds={17} onCopy={() => undefined} />,
    )

    expect(html).toContain('4917 0032 7714 9023')
    expect(html).toContain('Emirates NBD')
    expect(html).toContain('772')
    expect(html).toContain('Hides in')
    expect(html).toContain('17s')
    expect(html.match(/>Copy<\/button>/g)).toHaveLength(2)
  })

  test('keeps the details block padding-driven instead of fixing its height', () => {
    const html = renderToStaticMarkup(
      <CardDetails details={details} remainingSeconds={20} onCopy={() => undefined} />,
    )

    expect(html).not.toMatch(/\bh-\[/)
    expect(html).not.toMatch(/\bmin-h-/)
  })

  test('shows details for twenty seconds and hides them on the final tick', () => {
    const visible = cardDetailsVisibilityReducer(createCardDetailsVisibilityState(), {
      type: 'toggle',
    })

    expect(visible).toEqual({ visible: true, remainingSeconds: 20 })
    expect(
      cardDetailsVisibilityReducer({ visible: true, remainingSeconds: 1 }, { type: 'tick' }),
    ).toEqual(createCardDetailsVisibilityState())
    expect(cardDetailsVisibilityReducer(visible, { type: 'toggle' })).toEqual(
      createCardDetailsVisibilityState(),
    )
    expect(cardDetailsVisibilityReducer(visible, { type: 'hide' })).toEqual(
      createCardDetailsVisibilityState(),
    )
  })
})
