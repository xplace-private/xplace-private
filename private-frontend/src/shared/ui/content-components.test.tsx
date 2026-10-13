import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { ActionTile } from './action-tile'
import { FlowHeading } from './flow-heading'
import { InfoBanner } from './info-banner'
import { SectionDivider } from './section-divider'
import { SectionHeader } from './section-header'

describe('shared content components', () => {
  test('renders flow headings with the shared Figma typography', () => {
    const html = renderToStaticMarkup(
      <FlowHeading eyebrow="Application" title="Your profile" description="Tell us more." />,
    )

    expect(html).toContain('font-sans')
    expect(html).toContain('text-xs leading-5 font-light tracking-[1.6px]')
    expect(html).toContain('text-[32px] leading-10 font-bold tracking-normal')
    expect(html).toContain('text-sm leading-6 font-light')
    expect(html).toContain('text-secondary')
  })

  test('renders a section heading with an optional action', () => {
    const html = renderToStaticMarkup(
      <SectionHeader action={<button type="button">View all</button>}>Activity</SectionHeader>,
    )

    expect(html).toContain('<h2')
    expect(html).toContain('Activity')
    expect(html).toContain('View all')
  })

  test('renders neutral and warning information banners', () => {
    const neutral = renderToStaticMarkup(<InfoBanner variant="neutral">Statement</InfoBanner>)
    const warning = renderToStaticMarkup(<InfoBanner variant="warning">Warning</InfoBanner>)

    expect(neutral).toContain('border-border')
    expect(neutral).toContain('pt-[14.2px] pb-[14.285px]')
    expect(warning).toContain('border-notice-accent')
    expect(warning).toContain('bg-notice-background')
    expect(warning).toContain('text-notice-accent')
  })

  test('renders an action tile from reusable content props', () => {
    const html = renderToStaticMarkup(
      <ActionTile
        iconSrc="/leading.svg"
        title="Order your physical card"
        description="Delivered by courier"
        trailingIconSrc="/trailing.svg"
      />,
    )

    expect(html).toContain('Order your physical card')
    expect(html).toContain('Delivered by courier')
    expect(html).toContain('/leading.svg')
    expect(html).toContain('/trailing.svg')
    expect(html).toContain('whitespace-normal')
    expect(html).toContain('text-xs leading-5 text-secondary')
  })

  test('renders a centred section divider with padding-driven spacing', () => {
    const html = renderToStaticMarkup(<SectionDivider />)

    expect(html).toContain('class="relative py-4"')
    expect(html).toContain('absolute inset-x-0 top-1/2')
  })
})
