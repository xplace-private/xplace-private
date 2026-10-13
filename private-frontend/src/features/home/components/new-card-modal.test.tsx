import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { NewCardModal } from './new-card-modal'

describe('NewCardModal', () => {
  test('renders the editable Figma state with Travel as the initial name', () => {
    const html = renderToStaticMarkup(
      <NewCardModal
        name="Travel"
        cardType="Virtual"
        status="editing"
        validationAttempted={false}
        onTypeChange={() => undefined}
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('New card')
    expect(html).toContain('value="Travel"')
    expect(html).toContain('>Virtual</button>')
    expect(html).toContain('>Physical</button>')
    expect(html).toContain('>Save</button>')
    expect(html).toMatch(
      /data-variant="default" data-size="chip"[^>]*class="[^"]*bg-primary[^"]*"[^>]*aria-pressed="true"[^>]*>Virtual<\/button>/,
    )
    expect(html).not.toContain('bg-foreground')
  })

  test('blocks every modal close control and shows the Figma loader while issuing', () => {
    const html = renderToStaticMarkup(
      <NewCardModal
        name="Travel"
        cardType="Virtual"
        status="issuing"
        validationAttempted={false}
        onTypeChange={() => undefined}
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toMatch(/role="dialog"[^>]*data-close-disabled="true"/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cancel<\/button>/)
    expect(html).toContain('<svg')
    expect(html).not.toContain('>Save</button>')
  })

  test('keeps the modal padding-driven instead of assigning a fixed height', () => {
    const html = renderToStaticMarkup(
      <NewCardModal
        name="Travel"
        cardType="Virtual"
        status="editing"
        validationAttempted={false}
        onTypeChange={() => undefined}
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).not.toMatch(/(?:class="| )h-\[/)
    expect(html).not.toMatch(/\bmin-h-/)
  })

  test('uses the default Figma button size for Save in both states', () => {
    const editingHtml = renderToStaticMarkup(
      <NewCardModal
        name="Travel"
        cardType="Virtual"
        status="editing"
        validationAttempted={false}
        onTypeChange={() => undefined}
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )
    const issuingHtml = renderToStaticMarkup(
      <NewCardModal
        name="Travel"
        cardType="Virtual"
        status="issuing"
        validationAttempted={false}
        onTypeChange={() => undefined}
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )
    const editingPrimaryClasses = [...editingHtml.matchAll(/<button[^>]*class="([^"]+)"/g)].at(-1)?.[1]
    const issuingPrimaryClasses = [...issuingHtml.matchAll(/<button[^>]*class="([^"]+)"/g)].at(-1)?.[1]

    expect(editingPrimaryClasses).toContain('py-[7px]')
    expect(issuingPrimaryClasses).toContain('py-[7px]')
    expect(issuingPrimaryClasses).toContain('opacity-90')
    expect(editingPrimaryClasses).not.toContain('h-9')
    expect(issuingPrimaryClasses).not.toContain('h-9')
  })

  test('renders Physical as the selected reusable card type', () => {
    const html = renderToStaticMarkup(
      <NewCardModal
        name="Travel"
        cardType="Physical"
        status="editing"
        validationAttempted={false}
        onTypeChange={() => undefined}
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Physical<\/button>/)
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Virtual<\/button>/)
  })

  test('shows a required message after an empty Save attempt', () => {
    const html = renderToStaticMarkup(
      <NewCardModal
        name=""
        cardType="Virtual"
        status="editing"
        validationAttempted
        onTypeChange={() => undefined}
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('This field is required')
    expect(html).toContain('aria-invalid="true"')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Save<\/button>/)
  })

  test('shows a safe issuance failure while keeping the form editable', () => {
    const html = renderToStaticMarkup(
      <NewCardModal
        name="Travel"
        cardType="Virtual"
        status="editing"
        validationAttempted={false}
        requestError="Unable to issue card. Try again."
        onTypeChange={() => undefined}
        onNameChange={() => undefined}
        onCancel={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('Unable to issue card. Try again.')
    expect(html).toContain('>Save</button>')
  })
})

test('keeps the name step with a loader while physical-card countries load', () => {
  const html = renderToStaticMarkup(<NewCardModal name="Travel" cardType="Physical" status="loading"
    validationAttempted={false} onTypeChange={() => undefined} onNameChange={() => undefined}
    onCancel={() => undefined} onSave={() => undefined} />)
  expect(html).toContain('value="Travel"')
  expect(html).toContain('Loading')
  expect(html).not.toContain('>Save</button>')
  expect(html).toMatch(/data-close-disabled="true"/)
})
