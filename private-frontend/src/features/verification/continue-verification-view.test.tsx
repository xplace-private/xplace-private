import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

import { ContinueVerificationView } from './continue-verification-view'

describe('ContinueVerificationView', () => {
  test('renders the verification introduction with Continue and Sign out actions', () => {
    const html = renderToStaticMarkup(
      <ContinueVerificationView
        error={null}
        pending={false}
        onContinue={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(html).toContain('APPLICATION · IDENTITY')
    expect(html).toContain('Continue identity verification')
    expect(html).toContain('Three steps, about three minutes.')
    expect(html).toContain('<button')
    expect(html).toContain('Continue verification')
    expect(html).toContain('>Sign out</button>')
    expect(html).not.toContain('disabled=""')
  })

  test('shows a loader and disables only Continue while it is pending', () => {
    const html = renderToStaticMarkup(
      <ContinueVerificationView
        error={null}
        pending
        onContinue={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('animate-spin')
    expect(html).toContain('aria-label="Preparing verification"')
    expect(html.match(/disabled=""/g)).toHaveLength(1)
  })

  test('renders a generic alert when continuing cannot start', () => {
    const html = renderToStaticMarkup(
      <ContinueVerificationView
        error="request failed"
        pending={false}
        onContinue={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Something went wrong. Please try again.')
    expect(html).not.toContain('request failed')
  })
})
