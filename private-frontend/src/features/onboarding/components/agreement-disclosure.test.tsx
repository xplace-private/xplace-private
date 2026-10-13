import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { AgreementDisclosure } from './agreement-disclosure'

describe('AgreementDisclosure', () => {
  test('hides its content and exposes the collapsed state', () => {
    const html = renderToStaticMarkup(
      <AgreementDisclosure
        id="privacy"
        title="Privacy Policy"
        expanded={false}
        onToggle={() => undefined}
      >
        Temporary privacy policy text.
      </AgreementDisclosure>,
    )

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="privacy-content"')
    expect(html).toMatch(/(?:^| )text-foreground(?: |")/)
    expect(html).not.toContain('text-muted-foreground')
    expect(html).toContain('>+</span>')
    expect(html).not.toContain('Temporary privacy policy text.')
  })

  test('shows its scrollable content and exposes the expanded state', () => {
    const html = renderToStaticMarkup(
      <AgreementDisclosure
        id="cardholder"
        title="Cardholder Agreement (U.S. Customers)"
        expanded
        onToggle={() => undefined}
      >
        Agreement body.
      </AgreementDisclosure>,
    )

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-controls="cardholder-content"')
    expect(html).toContain('id="cardholder-content"')
    expect(html).toContain('>−</span>')
    expect(html).toContain('Agreement body.')
  })
})
