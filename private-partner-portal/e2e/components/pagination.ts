import type { Locator, Page } from '@playwright/test'

export class Pagination {
  readonly nav: Locator
  readonly previousButton: Locator
  readonly nextButton: Locator
  /** "Page X of Y"; rendered only on narrow viewports instead of numbered buttons. */
  readonly compactStatus: Locator

  constructor(page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Client pages' })
    this.previousButton = this.nav.getByRole('button', { name: 'Previous', exact: true })
    this.nextButton = this.nav.getByRole('button', { name: 'Next', exact: true })
    this.compactStatus = this.nav.getByRole('status')
  }

  /** The current page carries aria-current="page". */
  page(number: number): Locator {
    return this.nav.getByRole('button', { name: `Go to page ${number}`, exact: true })
  }

  async goToPage(number: number): Promise<void> {
    const button = this.page(number)
    await button.click()
  }
}
