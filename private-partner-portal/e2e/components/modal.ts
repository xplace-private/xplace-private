import { expect, type Locator, type Page } from '@playwright/test'

export class Modal {
  readonly dialog: Locator
  // Not every modal renders a "Close" button (the change password modal only closes with Escape).
  readonly closeButton: Locator

  constructor(
    protected readonly page: Page,
    name: string,
  ) {
    this.dialog = page.getByRole('dialog', { name })
    this.closeButton = this.dialog.getByRole('button', { name: 'Close', exact: true })
  }

  async waitUntilOpen(): Promise<this> {
    await expect(this.dialog).toBeVisible()
    return this
  }

  async close(): Promise<void> {
    await this.closeButton.click()
  }

  /** The overlay pads the panel by 20 px, so the viewport corner is always outside it. */
  async closeByClickingOutside(): Promise<void> {
    await this.page.mouse.click(5, 5)
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }
}
