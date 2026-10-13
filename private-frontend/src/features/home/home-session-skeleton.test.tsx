import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { Skeleton } from '../../shared/ui/skeleton'
import { HomeScreen } from './home-screen'
import { HomeSessionSkeleton } from './home-session-skeleton'
import type { HomeCard } from './model/card-collection'

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

function layoutSlots(markup: string): string[] {
  return [...markup.matchAll(/data-layout-slot="([^"]+)"/g)].flatMap(
    ([, slot]) => (slot === undefined ? [] : [slot]),
  )
}

describe('HomeSessionSkeleton', () => {
  test('uses the local shadcn-style skeleton treatment and merges caller classes', () => {
    const markup = renderToStaticMarkup(<Skeleton className="h-4" />)

    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain(
      'class="animate-pulse rounded-md bg-border h-4"',
    )
  })

  test('shares the loaded Home outer frame and ordered layout slots', () => {
    const loadedMarkup = renderToStaticMarkup(
      <HomeScreen
        balance={{
          availableToSpendCents: 950022,
          spentThisPeriodCents: 49988,
          dueThisPeriodCents: 49988,
          dueDate: '2026-09-05',
          overdue: [],
        }}
        cards={[backendCard]}
      />,
    )
    const loadingMarkup = renderToStaticMarkup(<HomeSessionSkeleton />)

    expect(loadingMarkup).toContain(
      'flex min-w-0 flex-col gap-4 px-4 pt-6 pb-4',
    )
    expect(loadingMarkup).toContain('aspect-[343/216]')
    expect(loadingMarkup).toContain('grid-cols-2 gap-x-2')
    expect(layoutSlots(loadingMarkup)).toEqual([
      'card',
      'banner',
      'stats',
      'management',
      'getting-started',
    ])
    expect(layoutSlots(loadedMarkup)).toEqual(layoutSlots(loadingMarkup))
  })

  test('does not show the card border while the card skeleton is visible', () => {
    const markup = renderToStaticMarkup(<HomeSessionSkeleton />)
    const cardSlot = markup.match(
      /data-layout-slot="card"[\s\S]*?data-layout-slot="banner"/,
    )?.[0]

    expect(cardSlot).toBeDefined()
    expect(cardSlot).not.toContain('border-[#979797]')
  })

  test('derives wrap-sensitive height from hidden real-flow copy', () => {
    const markup = renderToStaticMarkup(<HomeSessionSkeleton />)

    expect(
      markup.match(/class="invisible[^"]*" aria-hidden="true"/g) ?? [],
    ).toHaveLength(4)
    expect(markup).toContain(
      'until your statement is issued, then USD 3,034.90 is due by 5 Sep.',
    )
    expect(markup).toContain('This period, due 5 Sep')
    expect(markup).toContain('Pay from your phone in seconds')
    expect(markup).toContain('Delivered by courier in up to 7 working days')
    expect(markup).not.toContain(
      'h-[57.6px] w-full min-[360px]:h-[38.4px]',
    )
    expect(markup).not.toContain('h-[14px] w-24 max-w-full')
    expect(markup).not.toContain('h-[11px] w-48 max-w-full')
    expect(markup.match(/animate-pulse/g)?.length).toBeGreaterThan(10)
  })

  test('matches the current stat, management, and action-tile geometry', () => {
    const markup = renderToStaticMarkup(<HomeSessionSkeleton />)
    const stats = markup.match(
      /data-layout-slot="stats"[\s\S]*?data-layout-slot="management"/,
    )?.[0]
    const management = markup.match(
      /data-layout-slot="management"[\s\S]*?data-layout-slot="getting-started"/,
    )?.[0]
    const gettingStarted = markup.match(
      /data-layout-slot="getting-started"[\s\S]*$/,
    )?.[0]

    expect(stats).toContain('border-t border-border pt-[14px]')
    expect(stats).toContain('h-10 w-full')
    expect(management).toContain('border-border bg-card p-4')
    expect(management).toContain('flex min-w-0 flex-col gap-2')
    expect(management).toContain('h-9 min-w-0 flex-1')
    expect(gettingStarted).toContain('text-xs leading-5 text-foreground')
    expect(gettingStarted).toContain('text-xs leading-5 text-secondary')
    expect(gettingStarted).toContain('tracking-[1.6px]')
    expect(gettingStarted).toContain('h-5 w-40 max-w-full')
    expect(markup).not.toContain('h-[33px]')
  })
})
