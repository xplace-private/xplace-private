import { expect, type Locator, type Page } from '@playwright/test'

/** The root route error boundary (src/app/route-boundaries.tsx) that replaces the whole screen. */
export class RouteErrorScreen {
  readonly heading: Locator
  readonly description: Locator
  readonly refreshButton: Locator

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Something went wrong.', level: 1 })
    this.description = page.getByText('Refresh the page and try again.')
    this.refreshButton = page.getByRole('button', { name: 'Refresh page' })
  }

  async waitUntilShown(): Promise<this> {
    await expect(this.heading).toBeVisible()
    return this
  }

  async refresh(): Promise<void> {
    await this.refreshButton.click()
  }
}
