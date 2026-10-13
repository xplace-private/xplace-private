import { YourCards } from './your-cards'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { CardHero } from './card-hero'
import { CardManagementPanel } from './card-management-panel'
import { GettingStartedSection } from './getting-started-section'
import type { HomeCard } from '../model/card-collection'

const frozenCard: HomeCard = {
  id: 'virtual-4417',
  backendId: null,
  name: 'Virtual card',
  kind: 'Virtual',
  lastFour: '4417',
  status: 'Frozen',
  hasPin: false,
  details: {
    number: '4917 0032 7714 4417',
    expires: 'Emirates NBD',
    securityCode: '772',
  },
}

test.each(['Manufacturing', 'In transit', 'Should be delivered', 'Not activated', 'Active', 'Frozen'] as const)(
  'shows physical card digits only after activation: %s',
  (status) => {
    const card: HomeCard = { ...frozenCard, kind: 'Physical', name: 'Travel', status }
    const row = renderToStaticMarkup(
      <YourCards cards={[card]} selectedCardId={card.id} onNew={() => undefined} onSelect={() => undefined} />,
    )
    const hero = renderToStaticMarkup(
      <CardHero card={card} detailsVisible={false} onToggleDetails={() => undefined} />,
    )
    if (status === 'Active' || status === 'Frozen') {
      expect(row).toContain('•••• 4417')
      expect(hero).toContain('•••• 4417')
      expect(hero).toContain('Show card details')
    } else {
      expect(row).not.toContain('4417')
      expect(row).not.toContain('Travel ·')
      expect(hero).not.toContain('4417')
      expect(hero).not.toContain('Show card details')
    }
  },
)

test.each(['Virtual', 'Physical'] as const)(
  'hides the details button for an unactivated %s card even when details are available',
  (kind) => {
    for (const details of [frozenCard.details, null]) {
      const html = renderToStaticMarkup(
        <CardHero
          card={{ ...frozenCard, kind, status: 'Not activated', details, expiration: '08/29' }}
          detailsVisible={false}
          onToggleDetails={() => undefined}
        />,
      )
      expect(html).not.toContain('Show card details')
      expect(html).not.toContain('/assets/home/eye.svg')
    }
  },
)

describe('frozen card views', () => {
  test('keeps the card border hidden until its image loads', () => {
    const html = renderToStaticMarkup(
      <CardHero
        card={{ ...frozenCard, status: 'Active' }}
        detailsVisible={false}
        onToggleDetails={() => undefined}
      />,
    )

    expect(html).toContain('border-transparent')
    expect(html).not.toContain('border-[#979797]')
  })

  test('offers on-demand details for a backend card and disables duplicate loads', () => {
    const html = renderToStaticMarkup(
      <CardHero
        card={{ ...frozenCard, status: 'Active', details: null, expiration: '08/29' }}
        detailsLoading
        detailsVisible={false}
        onToggleDetails={() => undefined}
      />,
    )

    expect(html).toContain('aria-label="Show card details"')
    expect(html).toContain('disabled=""')
  })

  test('renders the frozen Figma treatment on the card hero', () => {
    const html = renderToStaticMarkup(
      <CardHero card={frozenCard} detailsVisible={false} onToggleDetails={() => undefined} />,
    )

    expect(html).toContain('/assets/home/frozen-card.png')
    expect(html).toContain('>Frozen</span>')
    expect(html).toContain('bg-background/50')
  })

  test('keeps the frozen-card border hidden until its image loads', () => {
    const frozenHtml = renderToStaticMarkup(
      <CardHero card={frozenCard} detailsVisible={false} onToggleDetails={() => undefined} />,
    )
    const activeHtml = renderToStaticMarkup(
      <CardHero
        card={{ ...frozenCard, status: 'Active' }}
        detailsVisible={false}
        onToggleDetails={() => undefined}
      />,
    )

    expect(frozenHtml).toContain('border-transparent')
    expect(frozenHtml).not.toContain('shadow-[inset_0_0_0_0.25px_#979797]')
    expect(activeHtml).toContain('border-transparent')
  })

  test('shows unfreeze and removes unavailable frozen-card actions', () => {
    const html = renderToStaticMarkup(
      <CardManagementPanel
        card={frozenCard}
        onActivate={() => undefined}
        onFreezeToggle={() => undefined}
        onRename={() => undefined}
        onPin={() => undefined}
      />,
    )

    expect(html).toContain('>Frozen</span>')
    expect(html).not.toContain('Ponomarev')
    expect(html).toContain('>Unfreeze</span>')
    expect(html).toContain('>Rename</span>')
    expect(html).not.toContain('PIN</button>')
    expect(html).not.toContain('Ready for Apple Pay and Google Pay')
  })

  test('keeps wallet readiness and PIN actions available for an active card', () => {
    const activeCard: HomeCard = { ...frozenCard, status: 'Active' }
    const html = renderToStaticMarkup(
      <CardManagementPanel
        {...{ cardholderLastName: 'Morgan', cardholderTitle: 'Mr' as const }}
        card={activeCard}
        freezePending
        onActivate={() => undefined}
        onFreezeToggle={() => undefined}
        onRename={() => undefined}
        onPin={() => undefined}
      />,
    )

    expect(html).toContain('Mr Morgan · Active')
    expect(html).toContain('>Freeze</span>')
    expect(html).toContain('disabled=""')
    expect(html).toContain('Ready for Apple Pay and Google Pay')
    expect(html).toContain('>Set PIN</span>')

    const changedPinHtml = renderToStaticMarkup(
      <CardManagementPanel
        card={{ ...activeCard, hasPin: true }}
        onActivate={() => undefined}
        onFreezeToggle={() => undefined}
        onRename={() => undefined}
        onPin={() => undefined}
      />,
    )

    expect(changedPinHtml).toContain('>Change PIN</span>')
  })

  test('shows Ms for a female cardholder', () => {
    const html = renderToStaticMarkup(
      <CardManagementPanel
        card={{ ...frozenCard, status: 'Active' }}
        cardholderLastName="Morgan"
        cardholderTitle="Ms"
        onActivate={() => undefined}
        onFreezeToggle={() => undefined}
        onRename={() => undefined}
        onPin={() => undefined}
      />,
    )

    expect(html).toContain('Ms Morgan · Active')
  })

  test('shows the surname without a leading space when gender is null', () => {
    const html = renderToStaticMarkup(
      <CardManagementPanel
        card={{ ...frozenCard, status: 'Active' }}
        cardholderLastName="Morgan"
        onActivate={() => undefined}
        onFreezeToggle={() => undefined}
        onRename={() => undefined}
        onPin={() => undefined}
      />,
    )

    expect(html).toContain('Morgan · Active')
    expect(html).not.toContain('> Morgan · Active')
  })

  test('keeps account-level getting-started tasks independent of the selected card state', () => {
    const html = renderToStaticMarkup(
      <GettingStartedSection
        appleWalletAdded={false}
        hasPhysicalCard={false}
        canOrderPhysical
        onOrderPhysical={() => undefined}
      />,
    )

    expect(html).toContain('Get started')
    expect(html).toContain('Add to Apple Pay and Google Pay')
    expect(html).toContain('Order your physical card')
  })

  test('removes completed getting-started tasks and hides the section only when all are done', () => {
    const physicalIssuedHtml = renderToStaticMarkup(
      <GettingStartedSection
        appleWalletAdded={false}
        hasPhysicalCard
        canOrderPhysical
        onOrderPhysical={() => undefined}
      />,
    )
    const completedHtml = renderToStaticMarkup(
      <GettingStartedSection
        appleWalletAdded
        hasPhysicalCard
        canOrderPhysical
        onOrderPhysical={() => undefined}
      />,
    )

    expect(physicalIssuedHtml).toContain('Get started')
    expect(physicalIssuedHtml).toContain('Add to Apple Pay and Google Pay')
    expect(physicalIssuedHtml).not.toContain('Order your physical card')
    expect(completedHtml).toBe('')
  })

  test('hides the physical-card order action when the collection is full', () => {
    const html = renderToStaticMarkup(
      <GettingStartedSection
        appleWalletAdded={false}
        hasPhysicalCard={false}
        canOrderPhysical={false}
        onOrderPhysical={() => undefined}
      />,
    )

    expect(html).toContain('Add to Apple Pay and Google Pay')
    expect(html).not.toContain('Order your physical card')
  })

  test('renders the in-transit physical-card state from Figma', () => {
    const inTransitCard: HomeCard = {
      ...frozenCard,
      kind: 'Physical',
      status: 'In transit',
    }
    const panelHtml = renderToStaticMarkup(
      <CardManagementPanel
        card={inTransitCard}
        onActivate={() => undefined}
        onFreezeToggle={() => undefined}
        onRename={() => undefined}
        onPin={() => undefined}
      />,
    )
    expect(panelHtml).toContain('>In transit</span>')
    expect(panelHtml).toContain('>Activate</span>')
    expect(panelHtml).toContain('>Rename</span>')
    expect(panelHtml).not.toContain('>Freeze</button>')
    expect(panelHtml).not.toContain('PIN</button>')
  })

  test('keeps unavailable actions hidden for a not-activated card', () => {
    const html = renderToStaticMarkup(
      <CardManagementPanel
        card={{ ...frozenCard, status: 'Not activated', details: null }}
        onActivate={() => undefined}
        onFreezeToggle={() => undefined}
        onRename={() => undefined}
        onPin={() => undefined}
      />,
    )

    expect(html).toContain('>Not activated</span>')
    expect(html).toContain('>Rename</span>')
    expect(html).not.toContain('>Freeze</button>')
    expect(html).not.toContain('>Activate</button>')
    expect(html).not.toContain('PIN</button>')
    expect(html).not.toContain('Ready for Apple Pay and Google Pay')
  })
})

test.each(['Manufacturing', 'In transit', 'Should be delivered'] as const)(
  'shows %s in both card views and preserves delivery actions',
  (status) => {
    const card: HomeCard = {
      id: '77', backendId: 'rain-id', name: 'Travel', kind: 'Physical',
      lastFour: '3559', status, hasPin: false, details: null,
    }
    const row = renderToStaticMarkup(
      <YourCards cards={[card]} selectedCardId="77" onNew={() => undefined} onSelect={() => undefined} />,
    )
    const panel = renderToStaticMarkup(
      <CardManagementPanel
        card={card}
        onActivate={() => undefined}
        onFreezeToggle={() => undefined}
        onRename={() => undefined}
        onPin={() => undefined}
      />,
    )
    expect(row).toContain(status)
    expect(panel).toContain(`>${status}</span>`)
    expect(panel).toContain('>Activate</span>')
    expect(panel).not.toContain('>Freeze</span>')
    expect(panel).not.toContain('>Set PIN</span>')
    expect(panel).not.toContain('Ready for Apple Pay')
  },
)
