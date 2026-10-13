import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { PrivatePageShell } from './private-page-shell'

describe('PrivatePageShell', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('keeps the app bar fixed while preserving its place in the document flow', () => {
    const html = renderToStaticMarkup(
      <PrivatePageShell>
        <p>Page content</p>
      </PrivatePageShell>,
    )

    expect(html).toContain('fixed inset-x-0 top-0')
    expect(html).toContain('data-theme-header="true"')
    expect(html).not.toContain('sticky')
    expect(html.match(/h-\[calc\(65px\+env\(safe-area-inset-top,0px\)\)\]/g)).toHaveLength(2)
    expect(html).toContain('aria-hidden="true"')
  })

  test('allocates the viewport remainder between the app bar and footer to page content', () => {
    const html = renderToStaticMarkup(
      <PrivatePageShell>
        <p>Page content</p>
      </PrivatePageShell>,
    )

    expect(html).toContain(
      'min-h-[calc(100dvh-65px-env(safe-area-inset-top,0px))]',
    )
    expect(html).toContain('flex min-w-0 flex-1 flex-col')
  })

  test('uses wide desktop containers for the header and footer', () => {
    const html = renderToStaticMarkup(
      <PrivatePageShell>
        <p>Page content</p>
      </PrivatePageShell>,
    )

    expect(html.match(/min-\[480px\]:max-w-\[460px\]/g)).toHaveLength(1)
    expect(html.match(/min-\[480px\]:max-w-\[1000px\]/g)).toHaveLength(2)
    expect(html).toContain('min-[480px]:px-[10px]')
    expect(html).toContain('min-[480px]:px-[26px]')
  })

  test('shows the English language selector beside WhatsApp', () => {
    const html = renderToStaticMarkup(
      <PrivatePageShell>
        <p>Page content</p>
      </PrivatePageShell>,
    )

    expect(html).toContain('aria-label="Change language, current English"')
    expect(html).toContain('>EN</span>')
    expect(html).toContain('aria-label="Open WhatsApp"')
    expect(html).toContain('data-private-header-label="true"')
    expect(html).toContain('data-size="nav"')
    expect(html).toContain('data-size="icon-md"')
    expect(html).toContain(
      'min-[561px]:px-2.5 min-[561px]:py-[7px] text-xs leading-5',
    )
  })

  test('shows the concierge label only above the demo mobile breakpoint', () => {
    const html = renderToStaticMarkup(
      <PrivatePageShell>
        <p>Page content</p>
      </PrivatePageShell>,
    )

    expect(html).toContain(
      '<span class="hidden min-[561px]:inline">Concierge</span>',
    )
    expect(html.match(/transition-colors/g) ?? []).toHaveLength(1)
  })

  test('opens concierge WhatsApp as a link in a new tab', () => {
    const html = renderToStaticMarkup(
      <PrivatePageShell>
        <p>Page content</p>
      </PrivatePageShell>,
    )
    const link = html.match(/<a\b[^>]*aria-label="Open WhatsApp"[^>]*>/)?.[0]

    expect(link).toContain('href="https://wa.me/971554570290"')
    expect(link).toContain('target="_blank"')
    expect(link).toContain('rel="noopener noreferrer"')
    expect(html).not.toMatch(/<button[^>]*aria-label="Open WhatsApp"/)
  })

  test('opens the language selector as an app menu', () => {
    const html = renderToStaticMarkup(
      <PrivatePageShell>
        <p>Page content</p>
      </PrivatePageShell>,
    )

    expect(html).toContain('aria-haspopup="menu"')
    expect(html).not.toContain('<select')
  })

  test('does not render a logo when the theme has none', () => {
    vi.stubGlobal('document', {
      documentElement: { dataset: { logoUrl: '' } },
    })

    const html = renderToStaticMarkup(
      <PrivatePageShell>
        <p>Page content</p>
      </PrivatePageShell>,
    )

    expect(html).not.toContain('<img')
    expect(html).toContain('>PRIVATE</span>')
  })
})
