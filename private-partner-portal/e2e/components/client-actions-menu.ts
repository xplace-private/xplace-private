import { expect, type Locator, type Page } from '@playwright/test'

/** The dropdown opened by the "Actions for {name}" button of a clients table row. */
export class ClientActionsMenu {
  readonly menu: Locator
  readonly infoGroup: Locator
  readonly items: Locator

  constructor(private readonly page: Page) {
    this.menu = page.getByRole('menu')
    this.infoGroup = this.menu.getByRole('group')
    this.items = this.menu.getByRole('menuitem')
  }

  async waitUntilOpen(): Promise<this> {
    await expect(this.menu).toBeVisible()
    return this
  }

  item(name: string): Locator {
    return this.menu.getByRole('menuitem', { name })
  }

  async closeByClickingOutside(): Promise<void> {
    await this.page.mouse.click(5, 5)
  }

  async choose(name: string): Promise<void> {
    await this.item(name).click()
  }
}
