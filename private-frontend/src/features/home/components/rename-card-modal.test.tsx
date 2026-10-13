import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { RenameCardModal } from './rename-card-modal'

function renderModal(status: 'editing' | 'saving') {
  return renderToStaticMarkup(
    <RenameCardModal
      name="Virtual card"
      status={status}
      onNameChange={() => undefined}
      onCancel={() => undefined}
      onSave={() => undefined}
    />,
  )
}

describe('RenameCardModal', () => {
  test('renders the editable Figma state', () => {
    const html = renderModal('editing')

    expect(html).toContain('Rename card')
    expect(html).toContain('The name printed on the card does not change.')
    expect(html).toContain('value="Virtual card"')
    expect(html).toContain('>Save</button>')
  })

  test('blocks closing and shows a loader while saving', () => {
    const html = renderModal('saving')

    expect(html).toMatch(/role="dialog"[^>]*data-close-disabled="true"/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cancel<\/button>/)
    expect(html).toContain('<svg')
  })

  test('keeps the default Figma button geometry while saving', () => {
    const editingHtml = renderModal('editing')
    const savingHtml = renderModal('saving')
    const editingPrimaryClasses = [...editingHtml.matchAll(/<button[^>]*class="([^"]+)"/g)].at(-1)?.[1]
    const savingPrimaryClasses = [...savingHtml.matchAll(/<button[^>]*class="([^"]+)"/g)].at(-1)?.[1]

    expect(editingPrimaryClasses).toBe(savingPrimaryClasses)
    expect(editingPrimaryClasses).toContain('py-[7px]')
    expect(editingPrimaryClasses).not.toContain('h-9')
    expect(savingPrimaryClasses).toContain('disabled:opacity-100')
  })

  test('allows an empty name so Save can clear it', () => {
    const html = renderToStaticMarkup(
      <RenameCardModal
        name=""
        status="editing"
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).not.toContain('This field is required')
    expect(html).not.toContain('aria-invalid="true"')
  })

  test('shows a backend save error', () => {
    const html = renderToStaticMarkup(
      <RenameCardModal
        name="Virtual card"
        status="editing"
        error="Unable to rename card. Try again."
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('Unable to rename card. Try again.')
    expect(html).toContain('aria-invalid="true"')
  })
})
