import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

import { focusModalShell } from './modal-interactions'
import { ModalShell } from './modal-shell'

describe('ModalShell', () => {
  test('provides the shared responsive modal backdrop', () => {
    const html = renderToStaticMarkup(
      <ModalShell ariaLabel="Example modal" onClose={() => undefined}>
        Content
      </ModalShell>,
    )

    expect(html).toContain('bg-background/72')
    expect(html).toContain('backdrop-blur-[16px]')
    expect(html).toContain('pt-[max(20px,env(safe-area-inset-top,0px))]')
    expect(html).toContain('pb-[max(20px,env(safe-area-inset-bottom,0px))]')
    expect(html).toContain('max-h-full')
    expect(html).toContain('max-w-lg')
    expect(html).toContain('overscroll-contain')
  })

  test('lets the caller override the desktop panel width and provides a dialog title', () => {
    const html = renderToStaticMarkup(
      <ModalShell ariaLabel="Example modal" panelClassName="max-w-3xl" onClose={() => undefined}>
        Content
      </ModalShell>,
    )

    expect(html).toContain('max-w-3xl')
    expect(html).not.toContain('max-w-lg')
    expect(html).toMatch(/<h2[^>]*>Example modal<\/h2>/)
  })

  test('keeps the panel above the persistent app bar', () => {
    const html = renderToStaticMarkup(
      <ModalShell ariaLabel="Example modal" onClose={() => undefined}>
        Content
      </ModalShell>,
    )

    expect(html).toContain('z-50')
  })

  test('keeps dialog focus on the panel instead of opening a form input', () => {
    const html = renderToStaticMarkup(
      <ModalShell ariaLabel="Form modal" onClose={() => undefined}>
        <input />
      </ModalShell>,
    )

    expect(html).toMatch(/role="dialog"[^>]*tabindex="-1"/)
    expect(html).not.toMatch(/<input[^>]*autofocus=""/)
  })

  test('marks the panel while closing is blocked', () => {
    const html = renderToStaticMarkup(
      <ModalShell ariaLabel="Busy modal" closeDisabled onClose={() => undefined}>
        Content
      </ModalShell>,
    )

    expect(html).toMatch(/role="dialog"[^>]*data-close-disabled="true"/)
  })

  test('moves dialog focus away from form fields without scrolling', () => {
    const dialog = { focus: vi.fn() }

    focusModalShell(dialog)

    expect(dialog.focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})
