import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import type { HomeCard } from '../model/card-collection'
import { YourCards } from './your-cards'

const cards: readonly HomeCard[] = [
  {
    id: 'virtual-4417',
    backendId: null,
    name: 'Virtual card',
    kind: 'Virtual',
    lastFour: '4417',
    status: 'Active',
    hasPin: false,
    details: { number: '4417', expires: 'Emirates NBD', securityCode: '772' },
  },
  {
    id: 'travel-2217',
    backendId: null,
    name: 'Travel',
    kind: 'Virtual',
    lastFour: '2217',
    status: 'Active',
    hasPin: false,
    details: { number: '2217', expires: 'Emirates NBD', securityCode: '318' },
  },
]

describe('YourCards', () => {
  test('renders an explicit empty state without inventing a card', () => {
    const html = renderToStaticMarkup(
      <YourCards
        cards={[]}
        selectedCardId={null}
        onNew={() => undefined}
        onSelect={() => undefined}
      />,
    )

    expect(html).toContain('0 of 3 cards')
    expect(html).toContain('No cards yet.')
    expect(html).not.toContain('••••')
  })

  test('renders the dynamic count and marks the selected card as showing', () => {
    const html = renderToStaticMarkup(
      <YourCards
        cards={cards}
        selectedCardId="travel-2217"
        onNew={() => undefined}
        onSelect={() => undefined}
      />,
    )

    expect(html).toContain('2 of 3 cards')
    expect(html).toContain('Virtual card · •••• 4417')
    expect(html).toContain('Travel · •••• 2217')
    expect(html).toContain('>Show</button>')
    expect(html).toContain('>Showing</span>')
  })

  test('uses the 24 pixel Figma buttons through padding', () => {
    const html = renderToStaticMarkup(
      <YourCards
        cards={cards}
        selectedCardId="travel-2217"
        onNew={() => undefined}
        onSelect={() => undefined}
      />,
    )

    const showButton = html.match(/<button[^>]*>Show<\/button>/)?.[0]
    const newButton = html.match(/<button[^>]*>.*New<\/button>/)?.[0]

    for (const button of [showButton, newButton]) {
      expect(button).toContain('data-size="compact"')
      expect(button).toContain('data-text-style="body"')
    }
    expect(newButton).toContain('/assets/home/plus.svg')
    expect(html).toContain('py-px text-[8px] leading-5')
    expect(html).not.toContain('h-[24px]')
  })

  test('hides the New button once the three-card limit is reached', () => {
    const html = renderToStaticMarkup(
      <YourCards
        cards={[
          ...cards,
          {
            ...cards[0]!,
            id: 'expenses-5871',
            name: 'Expenses',
            lastFour: '5871',
          },
        ]}
        selectedCardId="virtual-4417"
        onNew={() => undefined}
        onSelect={() => undefined}
      />,
    )

    expect(html).toContain('3 of 3 cards')
    expect(html).not.toContain('/assets/home/plus.svg')
  })
})
