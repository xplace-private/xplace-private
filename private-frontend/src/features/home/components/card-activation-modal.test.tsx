import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { CardActivationModal } from './card-activation-modal'

describe('CardActivationModal', () => {
  test('renders the responsive Figma activation form', () => {
    const html = renderToStaticMarkup(
      <CardActivationModal
        expiry=""
        lastFour=""
        validationAttempted={false}
        onCancel={() => undefined}
        onExpiryChange={() => undefined}
        onLastFourChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(html).toContain('Activate physical card')
    expect(html).toContain('Enter the last four digits and expiry date printed on the card.')
    expect(html).toContain('Last four digits')
    expect(html).toContain('placeholder="0000"')
    expect(html).toContain('Expiry')
    expect(html).toContain('placeholder="MM/YY"')
    expect(html.match(/required=""/g)).toHaveLength(2)
    expect(html).not.toMatch(/(?:class="| )h-\[/)
    expect(html).not.toMatch(/\bmin-h-/)
  })

  test('shows field-specific validation feedback after submit', () => {
    const emptyHtml = renderToStaticMarkup(
      <CardActivationModal
        expiry=""
        lastFour=""
        validationAttempted
        onCancel={() => undefined}
        onExpiryChange={() => undefined}
        onLastFourChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )
    const invalidHtml = renderToStaticMarkup(
      <CardActivationModal
        expiry="13/40"
        lastFour="12"
        validationAttempted
        onCancel={() => undefined}
        onExpiryChange={() => undefined}
        onLastFourChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(emptyHtml.match(/This field is required/g)).toHaveLength(2)
    expect(emptyHtml.match(/aria-invalid="true"/g)).toHaveLength(2)
    expect(invalidHtml).toContain('Enter four digits')
    expect(invalidHtml).toContain('Enter a valid expiry date')
  })
})

test('shows activation request errors and disables resubmission while loading', () => {
  const props = { expiry: '08/29', lastFour: '7391', validationAttempted: false,
    onCancel: () => undefined, onExpiryChange: () => undefined, onLastFourChange: () => undefined, onSubmit: () => undefined }
  const loading = renderToStaticMarkup(<CardActivationModal {...props} loading />)
  expect(loading.match(/disabled=""/g)).toHaveLength(4)
  expect(loading).toContain('role="status"')
  const failed = renderToStaticMarkup(<CardActivationModal {...props} error="home.activation.errors.mismatch" />)
  expect(failed).toContain('Card details do not match')
  expect(failed).toContain('value="7391"')
})
