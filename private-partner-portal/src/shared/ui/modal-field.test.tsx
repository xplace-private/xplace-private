import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { ModalField } from './modal-field'

describe('ModalField', () => {
  test('uses semantic tokens for neutral field colors', () => {
    const html = renderToStaticMarkup(
      <ModalField label="Address" value="" readOnly />,
    )

    expect(html).toContain('border-border')
    expect(html).toContain('placeholder:text-secondary/80')
  })

  test('connects a validation message to the invalid input', () => {
    const html = renderToStaticMarkup(
      <ModalField label="Address" value="" error="This field is required" readOnly />,
    )

    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby=')
    expect(html).toContain('This field is required')
  })
})
