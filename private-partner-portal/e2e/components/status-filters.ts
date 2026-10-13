import type { Locator, Page } from '@playwright/test'

import type { ClientStatusLabel } from '../data/clients'

export type StatusFilterLabel = 'All' | ClientStatusLabel

export class StatusFilters {
  readonly group: Locator

  constructor(page: Page) {
    this.group = page.getByRole('group', { name: 'Filter clients by status' })
  }

  /** Button names end with the status count, so the label is matched by its start. */
  button(label: StatusFilterLabel): Locator {
    return this.group.getByRole('button', { name: new RegExp(`^${label}`) })
  }

  async filterBy(label: StatusFilterLabel): Promise<void> {
    await this.button(label).click()
  }
}
