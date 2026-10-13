import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { Loader } from './loader'

describe('Loader', () => {
  test('renders inline without external image requests', () => {
    const html = renderToStaticMarkup(<Loader label="Loading account" />)

    expect(html).toContain('<svg')
    expect(html).toContain('stroke="currentColor"')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('/assets/shared/loader-')
  })

  test('uses a light tone on dark surfaces', () => {
    const html = renderToStaticMarkup(
      <Loader label="Loading account" tone="light" />,
    )

    expect(html).toContain('text-primary')
    expect(html).not.toContain('<circle')
    expect(html).not.toContain('stroke-opacity')
  })

  test('keeps the dark tone as the button default', () => {
    const html = renderToStaticMarkup(<Loader decorative />)

    expect(html).toContain('text-primary-foreground')
  })
})
