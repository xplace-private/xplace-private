import { expect, type Locator, type Page } from '@playwright/test'

import { Toast } from '../components/toast'

/**
 * A page object represents one route of the application.
 * Page objects reference each other (cycles), so navigation methods instantiate the next page
 * lazily inside the method; never create page objects at module top level.
 */
export abstract class BasePage {
  abstract readonly heading: Locator
  readonly toast: Toast

  protected constructor(
    protected readonly page: Page,
    private readonly path: string,
  ) {
    this.toast = new Toast(page)
  }

  async open(): Promise<this> {
    await this.page.goto(this.path)
    return this.waitUntilLoaded()
  }

  async reload(): Promise<this> {
    await this.page.reload()
    return this.waitUntilLoaded()
  }

  async waitUntilLoaded(): Promise<this> {
    await expect(this.page).toHaveURL((url) => url.pathname === this.path)
    // Some route headings are visually hidden, so presence in the DOM is the readiness signal.
    await expect(this.heading).toBeAttached()
    return this
  }
}
